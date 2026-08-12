#!/usr/bin/env bash
# Memotret situs LIVE untuk aset tweet 4.
#
#   ./ss.sh
#
# Yang dipotret adalah HERO situs — judul, tagline, lencana pemantauan,
# dan dua tombolnya. Sengaja BUKAN daftar register: isi register berubah
# tiap ada token mati, jadi tangkapan daftarnya pasti sudah beda dengan
# yang dilihat orang saat mereka membuka situsnya. Hero tidak pernah
# berubah — fotonya tidak bisa basi.
#
# Countdown sengaja di luar bingkai: setelah hari-H ia berganti tampilan,
# dan foto yang memuatnya ikut kedaluwarsa.
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
  viewport: { width: 1600, height: 775 },
  deviceScaleFactor: 2,
});

await p.goto("https://hearsefun.xyz/", { waitUntil: "networkidle" });
await p.waitForTimeout(2200);            // biarkan grid & denyut hero selesai masuk

// Pastikan tetap di puncak halaman, lalu bekukan animasi supaya tidak buram
await p.evaluate(() => window.scrollTo(0, 0));
await p.addStyleTag({
  content: `*,*::before,*::after{animation:none !important;transition:none !important}`,
});
await p.waitForTimeout(300);

// Countdown tidak boleh ikut — periksa, jangan cuma berharap
const adaCountdown = await p.evaluate(() => {
  const c = document.getElementById("countdown");
  if (!c) return false;
  const r = c.getBoundingClientRect();
  return r.top < innerHeight - 40;
});
if (adaCountdown) {
  console.log("  ⚠ countdown masuk bingkai — tinggi bingkai perlu dikurangi");
}

await p.screenshot({ path: KELUAR });
console.log(`  ✅ ${KELUAR}`);
console.log("     hero hearsefun.xyz — bingkai yang tidak pernah basi");
await b.close();
JS

sips -g pixelWidth -g pixelHeight launch-kit-hearse/assets/04-register-site.png 2>/dev/null \
  | tail -2 | sed 's/^/    /'
echo "     siap dilampirkan ke tweet 4."
