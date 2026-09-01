# ClipPay — Review dan Persetujuan Submission

ClipPay adalah platform yang membayar creator berdasarkan jumlah penayangan
video. Proyek ini mengimplementasikan bagian review dan persetujuan submission
oleh admin:

1. Menampilkan submission yang perlu ditinjau.
2. Memungkinkan admin menyetujui atau menolak submission.
3. Membayar creator dan mengurangi budget campaign ketika submission disetujui.

> Karena proses ini melibatkan uang sungguhan, prioritas utama proyek adalah
> ketepatan perhitungan, konsistensi data, serta keamanan terhadap permintaan
> yang berjalan bersamaan.

Istilah domain dijelaskan di [CONTEXT.md](CONTEXT.md). Keputusan arsitektur yang
lebih spesifik dicatat sebagai [ADR](docs/adr/).

## Teknologi

- Next.js 16 App Router dan React 19
- TypeScript
- Drizzle ORM dengan PostgreSQL
- Tailwind CSS v4
- Vitest

## Cara Menjalankan

Pastikan Docker tersedia, lalu buat file `.env` dengan isi berikut:

```env
DATABASE_URL=postgresql://clippay:clippay@localhost:5433/clippay
```

Jalankan perintah berikut dari direktori proyek:

```bash
docker compose up -d
npm install
npm run db:setup     # Menjalankan schema.sql dan seed 50.000 submission
npm run db:migrate   # Menjalankan migrasi index tambahan
npm run dev
```

Setelah server berjalan, buka [http://localhost:3000/review](http://localhost:3000/review).

Perintah pemeriksaan:

```bash
npm test
npm run lint
npm run build
```

`db:setup` menjalankan `schema.sql` melalui driver PostgreSQL sehingga `psql`
tidak diperlukan. `db:migrate` hanya menjalankan migrasi yang ditulis secara
manual untuk index tambahan. `drizzle-kit generate` biasa dan `push` tidak
digunakan karena tabel awal sudah disediakan oleh `schema.sql`.

## Fitur yang Diimplementasikan

### Fitur wajib

| Fitur | Keterangan |
| --- | --- |
| `GET /api/submissions` | Pagination, filter status, filter campaign, pencarian username creator, dan total jumlah baris |
| `POST /api/submissions/:id/approve` | Menghitung earning, mengurangi budget, mencatat earning, dan mengubah status secara atomik |
| `POST /api/submissions/:id/reject` | Mengubah submission pending menjadi rejected tanpa memindahkan uang |
| `/review` | Tabel submission, filter, pagination, approve/reject, serta state loading, kosong, dan error |

### Bonus

- **B1:** Test untuk fungsi perhitungan uang.
- **B2:** Jawaban tentang penurunan jumlah views setelah approval, tersedia di
  bagian [Jawaban B2](#jawaban-b2--views-turun-setelah-approval).
- **B3:** `GET /api/campaigns/:id/summary` untuk ringkasan campaign.
- `GET /api/creators` sebagai sumber saran username creator pada filter.

## Keputusan Teknis

### 1. Perhitungan uang menggunakan bilangan bulat

Semua nilai uang dan jumlah views diproses sebagai bilangan bulat. Tidak ada
operasi floating point dalam perhitungan nominal.

```text
earning_kotor = floor(views × cpm / 1000)
earning_net   = floor(earning_kotor × 80 / 100)
fee_platform  = earning_kotor - earning_net
```

Dengan demikian, `earning_kotor = earning_net + fee_platform` selalu terpenuhi.
Contoh dari soal: 12.345 views dengan CPM Rp1.500 menghasilkan earning kotor
Rp18.517 dan earning net Rp14.813.

Test perhitungan mencakup contoh acuan dari soal, nilai views nol, batas
pembulatan, serta rekonsiliasi antara earning kotor, earning net, dan fee.

### 2. Approval aman terhadap klik ganda dan konkurensi

Proses approval dilakukan dalam satu transaksi database. Submission terlebih
dahulu diubah menggunakan kondisi `status = 'pending'`. Hanya request yang
berhasil mengubah baris tersebut yang dapat melanjutkan proses pembayaran.

Budget campaign kemudian dikurangi dengan kondisi
`remaining_budget >= earning_kotor`. Jika budget tidak cukup, transaksi
dibatalkan seluruhnya. Sistem tidak pernah membayar sebagian dan tidak pernah
membiarkan budget menjadi negatif.

Selain penjagaan melalui transaksi, terdapat unique index pada
`earnings.submission_id` sebagai lapisan perlindungan tambahan terhadap
pembayaran ganda.

Perilaku endpoint:

- `400` jika ID tidak valid.
- `404` jika submission tidak ditemukan.
- `409` jika submission sudah direview.
- `422` jika earning bernilai nol atau budget tidak mencukupi.

### 3. Listing dilakukan di sisi database

Pagination menggunakan `LIMIT` dan `OFFSET` di database. Data campaign dan
creator diambil melalui join dalam query yang sama sehingga tidak terjadi
masalah N+1. Query isi halaman dan query `count(*)` menggunakan kondisi filter
yang sama dan dijalankan secara bersamaan.

Urutan data menggunakan `submitted_at DESC, id DESC`. `id` menjadi pemecah seri
agar pagination tetap stabil ketika beberapa submission memiliki waktu submit
yang sama.

Parameter query divalidasi di batas route. Input yang tidak valid menghasilkan
respons `400`, bukan error `500` dari driver database.

### 4. Index tambahan

Index tambahan ditulis sebagai SQL manual di [drizzle/](drizzle/) agar tetap
mudah ditinjau:

| Index | Kegunaan |
| --- | --- |
| `submissions (status, submitted_at DESC, id DESC)` | Listing default |
| `submissions (campaign_id, status, submitted_at DESC, id DESC)` | Listing berdasarkan campaign |
| `submissions (creator_id, status, submitted_at DESC, id DESC)` | Listing berdasarkan creator |
| Unique `earnings (submission_id)` | Perlindungan tambahan terhadap pembayaran ganda |
| GIN pada `lower(creators.username)` | Pencarian username substring |

Index tunggal pada `status` dan `campaign_id` dari seed tidak dipertahankan
karena kolom tersebut sudah menjadi awalan index komposit yang digunakan query.

### 5. Pemisahan server component dan client component

Halaman `/review` mengambil data melalui modul query yang sama dengan route
handler API. Hal ini menghindari request HTTP ke server sendiri dan memastikan
logika query hanya memiliki satu sumber.

Server component digunakan untuk pengambilan data awal. Client component hanya
digunakan untuk interaksi seperti menerapkan filter, pagination, approve, dan
reject. Filter disimpan di URL agar dapat dipertahankan saat halaman dimuat
ulang atau dibagikan.

## Jawaban B2 — Views Turun Setelah Approval

Keputusan yang digunakan adalah **earning tetap berlaku setelah approval**.
Approval dianggap sebagai keputusan pembayaran final pada jumlah views yang
tercatat saat itu. Nilai `views_at_approval` disimpan agar dasar perhitungan
setiap pembayaran dapat diaudit.

Bagi creator, keputusan ini membuat pendapatan menjadi pasti dan mencegah
creator menanggung risiko akibat pembersihan views palsu yang dilakukan oleh
platform video. Menarik kembali pembayaran secara retroaktif juga dapat
merugikan creator untuk sesuatu yang berada di luar kendalinya.

Bagi brand, konsekuensinya adalah brand menanggung risiko apabila jumlah views
turun setelah pembayaran. Risiko tersebut dapat dikurangi dengan:

- menunggu beberapa hari sebelum melakukan approval agar views lebih stabil;
- memasukkan cadangan penurunan views ke dalam perencanaan budget atau CPM; dan
- menetapkan batas earning per submission.

Jika produk mengharuskan jumlah views dapat dikoreksi, pendekatan yang lebih
tepat adalah mengubah alur bisnis: earning dicatat sebagai akrual terlebih
dahulu, lalu dicairkan setelah periode pengendapan. Pendekatan tersebut
memerlukan perubahan skema dan keputusan produk di luar cakupan take-home ini.

## Catatan Implementasi

- Seed awal menempatkan seluruh 50.000 submission dalam status `pending`.
  Karena itu, filter `approved` atau `rejected` dapat menampilkan tabel kosong
  pada database yang baru diinisialisasi.
- Data `approved` lama pada seed tidak memiliki earning dan tidak mengurangi
  budget. Data tersebut diperlakukan sebagai riwayat baca-saja.
- Nilai `bigint` dibaca sebagai `number` karena nominal proyek masih berada dalam
  batas aman JavaScript. Hasil agregasi yang tetap bertipe `bigint` dikonversi
  secara eksplisit sebelum dikirim sebagai JSON.

## Keterbatasan dan Pekerjaan Lanjutan

- Belum ada test komponen dengan React Testing Library. Waktu lebih banyak
  dialokasikan untuk menguji perhitungan uang dan transaksi konkurensi.
- Listing masih menggunakan `count(*)` eksak dan offset pagination. Untuk data
  yang jauh lebih besar, estimasi jumlah baris atau keyset pagination dapat
  dipertimbangkan.
- Autentikasi belum diterapkan karena tidak termasuk dalam soal.
- Reject belum memiliki alasan karena skema yang disediakan tidak menyediakan
  kolom untuk menyimpannya.
- Belum ada review massal dan belum ada halaman UI khusus untuk endpoint summary.
