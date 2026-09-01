# ClipPay — review & approve

Irisan sisi admin: menampilkan submission, me-review satu per satu, membayar
creator, dan memotong Remaining Budget campaign.

Yang dikejar lebih dulu adalah **kebenaran uang** dan **keamanan saat approve
terjadi bersamaan**; sisanya sengaja dibuat sepolos mungkin.

> Rincian implementasi yang lebih panjang ada di [README.en.md](README.en.md)
> (bahasa Inggris). Istilah domain: [CONTEXT.md](CONTEXT.md). Keputusan yang
> direkam sebagai ADR: [docs/adr/](docs/adr/).

## Cara menjalankan

`.env` cukup satu baris:

```
DATABASE_URL=postgresql://clippay:clippay@localhost:5433/clippay
```

```bash
docker compose up -d
npm install
npm run db:setup     # menjalankan schema.sql yang diberikan: tabel + seed 50.000 baris
npm run db:migrate   # drizzle-kit migrate: index tambahan dari drizzle/
npm run dev          # http://localhost:3000/review
```

Tidak butuh `psql`: `db:setup` menjalankan `schema.sql` lewat driver `pg`, dan
`db:migrate` adalah drizzle-kit.

```bash
npm test        # 57 test, butuh database menyala
npm run lint
npm run build
```

## Yang dikerjakan

| | |
|---|---|
| `GET /api/submissions` | pagination, filter `status` / `campaignId`, pencarian username creator, total baris eksak |
| `POST /api/submissions/:id/approve` | jalur uang: satu transaksi, penjaga budget, tanpa pembayaran dobel |
| `POST /api/submissions/:id/reject` | separuh lain dari sebuah Review — tanpa uang, penjaga yang sama |
| `GET /api/creators` | sumber typeahead filter creator, dibatasi 5 |
| `GET /api/campaigns/:id/summary` | bonus B3, satu kali jalan ke database |
| `/review` | tabel di server, filter di URL, approve/reject per baris dengan konfirmasi, dialog detail |

Bonus yang dikerjakan: **B1** (test perhitungan uang), **B2** (jawaban di bawah),
**B3** (endpoint summary).

## Keputusan teknis dan alasannya

### 1. Perhitungan uang: integer, satu `floor` per nilai

```
gross = floor(views * cpm / 1000)
net   = floor(gross * 80 / 100)
fee   = gross - net
```

`fee` diambil sebagai **sisa**, bukan angka yang dibulatkan sendiri, supaya
`gross = net + fee` selalu benar. Tidak ada float yang menyentuh nominal.

`net` ditulis `floor(gross * 80 / 100)` karena itu yang cocok dengan contoh di
soal: 12.345 views @ CPM 1500 → gross 18.517, net **14.813**. Kalau ditulis
`gross - floor(gross * 20 / 100)` hasilnya 14.814. Dua-duanya pembulatan yang
bisa dipertahankan, tapi hanya satu yang sesuai soal — dan
[`money.test.ts`](src/lib/money.test.ts) mengunci perbedaan itu supaya tidak
bergeser tanpa sengaja di kemudian hari.

**Jawaban B1 — test yang menurut saya paling penting**, berurutan: contoh acuan
dari soal, rekonsiliasi `gross = net + fee` untuk semua CPM di seed, arah
pembulatan tepat di batas, dan `views = 0`. Yang paling mungkin menangkap regresi
nyata adalah test rekonsiliasi, karena itulah invarian yang harus dipenuhi tabel
`earnings` supaya pembukuannya seimbang.

### 2. Approve: satu transaksi, semua penjaga berupa UPDATE bersyarat

Row lock Postgres yang menentukan siapa menang, bukan pengecekan di aplikasi:

1. `update submissions set status='approved', reviewed_at=now() where id=? and status='pending' returning views, creator_id, campaign_id`
   → **penjaga pembayaran dobel.** Pemanggil kedua menunggu di baris yang sama,
   lalu melihat statusnya sudah bukan `pending` dan meng-update nol baris.
2. Baca `cpm` di transaksi yang sama, hitung dari `views` hasil `RETURNING`
   langkah 1 — jadi nominalnya dihitung dari baris saat baris itu di-lock.
3. `update campaigns set remaining_budget = remaining_budget - gross where id=? and remaining_budget >= gross`
   → nol baris berarti budget tidak cukup. Rollback; tidak pernah membayar
   sebagian, dan budget tidak pernah minus.
4. Insert Earning dengan `views_at_approval` dari snapshot langkah 1.

Ditambah `create unique index on earnings (submission_id)` sebagai penjaga kedua
di level database. Redundan dengan sengaja: ini uang sungguhan.

Status code: `404` submission tidak ada · `409` sudah di-review · `422` Zero
Earning atau budget tidak cukup · `400` id tidak valid. UI membedakan
pesannya, karena "sudah di-review" dan "budget habis" menuntut tindakan berbeda.

**Diuji terhadap database sungguhan**, bukan driver yang di-mock:

- 10 approve bersamaan atas satu submission → tepat 1 sukses, 1 baris `earnings`,
  budget berkurang tepat sekali;
- 8 approve bersamaan atas budget yang cukup untuk 3 → tepat 3 pembayaran, budget
  tepat nol, 5 submission tetap `pending`;
- gross tepat sama dengan Remaining Budget → berhasil; lebih 1 rupiah → 422 dan
  tidak ada yang berubah;
- approve berlomba dengan reject → tepat satu yang menang, dan status barisnya
  selalu konsisten dengan pembukuan.

### 3. Reject: satu UPDATE bersyarat, tanpa transaksi

Tidak ada uang yang berpindah, jadi tidak ada transaksi yang perlu dibuka — satu
`update … where id=? and status='pending'` sudah atomik dengan sendirinya, dengan
kondisi yang sama seperti approve. Efeknya: submission yang sudah di-approve
tidak bisa di-reject di belakang Earning-nya, dan yang sudah di-reject tidak bisa
dibayar kemudian ([ADR-0005](docs/adr/0005-rejection-is-the-other-half-of-a-review.md)).

### 4. Query listing: pagination di database, satu where-clause

Satu statement untuk isi halaman dan satu `count(*)` untuk totalnya, dibangun
dari where-clause yang sama, dijalankan dalam satu `Promise.all`. `limit`/`offset`
dari `page`/`per` yang sudah divalidasi (`per` dibatasi 100) — tidak ada data yang
diambil semua lalu dipotong di aplikasi. `creators` dan `campaigns` di-join di
statement yang sama, jadi tidak ada N+1.

Urutannya `submitted_at desc, id desc`. Pemecah seri itu bukan hiasan:
`submitted_at` tidak unik di seed, dan tanpa `id` halaman saling tumpang tindih.

Query param divalidasi di batas route; input tidak valid → **400 dengan semua
masalahnya sekaligus**, bukan 500 dari driver. Validasinya ditulis tangan, bukan
zod: lima parameter tidak sebanding dengan satu dependency baru.

### 5. Index yang ditambahkan

Semuanya SQL tulis-tangan di [`drizzle/`](drizzle/), dijalankan
`npm run db:migrate`. drizzle-kit dipakai **hanya** untuk `migrate` dan
`generate --custom` — `generate` biasa atau `push` akan mencoba membuat ulang
tabel yang sudah diberikan `schema.sql`.

| Index | Query yang dilayani |
|---|---|
| `submissions (status, submitted_at desc, id desc)` | listing default. `EXPLAIN` menunjukkan index scan langsung ke LIMIT, **tanpa sort** |
| `submissions (campaign_id, status, submitted_at desc, id desc)` | listing dengan filter campaign; `campaign_id` di depan karena lebih selektif |
| `earnings (submission_id)` unique | penjaga pembayaran dobel kedua |
| `creators using gin (lower(username) gin_trgm_ops)` | pencarian substring username |

Dua index dari seed dibuang — `submissions (status)` dan
`submissions (campaign_id)` — karena keduanya prefiks kolom depan dari komposit di
atas, jadi sekarang hanya membebani kecepatan tulis.

Pencarian username adalah **substring** (`lower(username) like '%creator_1%'`),
dengan `%`, `_`, `\` dari input pengguna di-escape supaya mencari `%` tidak cocok
semuanya. `%` di depan tidak bisa dilayani b-tree, jadi index-nya `pg_trgm`; hasil
`EXPLAIN ANALYZE`-nya bitmap index scan, 0,2 ms. `ilike` lebih enak dibaca tapi
tidak bisa memakai index itu — ekspresi yang di-index `lower(username)`, jadi
predikatnya harus ditulis sama.

### 6. Halaman `/review` memanggil modul query, bukan API-nya sendiri

Route handler dan page memakai satu fungsi `listSubmissions` yang sama: handler
hanya validasi + serialisasi, page memanggilnya langsung. Jadi tidak ada request
loopback dan hanya ada satu tempat query listing bisa salah
([ADR-0003](docs/adr/0003-one-query-module-not-a-self-http-call.md)). Perlu
diketahui sebelum mencari `fetch` di page yang memang tidak ada.

Server component mengambil data; client component hanya untuk interaksi. Dua efek
samping — menerapkan filter dan mengirim review — dimiliki oleh **list**, bukan
oleh tombol atau baris yang memicunya, jadi hanya ada satu tempat yang tahu arti
sebuah perubahan filter dan arti setiap status code. Tanpa custom hook: masing-
masing dipakai di satu tempat saja.

Tidak ada yang difilter sampai **Apply filter** ditekan, jadi mengubah status dan
campaign sekaligus hanya sekali jalan ke server dan input setengah jadi tidak
pernah men-query 50.000 baris. State filter tinggal di URL supaya bertahan saat
reload dan bisa dikirim ke orang lain.

Empat state ditangani: loading (skeleton `Suspense`), kosong (membedakan "tidak
ada yang cocok" dari "halaman melewati baris terakhir"), filter tidak valid
(pesan validasi dari server), dan error (`error.tsx` untuk database yang tidak
menjawab).

### 7. Keputusan yang direkam sebagai ADR

- [ADR-0001](docs/adr/0001-budget-is-the-only-approval-gate.md) — **budget satu-satunya gerbang**: campaign `paused`/`closed` tetap bisa di-approve, karena soal hanya menyebut budget sebagai alasan penolakan.
- [ADR-0002](docs/adr/0002-zero-earning-submissions-are-not-approvable.md) — **Zero Earning tidak bisa di-approve**: "approve" berarti "bayar", dan tidak ada yang dibayar.
- [ADR-0003](docs/adr/0003-one-query-module-not-a-self-http-call.md) — satu modul query, bukan self-HTTP.
- [ADR-0004](docs/adr/0004-approval-is-final.md) — **approval final**, dasar jawaban B2.
- [ADR-0005](docs/adr/0005-rejection-is-the-other-half-of-a-review.md) — reject dibangun meski tidak diminta soal.

## Jawaban B2 — views turun setelah di-approve

**Tidak ada yang terjadi. Earning-nya tetap berlaku.**

Approve membayar creator saat itu juga; tidak ada tahap pembayaran berikutnya
untuk dikoreksi. Video yang di-approve pada 100.000 views lalu turun ke 60.000
tetap memegang Earning-nya, dan `views_at_approval` mencatat 100.000 yang menjadi
dasar perhitungannya — jadi dasar setiap pembayaran lama tetap bisa diaudit
walaupun angka live-nya sudah tidak cocok.

**Konsekuensi bagi creator:** pendapatannya final begitu admin menekan approve.
Alternatifnya — menarik selisihnya kembali — membuat saldo creator menjadi fungsi
dari operasi pembersihan views palsu platform: sesuatu yang tidak mereka
kendalikan dan tidak bisa mereka perkirakan. Menagih utang secara retroaktif ke
orang yang sudah dibayar adalah cara tercepat kehilangan sisi suplai sebuah
marketplace dua sisi.

**Konsekuensi bagi brand:** mereka menanggung penurunan views atas pekerjaan yang
sudah dibayar. Itu biaya nyata, dan tuasnya ada di sisi approval — bukan di sisi
pembatalan:

- **approve setelah views mengendap** — masa tunggu (approve di hari ke-7, bukan
  hari pertama) menghilangkan sebagian besar penurunan, karena pembersihan
  terjadi di awal;
- **masukkan ke harga** — cadangan penurunan di dalam budget campaign, atau CPM
  yang sudah mengasumsikan beberapa persen pembersihan;
- **batas per submission**, supaya satu video viral tidak mengambil porsi budget
  yang tidak proporsional atas views yang belum tentu bertahan.

Kalau brand benar-benar butuh angka yang terkoreksi, bentuk yang jujur bukan
pembatalan melainkan **tahap kedua**: `earnings` menjadi akrual dan pencairan
terjadi setelah masa pengendapan. Itu perubahan skema dan keputusan produk yang
berbeda, jadi disebut di sini alih-alih dikerjakan setengah.

## Catatan yang perlu diketahui

- **Seed menempatkan semua 50.000 submission di `pending`** pada Postgres 16.
  Statusnya dipilih di `cross join lateral` yang tidak mereferensikan baris luar,
  jadi planner mengevaluasinya sekali. `schema.sql` adalah pemberian dan tidak
  diubah; test membangun fixture-nya sendiri, jadi tetap mencakup baris
  `approved` dan `rejected`. Memfilter `/review` dengan `approved` pada database
  yang baru di-seed menampilkan tabel kosong karena ini, bukan karena filter
  rusak.
- **Legacy Approval**: baris `approved` dari seed memang tidak punya Earning dan
  tidak memotong budget, sesuai catatan di `schema.sql`. Riwayat baca-saja.
- **Uang bertipe `bigint` dibaca sebagai number** (`mode: 'number'`), eksak
  sampai 2^53 rupiah. `mode: 'bigint'` akan memaksa `BigInt` melewati setiap
  perhitungan dan batas JSON demi plafon yang tidak akan tercapai. Satu-satunya
  `bigint` sungguhan yang bertahan adalah `sum()` di campaign summary, dan itu
  dikonversi secara eksplisit.
- **Drizzle membuang kualifier tabel** untuk objek kolom di dalam template `sql`
  pada select list: `${submissions.campaignId} = ${campaigns.id}` ter-render
  `"campaign_id" = "id"` dan menghitung baris yang salah tanpa error. Subquery di
  campaign summary karena itu ditulis sebagai SQL literal, dan ada test yang
  mengunci angkanya.

## Yang dipotong, dan apa selanjutnya

- **Tidak ada test komponen.** React Testing Library tidak dipasang; waktunya
  dialokasikan ke uang dan transaksinya, yang merupakan risiko yang dinilai.
  Halamannya diverifikasi dengan menjalankannya di browser sungguhan — approve
  sebuah baris, cek baris `earnings` dan Remaining Budget-nya, lalu cek pesan
  409/422.
- **`count(*)` eksak di setiap listing**, dan itu yang pertama melambat jauh di
  atas 50.000 baris. Peningkatannya: estimasi dari `pg_class.reltuples` untuk
  hitungan tanpa filter, atau cursor keyset tanpa offset
  (`where (submitted_at, id) < (?, ?)`) yang sudah disiapkan oleh urutannya.
- **Offset yang dalam** tetap menyusuri entri index; solusinya sama, pagination
  keyset.
- **Tanpa autentikasi** — hanya ada satu aktor di irisan ini dan soal tidak
  memintanya.
- **Reject tanpa alasan**, karena skemanya tidak punya tempat menyimpannya.
- **Tanpa review massal** dan **tanpa halaman untuk endpoint summary** (B3 baru
  berupa JSON).
