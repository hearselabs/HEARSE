#!/usr/bin/env bash
# Memotret situs LIVE untuk aset tweet 4.
#
#   ./ss.sh
#
# Kenapa ada skrip ini: tangkapan layar yang dibuat kemarin sudah basi hari ini
# (jumlah obituari terus naik), dan memotret manual gampang meleset — teks
# kepotong, atau animasi muncul-saat-digulir belum sempat jalan sehingga
# isinya masih transparan.
#
# Jalankan tepat sebelum memposting tweet 4. Angkanya akan sesuai detik itu.
set -euo pipefail
cd "$(dirname "$0")"

node - <<'JS'
import { chromium } from "/Users/mymac/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs";

const KELUAR = "launch-kit-hearse/assets/04-register-site.png";
const b = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
// deviceScaleFactor 2 supaya tulisannya tetap tajam saat X mengecilkannya
const p = await b.newPage({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
});

await p.goto("https://hearsefun.xyz/", { waitUntil: "networkidle" });

// Tunggu arsip benar-benar termuat — jangan memotret daftar kosong
await p.waitForFunction(
  () => document.querySelectorAll("#feed .obit").length > 2,
  null,
  { timeout: 30000 },
);

// Gulir sampai ke bawah lalu balik: memicu semua animasi muncul-saat-digulir,
// supaya tidak ada blok yang tertangkap dalam keadaan setengah transparan.
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(1600);

// Bingkai pada seksi register — pencarian, jumlah catatan, dan pemakaman terbaru.
// Itu yang membuktikan isi tweetnya: publik, bisa dicari, permanen.
await p.evaluate(() => {
  const t = document.getElementById("featured-slot") ||
            document.querySelector("#feed");
  const y = t.getBoundingClientRect().top + window.scrollY;
  window.scrollTo(0, y - 190);           // beri ruang untuk judul seksi di atasnya
});
await p.waitForTimeout(1400);

// Matikan animasi yang masih berjalan supaya tidak ada yang buram
await p.addStyleTag({
  content: `*,*::before,*::after{animation:none !important;transition:none !important}
            .rv{opacity:1 !important;transform:none !important}`,
});
await p.waitForTimeout(300);

await p.screenshot({ path: KELUAR });

const n = await p.evaluate(() =>
  document.getElementById("reg-count")?.textContent || "?");
console.log(`  ✅ ${KELUAR}`);
console.log(`     dari hearsefun.xyz — ${n} saat dipotret`);
await b.close();
JS

sips -g pixelWidth -g pixelHeight launch-kit-hearse/assets/04-register-site.png 2>/dev/null \
  | tail -2 | sed 's/^/    /'
echo "     siap dilampirkan ke tweet 4."
