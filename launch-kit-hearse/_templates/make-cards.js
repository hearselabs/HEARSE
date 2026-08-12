/**
 * Pembuat aset visual tweet.
 * Semua angka diambil dari data/obituaries.json — tidak ada yang dikarang.
 * Jalankan:  node _templates/make-cards.js
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..");
const ROOT = path.join(KIT, "..");
const OUT = path.join(KIT, "assets");
const TMP = path.join(HERE, "_render");

const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const all = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "obituaries.json"), "utf8"),
);

const pick = (sym) => all.find((o) => o.symbol === sym);
const clock = (ms) => {
  const d = new Date(ms);
  return String(d.getUTCHours()).padStart(2, "0") + ":" +
         String(d.getUTCMinutes()).padStart(2, "0");
};
const n = (v) => Math.round(v).toLocaleString("en-US");

/* ── Bahan bersama ───────────────────────────────────────── */
const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:675px;overflow:hidden;
     font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif}
.card{width:1200px;height:675px;background:#08090D;color:#E8EAED;
      position:relative;overflow:hidden;padding:70px 78px;
      display:flex;flex-direction:column}
.grid{position:absolute;inset:0;
      background-image:linear-gradient(#14171D 1px,transparent 1px),
                       linear-gradient(90deg,#14171D 1px,transparent 1px);
      background-size:60px 60px;
      -webkit-mask-image:radial-gradient(ellipse 110% 85% at 50% 0%,black 15%,transparent 78%)}
.glow{position:absolute;left:50%;top:-160px;width:1100px;height:640px;
      transform:translateX(-50%);
      background:radial-gradient(ellipse,rgba(229,72,77,.12),transparent 62%)}
.inner{position:relative;flex:1;display:flex;flex-direction:column}
.brandrow{display:flex;align-items:center;gap:14px;margin-bottom:auto}
.bmark{width:34px;height:34px}
.bname{font-family:ui-monospace,'SF Mono',Menlo,monospace;
       font-size:20px;font-weight:700;letter-spacing:.24em}
.tag{margin-left:auto;font-family:ui-monospace,'SF Mono',Menlo,monospace;
     font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:#575D68}
.foot{position:relative;display:flex;justify-content:space-between;align-items:flex-end;
      font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:17px;letter-spacing:.1em}
.dom{color:#E5484D}
.fmeta{color:#575D68;text-align:right}
.mono{font-family:ui-monospace,'SF Mono',Menlo,monospace}
.serif{font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif}
`;

const MARK = `<svg class="bmark" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M3 14 L8 14 L10 7 L13 18 L15 11 L17 14 L21 14" stroke="#E5484D" stroke-width="2.1"
stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const shell = (tag, body, foot) => `<!doctype html><meta charset=utf-8><style>${CSS}</style>
<div class="card"><div class="grid"></div><div class="glow"></div>
<div class="inner">
  <div class="brandrow">${MARK}<span class="bname">HEARSE</span><span class="tag">${tag}</span></div>
  ${body}
</div>
<div class="foot"><span class="dom">hearsefun.xyz</span><span class="fmeta">${foot}</span></div>
</div>`;

/* ── Kartu obituari (satu token) ─────────────────────────── */
function obitCard(sym, tag) {
  const o = pick(sym);
  if (!o) throw new Error("tidak ada di arsip: " + sym);
  return shell(
    tag,
    `<div style="margin:44px 0 auto">
      <div class="mono" style="font-size:74px;font-weight:700;letter-spacing:-.02em">$${o.symbol}</div>
      <div class="mono" style="font-size:22px;color:#575D68;letter-spacing:.08em;margin-top:14px">
        ${clock(o.bornAt)} — ${clock(o.diedAt)} UTC &nbsp;·&nbsp; ${o.lived}
      </div>
      <div style="height:1px;background:#1C2027;margin:38px 0 34px"></div>
      <div style="display:flex;gap:74px">
        <div><div class="mono" style="font-size:13px;letter-spacing:.18em;color:#575D68;text-transform:uppercase">Buyers</div>
             <div class="mono" style="font-size:40px;font-weight:700;margin-top:8px">${n(o.buyers)}</div></div>
        <div><div class="mono" style="font-size:13px;letter-spacing:.18em;color:#575D68;text-transform:uppercase">Peak value</div>
             <div class="mono" style="font-size:40px;font-weight:700;margin-top:8px">$${n(o.peakFdv)}</div></div>
        <div><div class="mono" style="font-size:13px;letter-spacing:.18em;color:#575D68;text-transform:uppercase">Cause of death</div>
             <div class="serif" style="font-size:26px;font-style:italic;margin-top:12px;color:#8B919C;max-width:330px;line-height:1.35">${o.reason}</div></div>
      </div>
    </div>`,
    "INTERRED &nbsp;·&nbsp; SOLANA",
  );
}

/* ── Kartu angka besar (statistik register) ──────────────── */
function statCard({ tag, big, label, sub, foot }) {
  return shell(
    tag,
    `<div style="margin:auto 0;text-align:left">
      <div class="mono" style="font-size:${big.length > 9 ? 108 : 132}px;font-weight:800;
           letter-spacing:-.04em;line-height:1;color:#E5484D">${big}</div>
      <div class="mono" style="font-size:19px;letter-spacing:.22em;text-transform:uppercase;
           color:#575D68;margin-top:26px">${label}</div>
      <div class="serif" style="font-size:31px;font-style:italic;color:#8B919C;
           margin-top:30px;max-width:800px;line-height:1.45">${sub}</div>
    </div>`,
    foot,
  );
}

/* ── Kartu kutipan (kalimat penutup obituari) ────────────── */
function quoteCard({ tag, quote, attrib, foot }) {
  return shell(
    tag,
    `<div style="margin:auto 0">
      <div class="serif" style="font-size:56px;font-style:italic;line-height:1.32;
           max-width:930px;text-wrap:balance">${quote}</div>
      <div class="mono" style="font-size:18px;letter-spacing:.16em;color:#575D68;
           margin-top:44px;text-transform:uppercase">${attrib}</div>
    </div>`,
    foot,
  );
}

/* ── Kartu dua angka bersanding (mis. beli vs jual) ──────── */
function pairCard({ tag, aVal, aLab, bVal, bLab, sub, foot }) {
  const kolom = (v, l, warna) =>
    `<div style="flex:1">
       <div class="mono" style="font-size:13px;letter-spacing:.2em;color:#575D68;
            text-transform:uppercase">${l}</div>
       <div class="mono" style="font-size:82px;font-weight:800;letter-spacing:-.035em;
            line-height:1.05;margin-top:12px;color:${warna}">${v}</div>
     </div>`;
  return shell(
    tag,
    `<div style="margin:auto 0">
      <div style="display:flex;gap:60px;align-items:flex-start">
        ${kolom(aVal, aLab, "#E8EAED")}
        ${kolom(bVal, bLab, "#E8EAED")}
      </div>
      <div style="height:1px;background:#1C2027;margin:40px 0 32px"></div>
      <div class="serif" style="font-size:33px;font-style:italic;color:#8B919C;
           max-width:900px;line-height:1.42">${sub}</div>
    </div>`,
    foot,
  );
}

/* ── Kartu rincian (sebab kematian) ──────────────────────── */
function breakdownCard({ tag, title, rows, sub, foot }) {
  const baris = rows.map((r) =>
    `<div style="display:flex;align-items:baseline;gap:22px;margin-top:22px">
       <div class="mono" style="font-size:52px;font-weight:800;color:#E5484D;
            min-width:96px;letter-spacing:-.03em">${r[1]}</div>
       <div class="serif" style="font-size:31px;color:#C6CAD1">${r[0]}</div>
     </div>`).join("");
  return shell(
    tag,
    `<div style="margin:34px 0 auto">
      <div class="mono" style="font-size:16px;letter-spacing:.22em;color:#575D68;
           text-transform:uppercase">${title}</div>
      ${baris}
      <div style="height:1px;background:#1C2027;margin:38px 0 26px"></div>
      <div class="serif" style="font-size:30px;font-style:italic;color:#8B919C;
           max-width:880px;line-height:1.4">${sub}</div>
    </div>`,
    foot,
  );
}

/* ── Kartu peluncuran ────────────────────────────────────── */
function launchCard({ tag, kicker, big, sub, foot }) {
  return shell(
    tag,
    `<div style="margin:auto 0">
      <div class="mono" style="font-size:19px;letter-spacing:.24em;text-transform:uppercase;
           color:#E5484D">${kicker}</div>
      <div style="font-size:100px;font-weight:750;letter-spacing:-.035em;line-height:1;
           margin-top:26px;text-wrap:balance">${big}</div>
      <div class="serif" style="font-size:31px;font-style:italic;color:#8B919C;
           margin-top:32px;max-width:820px;line-height:1.45">${sub}</div>
    </div>`,
    foot,
  );
}

/* ═══ Daftar aset — nomor mengikuti urutan tweet ═══════════ */
/* Angka gabungan. Sengaja TIDAK ada kartu yang menyebut ticker orang lain:
   di X, HEARSE bicara dengan angkanya sendiri. Nama-namanya ada di register
   dan di channel Telegram — mengulanginya di X hanya mengiklankan koin orang. */
const totalPeak   = all.reduce((s, o) => s + o.peakFdv, 0);
const totalBuyers = all.reduce((s, o) => s + o.buyers, 0);
const totalSellers = all.reduce((s, o) => s + (o.sellers || 0), 0);

const umur = all.map((o) => o.diedAt - o.bornAt)
  .filter((x) => x > 0 && x < 30 * 86400000).sort((a, b) => a - b);
const median = umur[Math.floor(umur.length / 2)];
const jamMenit = (ms) =>
  Math.floor(ms / 3600000) + "h " + Math.round(ms % 3600000 / 60000) + "m";
const terpendek = Math.round(umur[0] / 60000);
const terbesar = [...all].sort((a, b) => b.peakFdv - a.peakFdv)[0];

const sebab = {};
all.forEach((o) => { sebab[o.reason] = (sebab[o.reason] || 0) + 1; });
const sebabUrut = Object.entries(sebab).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v]);

const CARDS = [
  ["01-register-open", statCard({
    tag: "the register", big: String(all.length), label: "interred to date",
    sub: "Every one of them arrived with a promise. None of them had anyone to say a few words.",
    foot: "AUTONOMOUS UNDERTAKER",
  })],

  ["03-ledger-gap", pairCard({
    tag: "the ledger",
    aVal: n(totalBuyers), aLab: "purchases recorded",
    bVal: n(totalSellers), bLab: "sales recorded",
    sub: `A difference of ${n(totalBuyers - totalSellers)}. That difference did not get out.`,
    foot: "THE REGISTER &nbsp;·&nbsp; HEARSEFUN.XYZ",
  })],

  ["05-lifespan", statCard({
    tag: "mortality", big: jamMenit(median), label: "median lifespan",
    sub: `The shortest lived ${terpendek} minutes. It still found buyers.`,
    foot: `ACROSS ${all.length} NOTICES`,
  })],

  ["07-value-buried", statCard({
    tag: "the ledger", big: "$" + n(totalPeak), label: "buried, at peak value",
    sub: `Present value of all of it: nothing. Collected in ${
      Math.max(1, Math.round((Date.now() - Math.min(...all.map((o) => o.diedAt))) / 86400000))
    } days.`,
    foot: "THE REGISTER &nbsp;·&nbsp; HEARSEFUN.XYZ",
  })],

  ["09-largest-estate", statCard({
    tag: "case file", big: "$" + n(terbesar.peakFdv), label: "largest estate handled",
    sub: `It was ${terbesar.lived} old. I do not print names out here — they are all in the register.`,
    foot: "NAME WITHHELD &nbsp;·&nbsp; HEARSEFUN.XYZ",
  })],

  ["11-quote", quoteCard({
    tag: "from the register",
    quote: "&ldquo;Financial obligations to its buyers were apparently not a surviving concern.&rdquo;",
    attrib: "closing line — recorded, not invented",
    foot: "HEARSE",
  })],

  ["13-causes", breakdownCard({
    tag: "post-mortem", title: `Cause of death · all ${all.length} notices`,
    rows: sebabUrut,
    sub: "There is no third category. Nothing here has ever died of old age.",
    foot: "HEARSEFUN.XYZ",
  })],

  ["16-scheduled", launchCard({
    tag: "scheduled", big: "The parlour opens.",
    sub: "13 August, 14:00 UTC. The register has been open for days. The instrument arrives last.",
    foot: "$HEARSE &nbsp;·&nbsp; SOLANA &nbsp;·&nbsp; PUMP.FUN",
  })],

  ["18-live", launchCard({
    tag: "now live", big: "$HEARSE",
    sub: "The undertaker is open for business. Contract address in the replies.",
    foot: "PUMP.FUN &nbsp;·&nbsp; SOLANA",
  })],
];

/* ── Render ──────────────────────────────────────────────── */
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

for (const [name, html] of CARDS) {
  const f = path.join(TMP, name + ".html");
  fs.writeFileSync(f, html);
  execFileSync(CHROME, [
    "--headless", "--disable-gpu", "--hide-scrollbars",
    "--screenshot=" + path.join(OUT, name + ".png"),
    "--window-size=1200,675",
    "file://" + f,
  ], { stdio: "ignore" });
  const kb = Math.round(fs.statSync(path.join(OUT, name + ".png")).size / 1024);
  console.log("  ✅ " + name + ".png  (" + kb + " KB)");
}
console.log("\n  " + CARDS.length + " kartu dibuat di launch-kit-hearse/assets/");
