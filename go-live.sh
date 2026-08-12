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
if [ -z "$CA" ]; then
  echo "Pakai: ./go-live.sh <CONTRACT_ADDRESS>" >&2
  exit 1
fi

# Alamat Solana: 32–44 huruf/angka, tanpa 0 O I l. Menahan salah tempel.
if ! printf '%s' "$CA" | grep -Eq '^[1-9A-HJ-NP-Za-km-z]{32,44}$'; then
  echo "❌ \"$CA\" bukan bentuk alamat Solana yang sah — tidak jadi diterbitkan." >&2
  exit 1
fi

URL="https://pump.fun/coin/${CA}"

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
