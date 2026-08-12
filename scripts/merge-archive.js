/**
 * Penggabung arsip — dipakai saat git gagal menggabungkan sendiri.
 *
 * Masalahnya: mesin (GitHub Actions) dan manusia sama-sama menambah entri
 * ke ujung array yang sama. Git melihatnya sebagai konflik teks dan
 * menyisipkan penanda <<<<<<< ke dalam JSON — berkasnya jadi tidak bisa
 * dibaca dan website menyajikan halaman kosong.
 *
 * Skrip ini mengambil KEDUA sisi konflik, membuang duplikat berdasarkan
 * alamat kontrak, lalu menyusun ulang dari yang terbaru. Tidak ada
 * obituari yang hilang dari sisi mana pun.
 *
 * Dipanggil otomatis oleh .github/workflows/hearse.yml.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  path.join(ROOT, "data", "obituaries.json"),
  path.join(ROOT, "site", "data", "obituaries.json"),
];

/** Buang baris penanda konflik, sisakan isi kedua sisi. */
const stripMarkers = (t) =>
  t.split("\n").filter((l) => !/^(<<<<<<<|=======|>>>>>>>)/.test(l)).join("\n");

/** Pungut setiap objek obituari yang utuh dari teks apa pun. */
function harvest(text) {
  const out = [];
  const re = /\{[^{}]*"address"\s*:\s*"([^"]+)"[^{}]*\}/g;
  let m;
  while ((m = re.exec(text))) {
    try {
      const o = JSON.parse(m[0]);
      if (o.address && o.symbol && o.diedAt && o.body) out.push(o);
    } catch {
      /* objek terpotong — abaikan */
    }
  }
  return out;
}

const found = new Map();
let konflik = false;

for (const f of FILES) {
  if (!fs.existsSync(f)) continue;
  const raw = fs.readFileSync(f, "utf8");
  if (/^<<<<<<< /m.test(raw)) konflik = true;
  harvest(stripMarkers(raw)).forEach((o) => found.set(o.address, o));
}

if (!found.size) {
  console.error("merge-archive: tidak ada obituari yang bisa diselamatkan — dibatalkan");
  process.exit(1);
}

const merged = [...found.values()].sort((a, b) => b.diedAt - a.diedAt);
const json = JSON.stringify(merged, null, 2);
JSON.parse(json); // pastikan hasilnya benar-benar valid sebelum ditulis

for (const f of FILES) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, json);
}

console.log(
  `merge-archive: ${konflik ? "konflik diselesaikan" : "tidak ada konflik"} — ` +
  `${merged.length} obituari, terbaru $${merged[0].symbol}`,
);
