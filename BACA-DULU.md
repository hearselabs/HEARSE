# 🪦 HEARSE — panduan mulai

Pengurus pemakaman otomatis untuk token Solana yang sudah mati.
Semuanya gratis. Tidak ada satu pun langkah di bawah yang butuh kartu kredit.

---

## Isi folder ini

```
Desktop/hearse/
├── hearse.js          ← mesinnya (semua ada di sini)
├── .env.example       ← contoh pengaturan, salin jadi .env
├── data/
│   ├── watchlist.json     daftar token yang sedang dipantau
│   └── obituaries.json    arsip obituari
└── site/
    ├── index.html         website
    └── data/              salinan arsip untuk website
```

---

## Langkah 1 — coba jalankan (2 menit, tanpa daftar apa pun)

Buka Terminal, lalu:

```bash
cd ~/Desktop/hearse
node hearse.js --dry
```

`--dry` artinya "mode uji" — dia tetap mengambil data asli dari blockchain
dan menulis obituari, tapi **tidak mengirim apa pun ke Telegram**.

Kamu akan lihat sesuatu seperti ini:

```
🪦  HEARSE — 2026-08-10T12:59:36.267Z
    Ditemukan 40 token · 40 baru masuk daftar pantau
    Terdeteksi meninggal: 6
    ⚰  $Niru … selesai
```

Kalau itu muncul, **sistemnya sudah bekerja.** Obituarinya masih kaku karena
belum ada penulis AI-nya — itu langkah berikutnya.

---

## Langkah 2 — lihat websitenya

```bash
npm run site
```

Lalu buka **http://localhost:4390** di browser.

Kamu akan lihat obituari yang barusan dibuat, sudah bisa dicari.

Tekan `Ctrl + C` di Terminal untuk menghentikannya.

---

## Langkah 3 — pasang penulis AI (gratis)

1. Buka **https://console.groq.com** → daftar (gratis, tanpa kartu kredit)
2. Masuk ke menu **API Keys** → **Create API Key** → salin
3. Di Terminal:

```bash
cp .env.example .env
```

4. Buka file `.env` (klik dua kali, atau `open .env`), tempel key-nya:

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
```

5. Jalankan lagi:

```bash
node hearse.js --dry
```

Sekarang obituarinya ditulis beneran, bukan template.

> **Kalau muncul error 404 atau 400** — berarti nama modelnya sudah berubah.
> Jalankan `npm run models`, lalu salin salah satu nama dari daftar
> ke baris `GROQ_MODEL` di file `.env`.

---

## Langkah 4 — sambungkan Telegram (gratis, tanpa batas)

**a. Bikin bot**

1. Buka Telegram, cari **@BotFather**
2. Kirim `/newbot`, ikuti perintahnya
3. Salin token yang dia berikan ke `.env`:
   ```
   TELEGRAM_BOT_TOKEN=1234567890:AAxxxxxxxxxxxxxxx
   ```

**b. Bikin channel**

1. Bikin channel publik baru di Telegram (misal `@hearseobituaries`)
2. Masuk ke pengaturan channel → **Administrators** → tambahkan bot-mu
3. Tulis nama channel-nya di `.env`:
   ```
   TELEGRAM_CHANNEL_ID=@hearseobituaries
   ```

**c. Supaya bot bisa kirim draft ke kamu pribadi**

1. Chat **@userinfobot** di Telegram, dia akan kasih angka ID-mu
2. Masukkan ke `.env`:
   ```
   TELEGRAM_OWNER_ID=123456789
   ```
3. **Penting:** chat dulu bot-mu sendiri (kirim `/start`), kalau tidak
   Telegram melarang dia mengirim pesan ke kamu.

**d. Jalankan tanpa `--dry`**

```bash
node hearse.js
```

Sekarang obituarinya masuk ke channel, dan draft untuk X dikirim ke chat pribadimu.

---

## Langkah 5 — naikkan ke GitHub (biar jalan tanpa laptopmu)

Ini yang bikin HEARSE hidup 24 jam. Laptopmu boleh mati.

### a. Bikin repo

1. Buka **https://github.com/new**
2. Nama: `hearse` · pilih **Private** (boleh Public kalau mau dipamerkan)
3. **Jangan** centang "Add a README" — kita sudah punya
4. Klik **Create repository**

### b. Kirim kodenya ke sana

Salin perintah yang GitHub tampilkan, atau pakai ini
(ganti `NAMAMU` dengan username GitHub-mu):

```bash
cd ~/Desktop/hearse
git add .
git commit -m "hearse: first burial ground"
git branch -M main
git remote add origin https://github.com/NAMAMU/hearse.git
git push -u origin main
```

> File `.env` **tidak akan ikut terkirim** — sudah dicegah oleh `.gitignore`.
> Kunci API-mu aman.

### c. Masukkan kunci sebagai Secret

Karena `.env` tidak ikut, GitHub perlu diberi tahu kuncinya secara terpisah.

Buka repo → **Settings** → **Secrets and variables** → **Actions** →
tombol **New repository secret**. Tambahkan satu per satu:

| Nama secret | Isi |
|---|---|
| `GROQ_API_KEY` | kunci Groq-mu |
| `TELEGRAM_BOT_TOKEN` | token dari BotFather |
| `TELEGRAM_CHANNEL_ID` | misal `@hearseobituaries` |
| `TELEGRAM_OWNER_ID` | angka ID pribadimu |

Di tab **Variables** (sebelah Secrets), tambahkan yang ini — bukan rahasia:

| Nama variable | Isi |
|---|---|
| `GROQ_MODEL` | `llama-3.3-70b-versatile` |
| `MAX_BURIALS_PER_RUN` | `4` |

### d. Uji sekarang, jangan tunggu jadwal

Buka tab **Actions** → pilih **HEARSE — bury the dead** →
klik **Run workflow**.

Tunggu semenit. Kalau hijau ✅, berarti sudah hidup. Cek channel Telegram-mu —
obituarinya harusnya sudah masuk.

Kalau merah ❌, klik jobnya untuk lihat pesan errornya, lalu tempel ke sini.

> ⚠️ **Dua hal yang perlu kamu tahu soal jadwal GitHub:**
> 1. Jadwalnya **tidak presisi** — bisa telat 5–20 menit saat server sibuk.
>    Untuk HEARSE ini tidak masalah.
> 2. Di repo publik, GitHub bisa **mematikan jadwal otomatis** kalau repo-nya
>    lama tidak ada aktivitas manusia. Karena workflow ini commit sendiri tiap
>    kali jalan, seharusnya aman — tapi sesekali cek tab Actions untuk memastikan
>    masih berjalan.

---

## Langkah 6 — pasang websitenya online (gratis)

Setelah repo GitHub-nya jadi, ini cuma butuh 2 menit:

1. Daftar di **https://vercel.com** — pilih **Continue with GitHub**
2. **Add New** → **Project**
3. Pilih repo `hearse` → **Import**
4. Jangan ubah apa pun (file `vercel.json` sudah mengatur semuanya) → **Deploy**

Selesai. Kamu dapat alamat seperti `hearse.vercel.app`.

**Dan sekarang ini bagian bagusnya:** tiap kali workflow GitHub jalan dan
menemukan kematian baru, dia commit arsipnya. Vercel melihat commit itu dan
**memperbarui website otomatis**. Kamu tidak perlu upload apa pun lagi, selamanya.

```
tiap 6 jam → GitHub jalankan mesin → commit arsip → Vercel deploy → web update
```

---

## Perintah yang sering dipakai

| Perintah | Gunanya |
|---|---|
| `node hearse.js --dry` | Uji coba, tidak mengirim ke Telegram |
| `node hearse.js` | Jalan beneran |
| `npm run site` | Buka website di komputermu |
| `npm run models` | Lihat daftar model Groq yang tersedia |

---

## Kalau ada yang aneh

**"Terdeteksi meninggal: 0"**
Wajar kalau baru pertama jalan. Token butuh waktu untuk mati.
Jalankan lagi 1–2 jam kemudian.

**Obituarinya terasa kaku dan seragam**
Berarti `GROQ_API_KEY` belum terbaca. Cek file `.env` — pastikan
namanya persis `.env` (bukan `.env.txt`).

**Bot tidak mengirim ke channel**
Bot harus jadi **administrator** channel, bukan sekadar anggota.

**Terlalu banyak / terlalu sedikit yang mati**
Ubah `DEAD_LIQUIDITY_USD` dan `DEAD_VOLUME_24H_USD` di `.env`.
Angka lebih besar = lebih banyak dianggap mati.
