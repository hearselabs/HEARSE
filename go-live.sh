#!/usr/bin/env bash
# Menerbitkan contract address ke situs.
#
#   ./go-live.sh <CONTRACT_ADDRESS>
#
# Hanya menyentuh satu berkas kecil (site/live.json), jadi tidak ada
# pembangunan ulang situs yang perlu ditunggu. Halaman yang sudah terbuka
# di layar orang akan berganti sendiri dalam hitungan detik.
set -euo pipefail
cd "$(dirname "$0")"

CA="${1:-}"
LATIHAN=""
if [ "${2:-}" = "--latihan" ] || [ "${1:-}" = "--latihan" ]; then
  LATIHAN="ya"
  [ "${1:-}" = "--latihan" ] && CA="${2:-}"
fi

if [ -z "$CA" ]; then
  echo "Pakai: ./go-live.sh <CONTRACT_ADDRESS>" >&2
  echo "Latihan (tidak menyentuh situs): ./go-live.sh <CA> --latihan" >&2
  exit 1
fi

# Alamat Solana: 32–44 huruf/angka, tanpa 0 O I l. Menahan salah tempel.
if ! printf '%s' "$CA" | grep -Eq '^[1-9A-HJ-NP-Za-km-z]{32,44}$'; then
  echo "❌ \"$CA\" bukan bentuk alamat Solana yang sah — tidak jadi diterbitkan." >&2
  exit 1
fi

URL="https://pump.fun/coin/${CA}"

if [ -n "$LATIHAN" ]; then
  echo ""
  echo "  🧪 MODE LATIHAN — situs sungguhan TIDAK disentuh."
  echo ""
  echo "  Alamat lolos pemeriksaan bentuk."
  echo "  Kalau ini sungguhan, isi berkasnya jadi:"
  echo ""
  node -e 'console.log(JSON.stringify({ca:process.argv[1],pumpfun:process.argv[2]},null,2).split("\n").map(l=>"      "+l).join("\n"))' "$CA" "$URL"
  echo ""
  echo "  lalu di-push, dan situs berganti dalam ±2 detik."
  echo ""
  echo "  Kalau kamu melihat pesan ini, kamu sudah bisa menjalankannya besok."
  echo "  Untuk sungguhan, jalankan perintah yang sama TANPA --latihan."
  exit 0
fi

node -e '
  const fs = require("fs");
  const isi = { ca: process.argv[1], pumpfun: process.argv[2] };
  const teks = JSON.stringify(isi, null, 2) + "\n";
  JSON.parse(teks);                       // pastikan sah sebelum ditulis
  fs.writeFileSync("site/live.json", teks);
' "$CA" "$URL"

git add site/live.json
git commit -q -m "live: \$HEARSE contract published"
git push -q origin main

echo ""
echo "  ✅ TERBIT"
echo "     CA   $CA"
echo "     Beli $URL"
echo ""
echo "  Situs berganti sendiri dalam beberapa detik — tidak perlu di-refresh."
echo "  Periksa: https://hearsefun.xyz"
