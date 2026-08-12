/**
 * Tiga arah foto profil, dirender 1000px + diuji ulang di 48px
 * (ukuran sebenarnya di timeline X).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "assets", "_pfp-try");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
fs.mkdirSync(OUT, { recursive: true });

const BASE = `
*{margin:0;padding:0;box-sizing:border-box}
body{width:1000px;height:1000px;overflow:hidden;background:#08090D}
.f{width:1000px;height:1000px;position:relative;display:flex;
   align-items:center;justify-content:center;overflow:hidden}
`;

/* ── A · BATU NISAN ──────────────────────────────────────────
   Siluet lengkung batu nisan — bentuk luar yang langsung dikenali
   sekecil apa pun. Denyutnya terpahat menembus batu.            */
const A = `<!doctype html><meta charset=utf-8><style>${BASE}
.f{background:radial-gradient(ellipse 80% 70% at 50% 22%,#191D25,#08090D 72%)}
.stone{position:relative;width:560px;height:720px;
  background:linear-gradient(168deg,#2A3039 0%,#1B2029 46%,#12161C 100%);
  border-radius:280px 280px 26px 26px;
  box-shadow:inset 0 5px 0 rgba(255,255,255,.10),
             inset 0 -34px 60px rgba(0,0,0,.62),
             0 40px 90px rgba(0,0,0,.55);
  display:flex;align-items:center;justify-content:center}
.stone::after{content:"";position:absolute;inset:22px 22px 20px;
  border-radius:262px 262px 12px 12px;border:1.5px solid rgba(255,255,255,.055)}
.pulse{position:relative;width:400px;filter:drop-shadow(0 0 26px rgba(229,72,77,.55))}
.ground{position:absolute;left:0;right:0;bottom:118px;height:2px;
  background:linear-gradient(90deg,transparent,#2A3039 22%,#2A3039 78%,transparent)}
</style>
<div class="f">
  <div class="stone">
    <svg class="pulse" viewBox="0 0 200 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 55 L54 55 L68 18 L90 96 L106 38 L118 55 L194 55"
            stroke="#E5484D" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
  <div class="ground"></div>
</div>`;

/* ── B · MONITOR ─────────────────────────────────────────────
   Layar monitor jantung: denyut besar dan dramatis, kertas grafik
   di belakang, cahaya merah. Paling "hidup" dari ketiganya.      */
const B = `<!doctype html><meta charset=utf-8><style>${BASE}
.f{background:#08090D}
.grid{position:absolute;inset:0;
  background-image:linear-gradient(rgba(229,72,77,.10) 1.5px,transparent 1.5px),
                   linear-gradient(90deg,rgba(229,72,77,.10) 1.5px,transparent 1.5px);
  background-size:100px 100px}
.vig{position:absolute;inset:0;
  background:radial-gradient(ellipse 62% 62% at 50% 50%,rgba(229,72,77,.20),transparent 66%),
             radial-gradient(ellipse 100% 100% at 50% 50%,transparent 42%,#08090D 88%)}
.scan{position:absolute;inset:0;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.34) 0 3px,transparent 3px 7px);
  opacity:.5}
svg{position:relative;width:860px;filter:drop-shadow(0 0 44px rgba(229,72,77,.85))}
</style>
<div class="f">
  <div class="grid"></div><div class="vig"></div>
  <svg viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 65 L52 65 L66 14 L92 118 L110 40 L124 65 L198 65"
          stroke="#FF5A5F" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <div class="scan"></div>
</div>`;

/* ── C · SEGEL ───────────────────────────────────────────────
   Segel resmi rumah duka: cincin kuningan ganda, denyut di tengah,
   teks melingkar. Paling formal & "institusional".               */
const C = `<!doctype html><meta charset=utf-8><style>${BASE}
.f{background:radial-gradient(ellipse 70% 70% at 50% 30%,#14181F,#08090D 74%)}
svg{width:1000px;height:1000px}
</style>
<div class="f">
<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <path id="arcTop" d="M 200,200 m -152,0 a 152,152 0 1,1 304,0" fill="none"/>
    <path id="arcBot" d="M 200,200 m 148,0 a 148,148 0 1,1 -296,0" fill="none"/>
  </defs>
  <circle cx="200" cy="200" r="186" fill="none" stroke="#1C2027" stroke-width="10"/>
  <circle cx="200" cy="200" r="168" fill="none" stroke="#8A6E42" stroke-width="2.5" opacity=".85"/>
  <circle cx="200" cy="200" r="128" fill="none" stroke="#8A6E42" stroke-width="1.2" opacity=".45"/>
  <text font-family="ui-monospace,Menlo,monospace" font-size="25" font-weight="700"
        letter-spacing="9" fill="#E8EAED">
    <textPath href="#arcTop" startOffset="50%" text-anchor="middle">HEARSE</textPath>
  </text>
  <text font-family="ui-monospace,Menlo,monospace" font-size="15"
        letter-spacing="6.5" fill="#575D68">
    <textPath href="#arcBot" startOffset="50%" text-anchor="middle">AUTONOMOUS UNDERTAKER</textPath>
  </text>
  <path d="M104 200 L146 200 L160 168 L180 240 L196 182 L208 200 L296 200"
        stroke="#E5484D" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"
        fill="none" filter="url(#g)"/>
  <filter id="g"><feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#E5484D" flood-opacity=".7"/></filter>
</svg>
</div>`;

for (const [k, html] of [["A", A], ["B", B], ["C", C]]) {
  const f = path.join(OUT, "pfp-" + k + ".html");
  fs.writeFileSync(f, html);
  const png = path.join(OUT, "pfp-" + k + ".png");
  execFileSync(CHROME, ["--headless", "--disable-gpu", "--hide-scrollbars",
    "--screenshot=" + png, "--window-size=1000,1000", "file://" + f], { stdio: "ignore" });

  // uji keterbacaan: kecilkan ke 48px lalu besarkan lagi
  const small = path.join(OUT, "small-" + k + ".png");
  fs.copyFileSync(png, small);
  execFileSync("sips", ["-Z", "48", small], { stdio: "ignore" });
  execFileSync("sips", ["-Z", "420", small], { stdio: "ignore" });
  console.log("  ✅ pfp-" + k + " (+ uji 48px)");
}
