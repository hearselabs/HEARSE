/**
 * Server kecil untuk melihat website di komputermu sendiri.
 * Jalankan:  npm run site      lalu buka http://localhost:4321
 *
 * Ini hanya untuk pratinjau. Saat di-deploy ke Vercel, file ini tidak dipakai.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(DIR, "site");
// Port bisa diganti kalau bentrok:  PORT=5000 npm run site
const PORT = Number(process.env.PORT) || 4390;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    // Buang tanda tanya di URL, dan tolak upaya keluar dari folder site/
    const clean = decodeURIComponent(req.url.split("?")[0]);
    const rel = clean === "/" ? "/index.html" : clean;
    const file = path.join(SITE, path.normalize(rel));

    if (!file.startsWith(SITE)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        return res.end(
          `404 — tidak ditemukan: ${rel}\n\n` +
            `Kalau yang hilang adalah data/obituaries.json,\n` +
            `jalankan dulu:  node hearse.js --dry\n`,
        );
      }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(data);
    });
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`\n  Port ${PORT} sedang dipakai program lain.`);
      console.error(`  Coba port lain:   PORT=5050 npm run site\n`);
      process.exit(1);
    }
    throw err;
  })
  .listen(PORT, () => {
    console.log(`\n  🪦  Website HEARSE siap dilihat`);
    console.log(`      http://localhost:${PORT}`);
    console.log(`\n      Tekan Ctrl+C untuk berhenti.\n`);
  });
