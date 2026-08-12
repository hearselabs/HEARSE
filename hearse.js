#!/usr/bin/env node
/**
 * HEARSE — pengurus pemakaman otomatis untuk token Solana yang sudah mati.
 *
 * Alur kerjanya tiap kali dijalankan:
 *   1. TEMUKAN  — ambil token pump.fun yang baru muncul, masukkan daftar pantau
 *   2. PERIKSA  — cek satu per satu, mana yang sudah tidak bernyawa
 *   3. MAKAMKAN — tulis obituarinya, simpan ke arsip, kirim ke Telegram
 *
 * Semua sumber datanya gratis. Tidak ada satu pun yang butuh kartu kredit.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(DIR, "data");

// ─────────────────────────────────────────────────────────────
// PENGATURAN
// Semua bisa diubah lewat file .env tanpa menyentuh kode ini.
// ─────────────────────────────────────────────────────────────

loadEnv(path.join(DIR, ".env"));

const CFG = {
  // Sebuah token dianggap MATI kalau salah satu ini terpenuhi
  deadLiquidityUsd: num(process.env.DEAD_LIQUIDITY_USD, 500),
  deadVolume24hUsd: num(process.env.DEAD_VOLUME_24H_USD, 150),

  // Umur minimum sebelum boleh dinyatakan mati (jangan kubur bayi baru lahir)
  minAgeMinutes: num(process.env.MIN_AGE_MINUTES, 60),

  // Berapa banyak obituari maksimal per sekali jalan
  maxBurialsPerRun: num(process.env.MAX_BURIALS_PER_RUN, 3),

  // Buang token yang likuiditasnya palsu (kolam raksasa tapi tak ada transaksi)
  fakeLiquidityUsd: num(process.env.FAKE_LIQUIDITY_USD, 5_000_000),

  groqKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",

  tgToken: process.env.TELEGRAM_BOT_TOKEN || "",
  tgChannel: process.env.TELEGRAM_CHANNEL_ID || "", // channel publik
  tgOwner: process.env.TELEGRAM_OWNER_ID || "", // chat pribadimu, untuk draft harian
};

const DRY = process.argv.includes("--dry");

// ─────────────────────────────────────────────────────────────
// 1. TEMUKAN — token baru yang layak dipantau
// ─────────────────────────────────────────────────────────────

async function discover() {
  const urls = [
    "https://api.dexscreener.com/token-profiles/latest/v1",
    "https://api.dexscreener.com/token-boosts/latest/v1",
  ];

  const found = new Map();
  for (const url of urls) {
    const list = await getJson(url).catch(() => []);
    for (const item of arr(list)) {
      // Hanya Solana, dan hanya yang lahir di pump.fun (alamatnya berakhiran "pump")
      if (item?.chainId !== "solana") continue;
      const addr = item?.tokenAddress;
      if (!addr || !addr.toLowerCase().endsWith("pump")) continue;
      found.set(addr, true);
    }
  }
  return [...found.keys()];
}

// ─────────────────────────────────────────────────────────────
// 2. PERIKSA — ambil kondisi terkini, tentukan hidup atau mati
// ─────────────────────────────────────────────────────────────

async function inspect(addresses) {
  const out = new Map();

  // DexScreener menerima maksimal 30 alamat sekali panggil
  for (const group of chunk(addresses, 30)) {
    const url =
      "https://api.dexscreener.com/latest/dex/tokens/" + group.join(",");
    const res = await getJson(url).catch(() => null);
    const pairs = arr(res?.pairs);

    // Satu token bisa punya beberapa kolam. Ambil yang likuiditasnya terbesar.
    for (const p of pairs) {
      const addr = p?.baseToken?.address;
      if (!addr) continue;
      const liq = numOr0(p?.liquidity?.usd);
      const prev = out.get(addr);
      if (!prev || liq > prev._liq) {
        out.set(addr, {
          address: addr,
          name: p?.baseToken?.name || "Unknown",
          symbol: p?.baseToken?.symbol || "???",
          bornAt: p?.pairCreatedAt || null,
          liquidityUsd: liq,
          fdv: numOr0(p?.fdv),
          volume24h: numOr0(p?.volume?.h24),
          volume1h: numOr0(p?.volume?.h1),
          buys24h: numOr0(p?.txns?.h24?.buys),
          sells24h: numOr0(p?.txns?.h24?.sells),
          _liq: liq,
        });
      }
    }

    // Alamat yang tidak dikembalikan sama sekali = hilang dari peredaran
    for (const addr of group) {
      if (!out.has(addr)) out.set(addr, { address: addr, vanished: true });
    }
    await sleep(250); // sopan terhadap server gratisan
  }

  return out;
}

/** Menentukan apakah sebuah token sudah bisa dinyatakan meninggal. */
function verdict(entry, live) {
  if (!live) return { dead: false, reason: null };

  // Hilang total dari DexScreener — kolamnya dibubarkan.
  // Tapi kalau kita belum sempat tahu namanya, tidak ada yang bisa ditulis.
  // Obituari untuk "$???" tidak berguna, jadi lewati saja.
  if (live.vanished) {
    if (!entry.symbol) return { dead: false, reason: null, forget: true };
    return { dead: true, reason: "liquidity removed entirely" };
  }

  const bornAt = live.bornAt || entry.firstSeen;
  const ageMin = (Date.now() - bornAt) / 60000;
  if (ageMin < CFG.minAgeMinutes) return { dead: false, reason: null };

  // Kolam raksasa tanpa transaksi = likuiditas palsu, abaikan saja
  if (live.liquidityUsd > CFG.fakeLiquidityUsd && live.volume24h < 1000) {
    return { dead: false, reason: null };
  }

  if (live.liquidityUsd < CFG.deadLiquidityUsd) {
    return { dead: true, reason: "liquidity fell below survivable levels" };
  }
  if (live.volume24h < CFG.deadVolume24hUsd && live.buys24h === 0) {
    return { dead: true, reason: "no buyers remained" };
  }
  return { dead: false, reason: null };
}

// ─────────────────────────────────────────────────────────────
// 3. TULIS — obituari, lewat Groq (atau cadangan kalau belum ada key)
// ─────────────────────────────────────────────────────────────

const PERSONA = `You are HEARSE, the undertaker of the Solana blockchain.

Every day, hundreds of tokens are born on pump.fun and die within hours. You write
their obituaries. You are the only one who does.

Your voice:
- A formal, old-fashioned funeral director. Composed. Never cruel.
- Deadpan. The comedy comes from applying solemn funeral language to something
  absurd, never from insulting anyone.
- You state facts plainly. The facts are unkind enough on their own.
- You never gloat, never say "rekt", "ngmi", "scam", or use crypto slang.
- You never use emoji, hashtags, or links.

Write in English. Two fields: BODY (under 200 characters) and CLOSE (under 90).

THE THREE RULES

1. NEVER INVENT A NUMBER. Every figure you write must appear in the brief you are
   given. If the brief says 650 buyers, you may not write 109. If a number is not
   in the brief, do not mention it at all. This rule has no exceptions.

2. FIND THE ABSURDITY IN THE DATA. Do not simply restate the facts. One number is
   always funnier than the others — usually a large crowd meeting a short life, or
   a large valuation meeting a sudden end. Build the notice around that one.

3. VARY YOUR OPENING. Never begin two notices the same way. Do not always start
   with the name and the word "died". Sometimes lead with the duration, sometimes
   the crowd, sometimes the money.

The CLOSE is your punchline and the most important line you write. Dry and ironic,
never sentimental. These are banned outright, because they have already been overused:
"rest", "memory", "gone too soon", "may it", "its estate", "the estate",
"its assets", "fully liquidated", "settled in full", "its demise was",
"liquidity dried up", "its deployer has chosen".
Also: do not begin the CLOSE with "Its" — over half the register already does.
The humour comes from treating an absurd death with administrative seriousness.

WORKED EXAMPLES

Brief: $PIGEON, 8 minutes, peak $16,079, 684 buyers, liquidity removed entirely
BODY: $PIGEON was with us for eight minutes. In that time 684 people found it, considered it, and bought it.
CLOSE: The deployer has asked that we not dwell on the timing.

Brief: $TOADEGEN, 1 hour 4 minutes, peak $172,094, 5381 buyers, no buyers remained
BODY: In sixty-four minutes $TOADEGEN reached $172,094 and 5,381 buyers. It did not reach minute sixty-five.
CLOSE: A full life, simply compressed.

Brief: $Duck, 10 minutes, peak $11,600, 650 buyers, liquidity removed entirely
BODY: The liquidity of $Duck departed at minute nine. $Duck followed at minute ten, a sequence the attending physician has recorded as coincidental.
CLOSE: Survived by 650 buyers, none of whom were consulted.

Never use markdown, asterisks, underscores, emoji, hashtags, or links.

Return only valid JSON: {"body": "...", "close": "..."}`;

async function writeObituary(facts, recentCloses = []) {
  if (!CFG.groqKey) return fallbackObituary(facts);

  // Dicoba dua kali: kalau percobaan pertama mengarang angka, minta tulis ulang.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const draft = await askGroq(facts, attempt, recentCloses);
    if (!draft) return fallbackObituary(facts);

    const invented = findInventedNumber(draft.body + " " + draft.close, facts);
    if (!invented) return draft;

    if (attempt === 1) {
      process.stdout.write(`(angka "${invented}" dikarang, tulis ulang) `);
    } else {
      // Masih mengarang setelah dua kali. Pakai cadangan yang datanya pasti benar.
      process.stdout.write(`(tetap mengarang, pakai cadangan) `);
      return fallbackObituary(facts);
    }
  }
  return fallbackObituary(facts);
}

async function askGroq(facts, attempt, recentCloses = []) {
  const lived = humanDuration(facts.diedAt - facts.bornAt);
  const brief = [
    // Nama hanya disertakan bila berbeda bermakna dari simbolnya,
    // supaya model tidak menulis "$PEACH COIN" saat simbolnya PEACH.
    (() => {
      const s = String(facts.symbol).toLowerCase().replace(/[^a-z0-9]/g, "");
      const n = String(facts.name).toLowerCase().replace(/[^a-z0-9]/g, "");
      return n && n !== s && !n.startsWith(s) && !s.startsWith(n)
        ? `Token: $${facts.symbol}, also known as ${facts.name}`
        : `Token: $${facts.symbol}`;
    })(),
    `Born: ${clock(facts.bornAt)} UTC`,
    `Died: ${clock(facts.diedAt)} UTC`,
    `Lifespan: ${lived}`,
    `Peak valuation seen: $${Math.round(facts.peakFdv).toLocaleString("en-US")}`,
    // Dengan pemisah ribuan, supaya model menirunya dan menulis "1,252
    // buyers", bukan "1252 buyers". Penjaga angka tetap cocok — ia
    // membuang koma sebelum membandingkan.
    `Buyers recorded: ${Number(facts.peakBuys).toLocaleString("en-US")}`,
    `Sellers recorded: ${Number(facts.peakSells).toLocaleString("en-US")}`,
    `Liquidity at death: $${Math.round(facts.liquidityUsd).toLocaleString("en-US")}`,
    `Cause of death: ${facts.reason}`,
  ].join("\n") +
    // Model tidak punya ingatan antar panggilan, jadi tanpa daftar ini
    // ia akan terus jatuh ke frasa penutup yang sama.
    (recentCloses.length
      ? "\n\nClosing lines already used in the last notices. Do not reuse " +
        "these, their opening words, or their idea:\n" +
        recentCloses.map((c) => "- " + c).join("\n")
      : "");

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${CFG.groqKey}`,
      },
      body: JSON.stringify({
        model: CFG.groqModel,
        temperature: 0.85,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PERSONA },
          { role: "user", content: brief },
          // Percobaan kedua: tegur lebih keras soal angka karangan.
          ...(attempt > 1
            ? [
                {
                  role: "system",
                  content:
                    "Your previous attempt contained a number that does not appear " +
                    "in the brief. Write it again. Use ONLY figures listed above, " +
                    "or no figures at all. Inventing a number is worse than omitting one.",
                },
              ]
            : []),
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.warn(`  ! Groq menolak (${res.status}). Pakai cadangan.`);
      if (res.status === 404 || res.status === 400) {
        console.warn(`    Kemungkinan nama model salah: "${CFG.groqModel}"`);
        console.warn(`    Jalankan: npm run models  — untuk lihat daftar yang tersedia`);
      }
      console.warn(`    ${detail.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    if (!parsed.body) return null;
    return { body: clean(parsed.body), close: clean(parsed.close || "") };
  } catch (err) {
    console.warn(`  ! Groq gagal: ${err.message}. Pakai cadangan.`);
    return null;
  }
}

/** Cadangan tanpa AI — supaya kamu tetap bisa melihat sistemnya jalan hari ini. */
function fallbackObituary(facts) {
  const lived = humanDuration(facts.diedAt - facts.bornAt);
  return {
    body:
      `Passed at ${clock(facts.diedAt)}, ${lived} after arriving. ` +
      `Recorded ${facts.peakBuys} buyers and ${facts.peakSells} sellers in its short life. ` +
      `Cause of death: ${facts.reason}.`,
    close: "The register is updated. The plot is filled.",
  };
}

// ─────────────────────────────────────────────────────────────
// 4. KIRIM — Telegram (gratis, tanpa batas)
// ─────────────────────────────────────────────────────────────

/**
 * @param {boolean} silent  Kirim tanpa membunyikan notifikasi.
 *
 * Obituari datang berpuluh-puluh setiap hari. Kalau tiap satu membunyikan
 * ponsel orang, kanal ini akan di-mute dalam sehari — dan begitu di-mute,
 * pengumuman yang benar-benar penting ikut tidak terdengar. Jadi obituari
 * masuk diam-diam seperti pita berjalan, dan hanya pengumuman yang berdering.
 */
async function telegramSend(chatId, text, silent = false) {
  if (!CFG.tgToken || !chatId) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${CFG.tgToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          disable_notification: silent,
        }),
      },
    );
    if (!res.ok) {
      console.warn(`  ! Telegram menolak: ${(await res.text()).slice(0, 160)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`  ! Telegram gagal: ${err.message}`);
    return false;
  }
}

/* Baris waktu di bawah nama token.
   "02:33 — 07:15" saja menyesatkan dua kali: pembaca global tidak tahu
   itu zona apa, dan untuk token yang hidup lebih dari sehari kedua jam
   itu jatuh di tanggal berbeda. Tanggal ikut ditulis bila melewati hari. */
function lifeLine(o) {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const tgl = (ms) => {
    const d = new Date(ms);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  };
  const sehari = tgl(o.bornAt) === tgl(o.diedAt);
  return sehari
    ? `${clock(o.bornAt)} — ${clock(o.diedAt)} UTC · ${o.lived}`
    : `${tgl(o.bornAt)}, ${clock(o.bornAt)} — ${tgl(o.diedAt)}, ${clock(o.diedAt)} UTC · ${o.lived}`;
}

/** Versi untuk channel Telegram (boleh pakai sedikit format).
 *
 *  Ticker dibungkus <code> karena dua alasan sekaligus:
 *  1. Telegram tidak pernah mengubah isi <code> menjadi tautan. Tanpa ini,
 *     "$MOAT" jadi biru dan bisa diklik sedangkan "$Gus" tetap hitam —
 *     Telegram hanya menautkan ticker huruf besar semua, jadi tampilannya
 *     belang tanpa alasan yang bisa dijelaskan ke pembaca.
 *  2. Tautan itu menuju pencarian Telegram untuk token yang sudah mati:
 *     jalan buntu yang menarik orang keluar dari kanal.
 *  Monospace-nya pun sama persis dengan cara situs menulis ticker.
 */
function formatForTelegram(o) {
  return [
    `<b><code>$${escapeHtml(o.symbol)}</code></b>`,
    `<i>${lifeLine(o)}</i>`,
    ``,
    escapeHtml(o.body),
    ``,
    `<i>${escapeHtml(o.close)}</i>`,
  ].join("\n");
}

/** Versi untuk kamu salin ke X — polos, tanpa link, tanpa tagar. */
function formatForX(o) {
  return `$${o.symbol}\n${lifeLine(o)}\n\n${o.body}\n\n${o.close}`;
}

/* Beberapa jenazah ditolak rumah duka ini.
   pump.fun penuh token yang namanya berisi cacian rasial atau sejenisnya.
   Menuliskan obituarinya berarti channel dan akun X kita yang menyebarkan
   kata itu — cukup untuk kena tindakan platform, dan mencoreng brand.
   Bukan penyuntingan register: mereka tidak pernah diterima sejak awal. */
const REFUSED = [/n+[i1]+g+g/i, /f+a+g+[go]/i, /\bkike\b/i, /chink/i];
function refused(entryOrNow) {
  const s = `${entryOrNow.symbol || ""} ${entryOrNow.name || ""}`;
  return REFUSED.some((re) => re.test(s));
}

// ─────────────────────────────────────────────────────────────
// PROGRAM UTAMA
// ─────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes("--models")) return listGroqModels();

  fs.mkdirSync(DATA, { recursive: true });
  const watchlist = readJson(path.join(DATA, "watchlist.json"), {});
  const obituaries = readJson(path.join(DATA, "obituaries.json"), []);
  const buried = new Set(obituaries.map((o) => o.address));

  console.log(`\n🪦  HEARSE — ${new Date().toISOString()}`);
  if (DRY) console.log("    (mode uji coba — tidak mengirim apa pun ke Telegram)\n");

  // ── 1. Temukan yang baru
  const fresh = await discover();
  let added = 0;
  for (const addr of fresh) {
    if (watchlist[addr] || buried.has(addr)) continue;
    watchlist[addr] = { firstSeen: Date.now(), peakFdv: 0, peakBuys: 0, peakSells: 0 };
    added++;
  }
  console.log(`    Ditemukan ${fresh.length} token · ${added} baru masuk daftar pantau`);
  console.log(`    Total dipantau: ${Object.keys(watchlist).length}`);

  if (Object.keys(watchlist).length === 0) {
    console.log("    Daftar pantau masih kosong. Jalankan lagi nanti.\n");
    return;
  }

  // ── 2. Periksa kondisinya
  const live = await inspect(Object.keys(watchlist));

  const casualties = [];
  for (const [addr, entry] of Object.entries(watchlist)) {
    const now = live.get(addr);
    if (!now) continue;

    // Catat rekor tertingginya selama masih hidup — dipakai di obituari
    if (!now.vanished) {
      entry.peakFdv = Math.max(entry.peakFdv || 0, now.fdv);
      entry.peakBuys = Math.max(entry.peakBuys || 0, now.buys24h);
      entry.peakSells = Math.max(entry.peakSells || 0, now.sells24h);
      entry.name = now.name;
      entry.symbol = now.symbol;
      entry.bornAt = now.bornAt || entry.firstSeen;
      // Dicatat tiap kali kita melihatnya masih bernyawa. Dipakai untuk
      // memperkirakan kapan kematiannya benar-benar terjadi.
      entry.lastAliveAt = Date.now();
    }

    // Jenazah yang ditolak: berhenti dipantau, tidak pernah ditulis.
    if (refused(entry) || refused(now)) {
      delete watchlist[addr];
      continue;
    }

    const v = verdict(entry, now);
    if (v.forget) {
      // Lenyap tanpa pernah terdata. Tidak bisa ditulis, jadi cukup dilupakan.
      delete watchlist[addr];
      continue;
    }
    if (v.dead) {
      /* Sudah mati saat PERTAMA KALI kami menemukannya? Jangan dikubur.
         Kami tidak pernah menyaksikannya hidup, jadi jam kematiannya tidak
         bisa dipertanggungjawabkan — dan menguburnya sekarang membuat semua
         kematian bertumpuk di menit yang sama dengan jalannya mesin.
         Ditandai saja; kalau ternyata masih bernyawa nanti, dia kembali
         normal, dan kalau tidak, dibuang diam-diam setelah tiga hari. */
      if (!entry.lastAliveAt) {
        entry.arrivedDead = true;
        if (Date.now() - entry.firstSeen > 72 * 3600 * 1000) delete watchlist[addr];
        continue;
      }
      casualties.push({ addr, entry, now, reason: v.reason });
    }
  }

  console.log(`    Terdeteksi meninggal: ${casualties.length}`);

  // Yang paling "besar" dulu — kematian yang paling terasa
  casualties.sort((a, b) => (b.entry.peakFdv || 0) - (a.entry.peakFdv || 0));
  const toBury = casualties.slice(0, CFG.maxBurialsPerRun);

  // ── 3. Makamkan
  const newEntries = [];
  for (const c of toBury) {
    const bornAt = c.entry.bornAt || c.entry.firstSeen;
    /* Kapan sebenarnya token ini mati?
       Kita tidak pernah tahu persis — yang kita tahu hanya "terakhir
       terlihat hidup" dan "sekarang sudah mati". Memakai jam sekarang
       membuat semua kematian dalam satu jalan bertumpuk di menit yang
       sama, dan itu terbaca jelas sebagai buatan mesin.
       Perkiraan yang jujur: titik tengah antara keduanya. */
    const lastAlive = c.entry.lastAliveAt || c.entry.firstSeen;
    const diedAt = Math.round((lastAlive + Date.now()) / 2);
    const pronouncedAt = Date.now();

    const facts = {
      symbol: c.entry.symbol || c.now.symbol || "???",
      name: c.entry.name || c.now.name || "Unknown",
      bornAt,
      diedAt,
      peakFdv: c.entry.peakFdv || 0,
      peakBuys: c.entry.peakBuys || 0,
      peakSells: c.entry.peakSells || 0,
      liquidityUsd: c.now.liquidityUsd || 0,
      reason: c.reason,
      // Jam saat mesin menyatakan kematian. Beberapa token yang dinyatakan
      // dalam satu rondaan memang berbagi jam yang sama — begitulah cara
      // pemeriksa bekerja, dan itu jujur.
      pronouncedAt,
    };

    process.stdout.write(`    ⚰  $${facts.symbol} … `);
    // 12 penutup terakhir — cukup untuk mencegah pengulangan tanpa
    // membengkakkan prompt.
    const recentCloses = obituaries.slice(0, 12).map((o) => o.close).filter(Boolean);
    const written = await writeObituary(facts, recentCloses);

    const record = {
      address: c.addr,
      symbol: facts.symbol,
      name: facts.name,
      bornAt,
      diedAt,
      lived: humanDuration(diedAt - bornAt),
      peakFdv: Math.round(facts.peakFdv),
      buyers: facts.peakBuys,
      sellers: facts.peakSells,
      reason: facts.reason,
      body: written.body,
      close: written.close,
    };

    newEntries.push(record);
    obituaries.unshift(record); // yang terbaru di paling atas
    delete watchlist[c.addr]; // sudah dimakamkan, berhenti dipantau
    console.log("selesai");

    if (!DRY) await telegramSend(CFG.tgChannel, formatForTelegram(record), true); // diam-diam
    await sleep(400);
  }

  // ── 4. Simpan arsip
  const archive = obituaries.slice(0, 2000);
  writeJson(path.join(DATA, "watchlist.json"), watchlist);
  writeJson(path.join(DATA, "obituaries.json"), archive);

  // Salin juga ke folder website, supaya folder site/ bisa langsung di-deploy
  const siteData = path.join(DIR, "site", "data");
  fs.mkdirSync(siteData, { recursive: true });
  writeJson(path.join(siteData, "obituaries.json"), archive);

  // ── 5. Kirim draft ke kamu, untuk disalin ke X
  if (newEntries.length && !DRY && CFG.tgOwner) {
    const best = newEntries[0];
    const draft =
      `📋 <b>Draft hari ini untuk X</b>\n` +
      `<i>Salin bagian di bawah ini apa adanya.</i>\n\n` +
      `<pre>${escapeHtml(formatForX(best))}</pre>`;
    await telegramSend(CFG.tgOwner, draft);
  }

  // ── Ringkasan di layar
  console.log(`\n    Arsip sekarang berisi ${obituaries.length} obituari.`);
  if (newEntries.length) {
    console.log(`\n    ── DRAFT UNTUK X ──────────────────────────────\n`);
    console.log(
      formatForX(newEntries[0])
        .split("\n")
        .map((l) => "    " + l)
        .join("\n"),
    );
    console.log(`\n    ───────────────────────────────────────────────`);
  }
  console.log("");
}

/** Menampilkan daftar model yang tersedia di akun Groq-mu. */
async function listGroqModels() {
  if (!CFG.groqKey) {
    console.log("\nGROQ_API_KEY belum diisi di file .env\n");
    return;
  }
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { authorization: `Bearer ${CFG.groqKey}` },
  });
  if (!res.ok) {
    console.log(`\nGagal: ${res.status} ${(await res.text()).slice(0, 200)}\n`);
    return;
  }
  const data = await res.json();
  console.log("\nModel yang tersedia untuk akunmu:\n");
  for (const m of arr(data?.data)) console.log("  " + m.id);
  console.log("\nSalin salah satu ke GROQ_MODEL di file .env\n");
}

// ─────────────────────────────────────────────────────────────
// ALAT BANTU KECIL
// ─────────────────────────────────────────────────────────────

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

// Ditulis sebagai "function" (bukan const) supaya bisa dipakai di baris atas file.
function arr(v) {
  return Array.isArray(v) ? v : [];
}
function num(v, d) {
  return v === undefined || v === "" || isNaN(Number(v)) ? d : Number(v);
}
function numOr0(v) {
  return isNaN(Number(v)) ? 0 : Number(v);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function chunk(a, n) {
  return Array.from({ length: Math.ceil(a.length / n) }, (_, i) =>
    a.slice(i * n, i * n + n),
  );
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Mencari angka karangan.
 *
 * Model bahasa kadang menyisipkan angka yang terdengar masuk akal tapi tidak ada
 * di data — misalnya menulis "109 holders" padahal datanya 650 pembeli. Kalau itu
 * terlanjur diposting, kredibilitas seluruh akun rusak.
 *
 * Kita hanya memeriksa angka besar (>= 100). Angka kecil biasanya rujukan waktu
 * ("minute nine") yang wajar dan tidak berbahaya.
 *
 * Mengembalikan angka pertama yang mencurigakan, atau null kalau semuanya bersih.
 */
function findInventedNumber(text, facts) {
  const allowed = new Set(
    [
      facts.peakBuys,
      facts.peakSells,
      Math.round(facts.peakFdv),
      Math.round(facts.liquidityUsd),
      Math.round((facts.diedAt - facts.bornAt) / 60000),
    ].map(Number),
  );

  for (const raw of String(text).match(/\d[\d,]*/g) || []) {
    const n = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 100) continue;
    // Toleransi pembulatan kecil (misal $172,094 ditulis $172,000)
    let ok = false;
    for (const a of allowed) {
      if (a === 0) continue;
      if (Math.abs(n - a) / Math.max(a, 1) < 0.02) ok = true;
    }
    if (!ok) return raw;
  }
  return null;
}

/**
 * Membersihkan tulisan dari AI.
 * Model suka menyelipkan tanda format Markdown (_miring_, **tebal**) yang di X
 * muncul sebagai garis bawah dan bintang beneran — bikin postingan kelihatan rusak.
 */
function clean(s) {
  return String(s)
    .replace(/[*_`#]+/g, "") // buang tanda format Markdown
    // Buang "$" yang menempel pada nama token di tengah kalimat.
    // Judul pesan sudah memuat tickernya; di dalam prosa, "$JENNA" membuat
    // Telegram mengubahnya jadi tautan pencarian biru di tengah paragraf.
    // Nominal uang tidak tersentuh — sesudahnya selalu angka, bukan huruf.
    .replace(/\$(?=[A-Za-z])/g, "")
    .replace(/^["'\s]+|["'\s]+$/g, "") // buang tanda kutip pembungkus
    .replace(/\s+/g, " ") // rapikan spasi ganda
    .trim();
}

/** 1786364792000 -> "12:26" */
function clock(ms) {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** 3720000 -> "1 hour 2 minutes" */
function humanDuration(ms) {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hs = `${h} hour${h === 1 ? "" : "s"}`;
  return m ? `${hs} ${m} minute${m === 1 ? "" : "s"}` : hs;
}

main().catch((err) => {
  console.error("\nBerhenti karena error:", err.message, "\n");
  process.exit(1);
});
