# ClipPay — Review dan Persetujuan Submission

ClipPay adalah platform yang membayar creator berdasarkan jumlah views video.
Proyek ini mengimplementasikan proses review submission oleh admin, termasuk
approval, rejection, pembayaran creator, dan pengurangan budget campaign.

Prioritas utama proyek adalah ketepatan perhitungan uang, konsistensi data, dan
keamanan terhadap request yang berjalan bersamaan.

## Teknologi

Next.js 16 App Router, React 19, TypeScript, PostgreSQL, Drizzle ORM, Tailwind
CSS v4, dan Vitest.

## Cara Menjalankan

Buat file `.env`:

```env
DATABASE_URL=postgresql://clippay:clippay@localhost:5433/clippay
```

Jalankan:

```bash
docker compose up -d
npm install
npm run db:setup
npm run db:migrate
npm run dev
```

Buka [http://localhost:3000/review](http://localhost:3000/review).

Pemeriksaan:

```bash
npm test
npm run lint
npm run build
```

`db:setup` menjalankan `schema.sql` dan seed 50.000 submission. Migrasi
tambahan ditulis manual karena tabel sudah disediakan oleh `schema.sql`.

## Fitur

- `GET /api/submissions`: pagination, filter status dan campaign, pencarian
  username creator, serta total jumlah baris.
- `POST /api/submissions/:id/approve`: menghitung earning, mengurangi budget,
  menyimpan earning, dan mengubah status.
- `POST /api/submissions/:id/reject`: menolak submission yang masih pending.
- `/review`: tabel, filter, pagination, approve/reject, dan state loading,
  kosong, serta error.
- `GET /api/creators` untuk saran username creator.
- Bonus B1, B2, dan B3.

## Keputusan Teknis

### Perhitungan uang

Semua nilai diproses sebagai integer tanpa floating point:

```text
earning_kotor = floor(views × cpm / 1000)
earning_net   = floor(earning_kotor × 80 / 100)
fee_platform  = earning_kotor - earning_net
```

Hanya dua perhitungan pertama yang menggunakan pembulatan. Fee dihitung sebagai
sisa agar `earning_kotor = earning_net + fee_platform` selalu terpenuhi.
`round` tidak digunakan karena dapat menghasilkan pembayaran atau pemotongan
budget yang melebihi nilai views.

Contoh 12.345 views dengan CPM Rp1.500 menghasilkan earning kotor Rp18.517 dan
earning net Rp14.813, sesuai contoh pada soal. Fungsi `calculateEarning` yang
sama digunakan untuk preview dan transaksi approval.

### Approval dan konkurensi

Approval dilakukan dalam satu transaksi:

1. Submission diubah menjadi `approved` hanya jika masih `pending`.
2. Earning dihitung berdasarkan views submission dan CPM campaign.
3. Budget dikurangi hanya jika mencukupi earning kotor.
4. Earning disimpan bersama `views_at_approval`.

Dengan update bersyarat dan unique index pada `earnings.submission_id`, klik
ganda atau approval bersamaan tidak menghasilkan pembayaran ganda. Jika budget
tidak cukup, transaksi dibatalkan sepenuhnya sehingga budget tidak pernah
negatif dan tidak ada pembayaran sebagian.

Reject menggunakan update atomik dengan syarat status masih `pending`, karena
tidak melibatkan pembayaran.

### Query dan halaman review

Pagination dilakukan di database menggunakan `LIMIT` dan `OFFSET`. Creator dan
campaign diambil melalui join untuk menghindari N+1 query. Query data dan
`count(*)` menggunakan filter yang sama. Urutan
`submitted_at DESC, id DESC` menjaga pagination tetap stabil.

Parameter query divalidasi di route boundary. Server component mengambil data
awal, sedangkan client component menangani filter, pagination, approve, dan
reject. Filter disimpan di URL agar bertahan saat reload.

Index tambahan pada status, campaign, creator, pencarian username, dan
`earnings.submission_id` ditulis manual di [drizzle/](drizzle/).

## Bonus B1 — Test Perhitungan Uang

Test mencakup contoh dari soal, views nol, batas pembulatan, dan rekonsiliasi
earning kotor, earning net, serta fee.

## Bonus B2 — Views Turun Setelah Approval

Earning tetap berlaku setelah approval karena approval dianggap sebagai keputusan
pembayaran final berdasarkan views saat itu. Nilai `views_at_approval` disimpan
untuk audit.

Creator tidak menanggung risiko akibat perubahan views yang berada di luar
kendalinya. Brand menanggung risiko jika views turun setelah pembayaran. Risiko
ini dapat dikurangi dengan menunggu sebelum approval, menyediakan cadangan pada
budget atau CPM, dan menetapkan batas earning per submission.

Jika views harus dikoreksi, sistem perlu menggunakan model akrual: earning
dicatat lebih dahulu dan dicairkan setelah periode pengendapan. Perubahan ini
berada di luar cakupan proyek.

## Bonus B3 — Ringkasan Campaign

Endpoint JSON:

```bash
curl -s http://localhost:3000/api/campaigns/3/summary
```

Di UI, ringkasan ditampilkan sebagai panel pada halaman review ketika
`campaignId` tersedia:

```
http://localhost:3000/review?campaignId=3
```

Untuk membukanya, pilih campaign pada filter lalu tekan **Apply filter**.
Tidak ada halaman khusus seperti `/campaigns/3`; panel ditempatkan di halaman
review agar ringkasan terlihat saat admin memeriksa submission campaign tersebut.

## Pengujian dan Keterbatasan

Pengujian mencakup perhitungan uang, approval bersamaan, budget terbatas,
budget yang tepat atau kurang, serta persaingan approval dan reject. Pengujian
transaksi menggunakan database sungguhan.

Autentikasi dan review massal belum diterapkan. Reject belum memiliki alasan
karena skema database tidak menyediakan kolom untuk menyimpannya. Pagination
masih menggunakan offset dan `count(*)` eksak.

Dokumentasi domain tersedia di [CONTEXT.md](CONTEXT.md), sedangkan keputusan
arsitektur dicatat di [docs/adr/](docs/adr/).
