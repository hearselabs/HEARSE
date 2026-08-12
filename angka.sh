#!/usr/bin/env bash
# Menyegarkan angka sebelum kamu memposting.
#
#   ./angka.sh
#
# Mesin memakamkan token terus-menerus, jadi angka di tweet yang ditulis
# kemarin sudah ketinggalan hari ini. Perintah ini mencetak angka terbaru
# DAN menggambar ulang semua kartu tweetnya.
set -euo pipefail
cd "$(dirname "$0")"

git pull -q --rebase origin main 2>/dev/null || true

node -e '
const a = require("./data/obituaries.json");
const n = (v) => Math.round(v).toLocaleString("en-US");
const eja = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
  "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const puluh = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function kata(x) {
  if (x < 20) return eja[x];
  if (x < 100) return puluh[Math.floor(x / 10)] + (x % 10 ? "-" + eja[x % 10] : "");
  return String(x);
}
const peak = a.reduce((s, o) => s + o.peakFdv, 0);
const buy  = a.reduce((s, o) => s + o.buyers, 0);
const sell = a.reduce((s, o) => s + (o.sellers || 0), 0);
const umur = a.map(o => o.diedAt - o.bornAt).filter(x => x > 0 && x < 30 * 86400000).sort((x, y) => x - y);
const med  = umur[Math.floor(umur.length / 2)];
const besar = [...a].sort((x, y) => y.peakFdv - x.peakFdv)[0];
const seb = {};
a.forEach(o => { seb[o.reason] = (seb[o.reason] || 0) + 1; });

const L = (k, v) => console.log("  " + k.padEnd(26) + v);
console.log("");
console.log("  ANGKA TERBARU — pakai ini, ganti yang di tweet");
console.log("  " + "─".repeat(52));
L("tweet 1  jumlah", kata(a.length).replace(/^./, c => c.toUpperCase()) + "  (" + a.length + ")");
L("tweet 1 & 7  nilai puncak", "$" + n(peak));
L("tweet 3  pembelian", n(buy));
L("tweet 3  penjualan", n(sell));
L("tweet 3  selisih", n(buy - sell));
L("tweet 5  umur median", Math.floor(med / 3600000) + " hours, " + Math.round(med % 3600000 / 60000) + " minutes");
L("tweet 5  terpendek", Math.round(umur[0] / 60000) + " minutes");
L("tweet 9  berkas terbesar", "$" + n(besar.peakFdv) + " — " + besar.lived);
L("tweet 13  jumlah", kata(a.length));
Object.entries(seb).sort((x, y) => y[1] - x[1])
  .forEach(([k, v]) => L("tweet 13  " + k.slice(0, 22), String(v)));
console.log("");
'

echo "  Menggambar ulang kartu tweet dengan angka ini…"
node launch-kit-hearse/_templates/make-cards.js | sed 's/^/  /'
echo "  Selesai. Buka launch-kit-hearse/index.html, ganti angkanya, baru posting."
