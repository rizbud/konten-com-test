# ClipPay — review & approve

*Bahasa Indonesia. Versi lengkap dalam bahasa Inggris: [README.en.md](README.en.md).*

Irisan sisi admin: menampilkan submission, me-review satu, membayar creator, dan
memotong Remaining Budget campaign. Dua hal yang dikejar lebih dulu adalah
kebenaran uang dan perilaku saat approve terjadi bersamaan; sisanya sengaja
dibuat sepolos mungkin.

Istilah domain ada di [CONTEXT.md](CONTEXT.md), keputusan yang diambil sebelum
menulis kode ada di [docs/adr/](docs/adr/), dan urutan pengerjaannya di
[PLAN.md](PLAN.md).

## Cara menjalankan

`.env` cukup satu baris:

```
DATABASE_URL=postgresql://clippay:clippay@localhost:5433/clippay
```

```bash
docker compose up -d
npm install
npm run db:setup     # menjalankan schema.sql yang diberikan: tabel + seed 50.000 baris
npm run db:migrate   # drizzle-kit migrate: index tambahan kami, dari drizzle/
npm run dev          # http://localhost:3000/review
```

Tidak perlu `psql` sama sekali — `db:setup` menjalankan `schema.sql` lewat driver
`pg`, dan `db:migrate` adalah drizzle-kit. Keduanya aman diulang dalam arti yang
relevan: `db:setup` membuat ulang tabel dari nol (file-nya memang berisi
`drop table`), dan `db:migrate` melewati migration yang sudah tercatat di
`drizzle.__drizzle_migrations`.

```bash
npm test        # 55 test, butuh database menyala
npm run lint
npm run build
```

## Isi

| | |
|---|---|
| `GET /api/submissions` | pagination, filter `status` / `campaignId`, pencarian username creator, total baris eksak |
| `POST /api/submissions/:id/approve` | jalur uang: satu transaksi, penjaga budget, tanpa pembayaran dobel |
| `POST /api/submissions/:id/reject` | separuh lainnya dari sebuah Review — tanpa uang, penjaga 409 yang sama |
| `GET /api/creators` | sumber typeahead untuk filter creator, dibatasi 5 |
| `GET /api/campaigns/:id/summary` | bonus B3, satu kali jalan ke database |
| `/review` | tabel yang di-render di server, state filter di URL, approve dan reject per baris di belakang konfirmasi, dialog detail |

### Di mana semuanya

```
src/app/                 hanya route — satu page, lima route handler, satu error boundary
src/components/ui.tsx    komponen presentasional bersama dan token warna
src/components/modal.tsx, toasts.tsx, pagination.tsx
src/components/review/   komponen milik halaman review
src/db/                  model drizzle atas skema yang diberikan, dan pool-nya
src/lib/                 uang, format, jendela halaman, dan modul query
src/test/                fixture untuk test perilaku
drizzle/                 migration tulis-tangan untuk index yang kami tambahkan
scripts/db-setup.mjs     menjalankan schema.sql tanpa psql
```

Tidak ada logika di dalam `src/app/` selain membaca input-nya sendiri: route
memvalidasi lalu mendelegasikan, page mengambil data lalu menyusun tampilan.
Uang ada di [`src/lib/money.ts`](src/lib/money.ts), transaksi approve di
[`src/lib/submissions/approve.ts`](src/lib/submissions/approve.ts), query listing
di [`src/lib/submissions/list.ts`](src/lib/submissions/list.ts).

## Uang

```
gross = floor(views * cpm / 1000)
net   = floor(gross * 80 / 100)
fee   = gross - net
```

Integer sepenuhnya, satu `floor` per nilai, tidak ada float yang menyentuh
nominal. `fee` adalah sisa — bukan angka yang dibulatkan sendiri — sehingga
`gross = net + fee` selalu benar secara konstruksi.

Contoh acuan di soal adalah alasan `net` ditulis begitu: 12.345 views dengan CPM
1500 menghasilkan gross 18.517, dan `floor(18517 * 0.8)` = 14.813 sedangkan
`18517 - floor(18517 * 0.2)` = 14.814. Dua-duanya pembulatan yang bisa
dipertahankan; hanya satu yang cocok dengan soal.
[`money.test.ts`](src/lib/money.test.ts) mengunci perbedaan itu secara eksplisit
supaya "penyederhanaan" di masa depan tidak menggeser satu rupiah tanpa
kelihatan.

**Bonus B1 — test yang paling penting**, berurutan: contoh acuan dari soal,
rekonsiliasi `gross = net + fee` untuk semua CPM di seed, arah pembulatan tepat
di batas, dan `views = 0`. Test rekonsiliasi itu yang paling mungkin menangkap
regresi nyata, karena itulah invarian yang harus dipenuhi tabel `earnings` agar
pembukuannya seimbang.

## Transaksi approve

Satu `db.transaction`, seluruhnya dibangun dari UPDATE bersyarat supaya row lock
Postgres — bukan pengecekan di aplikasi — yang menentukan siapa menang:

1. `update submissions set status = 'approved', reviewed_at = now() where id = ? and status = 'pending' returning views, creator_id, campaign_id`
   — **ini penjaga pembayaran dobel.** Pemanggil kedua menunggu di baris yang
   sama, lalu mengevaluasi ulang kondisinya setelah yang pertama commit, melihat
   statusnya sudah bukan `pending`, dan meng-update nol baris.
2. Baca `cpm` di transaksi yang sama, hitung gross/net/fee dari `views` yang
   dikembalikan langkah 1.
3. `update campaigns set remaining_budget = remaining_budget - gross where id = ? and remaining_budget >= gross`
   — nol baris berarti campaign tidak mampu menanggungnya. Rollback; tidak pernah
   membayar sebagian.
4. Insert Earning dengan `views_at_approval` dari snapshot langkah 1.

`views` yang dipakai untuk menghitung uang berasal dari `RETURNING` langkah 1,
jadi nominalnya dihitung dari baris pada saat baris itu di-lock, bukan dari nilai
yang dibaca sebelumnya.

Hasilnya dipetakan ke `404` (submission tidak ada), `409` (sudah di-review),
`422` (Zero Earning, atau Remaining Budget tidak cukup), `400` (id tidak valid).
UI menampilkan pesan berbeda untuk masing-masing, karena "sudah di-review" dan
"budget habis" menuntut tindakan berbeda dari admin.

`create unique index on earnings (submission_id)` adalah penjaga pembayaran dobel
kedua, di level database, di belakang UPDATE bersyarat itu. Redundan dengan
sengaja: ini uang sungguhan, dan sebuah index lebih murah daripada satu insiden.

Diverifikasi oleh [`approve.test.ts`](src/lib/submissions/approve.test.ts)
terhadap database sungguhan — sepuluh approve bersamaan atas satu submission
menghasilkan tepat satu sukses, satu baris `earnings`, dan satu kali pengurangan
budget; delapan approve bersamaan atas budget yang hanya cukup untuk tiga
menghasilkan tepat tiga pembayaran, budget tepat nol, dan lima submission tetap
`pending`. Mem-mock driver tidak akan menguji satu pun dari itu.

### Keputusan

- **Budget adalah satu-satunya gerbang.** Campaign `paused` atau `closed` tetap
  bisa di-approve — [ADR-0001](docs/adr/0001-budget-is-the-only-approval-gate.md).
- **Submission dengan Zero Earning ditolak** dan tetap `pending` —
  [ADR-0002](docs/adr/0002-zero-earning-submissions-are-not-approvable.md).
- **Approval bersifat final**, tidak ada penarikan kembali saat views turun —
  [ADR-0004](docs/adr/0004-approval-is-final.md), dan bonus B2 di bawah.
- **Page memanggil modul query, bukan API-nya sendiri** —
  [ADR-0003](docs/adr/0003-one-query-module-not-a-self-http-call.md). Perlu
  diketahui sebelum mencari `fetch` di page yang memang tidak ada.
- **Rejection adalah separuh lainnya dari sebuah Review**, ditambahkan di luar
  permintaan soal supaya queue punya jalan keluar kedua —
  [ADR-0005](docs/adr/0005-rejection-is-the-other-half-of-a-review.md).

## Reject

Tidak ada uang yang berpindah, jadi tidak ada transaksi yang perlu dibuka: satu
`update … where id = ? and status = 'pending'` sudah seluruh operasinya, atomik
dengan sendirinya, dengan penjaga yang sama seperti jalur approve. Sepuluh reject
bersamaan atas satu submission menghasilkan tepat satu sukses dan sembilan 409.

Karena kedua aksi membawa kondisi itu, keduanya tidak bisa sama-sama berhasil:
submission yang sudah di-approve tidak bisa di-reject di belakang Earning-nya,
yang sudah di-reject tidak bisa dibayar kemudian, dan approve yang berlomba
dengan reject menyisakan tepat satu pemenang dengan status baris yang selalu
konsisten dengan pembukuan — [`reject.test.ts`](src/lib/submissions/reject.test.ts)
menguji itu, termasuk lombanya.

Reject tidak menyimpan alasan; skemanya tidak punya tempat untuk itu. Hal pertama
yang ditambahkan kalau admin perlu menjelaskan keputusannya.

## Query listing

Satu statement untuk isi halaman dan satu `count(*)` untuk totalnya, keduanya
dibangun dari where-clause yang sama dan dijalankan dalam satu `Promise.all`.
`limit`/`offset` berasal dari `page`/`per` yang sudah divalidasi (`per` dibatasi
100) — tidak ada data yang diambil semua lalu dipotong di aplikasi. `creators`
dan `campaigns` di-join di statement yang sama; kolom yang di-select hanya yang
dirender tabel.

Urutannya `submitted_at desc, id desc`. Pemecah seri itu bukan hiasan:
`submitted_at` tidak unik di seed, dan tanpa `id` halaman akan saling tumpang
tindih tanpa suara.

Query param divalidasi di batas route dan **semua** masalah dikembalikan dalam
satu 400, jadi klien yang membetulkan URL melihat kedua kesalahannya sekaligus.
`status` tidak punya nilai default di API — halaman `/review` yang menerapkan
`pending` sendiri, sehingga endpoint tetap menjadi cermin apa adanya dari tabel.

Validasinya ditulis tangan, bukan zod: lima parameter tidak sebanding dengan satu
dependency baru.

### Index

Ada di [`drizzle/`](drizzle/), dijalankan oleh `npm run db:migrate`.

drizzle-kit dipasang **hanya** untuk `migrate`. `drizzle-kit generate` (tanpa
`--custom`) dan `drizzle-kit push` tidak boleh dijalankan di sini: tabel di
`schema.sql` adalah pemberian, bukan milik kami untuk dibuat, jadi diff hasil
generate akan mencoba membuat ulang tabel-tabel itu dan push akan membuang apa
yang tidak dikenalinya. Kedua migration dibuat dengan `generate --custom` — yang
hanya menulis file kosong beserta entri journal-nya tanpa membaca skema — lalu
diisi manual. Jadi DDL-nya tetap SQL yang bisa di-review, sementara drizzle tetap
mencatat apa yang sudah dijalankan. [`drizzle.config.ts`](drizzle.config.ts)
menuliskan hal yang sama tepat di sebelah konfigurasinya.

| Index | Query yang dilayani |
|---|---|
| `submissions (status, submitted_at desc, id desc)` | listing default. `EXPLAIN` menunjukkan index scan yang langsung menyuapi LIMIT **tanpa node sort** — satu index melayani filter sekaligus urutannya |
| `submissions (campaign_id, status, submitted_at desc, id desc)` | listing yang sama dengan filter campaign. `campaign_id` di depan karena lebih selektif (8 campaign vs 3 status) |
| `earnings (submission_id)` unique | penjaga pembayaran dobel kedua, bukan jalur baca |
| `creators using gin (lower(username) gin_trgm_ops)` | pencarian substring username creator |

Dibuang: `submissions (status)` dan `submissions (campaign_id)` dari seed.
Keduanya adalah prefiks kolom depan dari komposit di atas, jadi sekarang hanya
membebani kecepatan tulis. `submissions (submitted_at desc)` dibiarkan; ia
melayani listing tanpa filter, yang bukan jalur yang dipakai aplikasi ini.

### Pencarian username adalah substring

`lower(username) like '%creator_1%'`, dengan `%`, `_` dan `\` dari input pengguna
di-escape supaya pencarian `%` tidak cocok apa pun, bukan cocok semuanya (ada
test-nya). Potongan dari tengah nama pun menemukan: `eator_195` dan akhiran
`r_1999` sama-sama mengembalikan baris.

`%` di depan itulah yang tidak bisa dilayani b-tree — tidak ada prefiks untuk
di-seek — jadi ini butuh `pg_trgm`
([`drizzle/0001`](drizzle/0001_username_trigram.sql)): index GIN atas potongan
tiga karakter dari `lower(username)`. `EXPLAIN ANALYZE` untuk
`like '%tor_123%'` menghasilkan bitmap index scan pada
`creators_username_trgm_idx`, 0,2 ms, 3 heap block. Index b-tree
`text_pattern_ops` yang digantikannya hanya pernah bisa melayani prefiks, dan
planner bahkan tidak memilihnya untuk itu — 2.000 creator hanya memenuhi 51
halaman, jadi sequential scan menang.

`ilike` lebih enak dibaca tapi tidak bisa memakai index itu: ekspresi yang
di-index adalah `lower(username)`, jadi predikatnya harus ditulis sama.

## Bonus B2 — views turun setelah di-approve

**Tidak ada yang terjadi. Earning-nya tetap berlaku.** Approve membayar creator
saat itu juga; tidak ada tahap pembayaran berikutnya untuk dikoreksi, dan
`earnings` tidak punya tempat untuk menyimpan revisi. Video yang di-approve pada
100.000 views lalu turun ke 60.000 tetap memegang Earning-nya, dan
`views_at_approval` mencatat 100.000 yang menjadi dasar perhitungannya — sehingga
dasar setiap pembayaran lama tetap bisa diaudit ketika angka live-nya sudah tidak
cocok.

**Bagi creator:** pendapatannya final begitu admin menekan approve. Alternatifnya
— menarik selisihnya kembali — membuat saldo creator menjadi fungsi dari operasi
pembersihan views palsu platform, sesuatu yang tidak mereka kendalikan dan tidak
bisa mereka perkirakan. Menagih utang secara retroaktif kepada orang yang sudah
dibayar adalah cara tercepat kehilangan sisi suplai sebuah marketplace dua sisi,
dan kerumitan pembukuannya lebih besar daripada eksposur yang berhasil ditarik.

**Bagi brand:** mereka menanggung penurunan views atas pekerjaan yang sudah
dibayar. Itu biaya nyata, dan tuasnya ada di sisi approval, bukan di sisi
pembatalan:

- approve setelah views mengendap — masa tunggu (approve di hari ke-7, bukan hari
  pertama) menghilangkan sebagian besar penurunan, karena pembersihan terjadi di
  awal;
- masukkan ke harga — cadangan penurunan di dalam budget campaign, atau CPM yang
  sudah mengasumsikan beberapa persen pembersihan;
- batas per submission, supaya satu video viral tidak mengambil porsi budget yang
  tidak proporsional atas views yang belum tentu bertahan.

Kalau brand benar-benar butuh angka yang terkoreksi, bentuk yang jujur bukan
pembatalan melainkan **tahap kedua**: `earnings` menjadi akrual dan pencairan
terjadi setelah masa pengendapan. Itu perubahan skema dan keputusan produk yang
berbeda, jadi disebut di sini alih-alih dikerjakan setengah. Ditulis sebagai
[ADR-0004](docs/adr/0004-approval-is-final.md).

## Catatan yang layak dibaca sebelum kodenya

- **Uang bertipe `bigint` dibaca sebagai number JavaScript** (`mode: 'number'`),
  eksak sampai 2^53 rupiah — sekitar 9 kuadriliun. `mode: 'bigint'` akan memaksa
  `BigInt` melewati setiap perhitungan dan setiap batas JSON demi plafon yang
  tidak akan dicapai campaign mana pun. Satu-satunya tempat `bigint` sungguhan
  bertahan adalah `sum()` di campaign summary, yang dikembalikan pg sebagai
  string dan dikonversi secara eksplisit.
- **Drizzle membuang kualifier tabel** untuk objek kolom yang di-interpolasi ke
  dalam template `sql` di select list: `${submissions.campaignId} = ${campaigns.id}`
  ter-render menjadi `"campaign_id" = "id"`, yang resolusinya jatuh ke `id`
  submissions sendiri dan menghitung baris yang salah tanpa error. Karena itu
  subquery berkorelasi di campaign summary ditulis sebagai SQL literal, dengan
  komentar alasannya. Ini ketemu karena endpoint-nya mengembalikan
  `submissionCount: 2` untuk campaign dengan 6.297 submission — maka ada test
  yang mengunci angka itu.
- **Seed menempatkan semua submission di `pending`** pada Postgres 16. Statusnya
  dipilih di sebuah `cross join lateral` yang tidak mereferensikan baris luar,
  jadi planner mengevaluasinya sekali dan 50.000 baris memakai hasil yang sama.
  `schema.sql` adalah input pemberian dan tidak diubah; test perilaku membangun
  fixture-nya sendiri sehingga tetap mencakup baris `approved` dan `rejected`.
  Memfilter `/review` dengan `approved` pada database yang baru di-seed
  menampilkan tabel kosong karena ini, bukan karena filternya rusak.
- **Legacy Approval**: baris `approved` dari seed memang tidak punya Earning dan
  tidak memotong budget. Riwayat baca-saja, tidak ada yang merekonsiliasinya —
  itu sebabnya `grossPaid` di campaign summary tidak sama dengan
  `totalBudget - remainingBudget`.

## Halaman `/review`

Sebuah server component membaca `searchParams`, menerapkan default
`status=pending` miliknya sendiri, lalu memanggil `listSubmissions` langsung.
State filter tinggal di URL, jadi ia bertahan saat reload dan bisa dikirim ke
orang lain.

**Kedua efek samping dimiliki oleh list, bukan oleh widget yang memicunya.** Ini
disengaja dan inilah bentuk yang paling layak di-review:

- [`ReviewFilters`](src/components/review/review-filters.tsx) memiliki satu
  fungsi `apply`. Hanya kode itu yang tahu arti sebuah perubahan filter — param
  mana yang disentuh, bahwa offset direset, dan bahwa itu terjadi di dalam
  transition supaya `isPending` bisa berkata "Updating…". `<select>` status,
  [`CampaignPicker`](src/components/review/campaign-picker.tsx) dan
  [`CreatorPicker`](src/components/review/creator-picker.tsx) adalah input yang
  melaporkan nilai, tidak lebih.
- [`SubmissionsTable`](src/components/review/submissions-table.tsx) memiliki
  semua yang disentuh sebuah review: konfirmasinya, kedua endpoint, cara membaca
  responsnya, arti setiap status code, dan toast yang melaporkan hasilnya.
  [`SubmissionRow`](src/components/review/submission-row.tsx) presentasional — ia
  melaporkan sebuah id dan sebuah aksi, lalu merender state yang diberikan
  kepadanya. Ia tidak tahu bahwa review itu HTTP, atau bahwa ada dialog yang
  terbuka lebih dulu.

Tidak ada custom hook. Masing-masing di atas adalah satu potong state dan satu
fungsi yang dipakai di satu tempat; pembungkus `useReviews`/`useFilters` hanya
akan memindahkan baris yang sama ke belakang sebuah nama. Hook mulai berguna pada
pemanggil kedua, bukan yang pertama.

**Tidak ada yang difilter sampai Apply.** Setiap kontrol mengubah draft lokal dan
satu submit mengubah seluruh draft menjadi satu navigasi — jadi mengganti status
dan campaign sekaligus hanya sekali jalan ke server, dan input setengah jadi
tidak pernah men-query 50.000 baris. Draft-nya dimulai dari URL, dan page
memberi komponen itu sebuah key dari query string: sebuah navigasi me-mount ulang
komponennya sehingga draft-nya sama dengan yang tampil, tanpa effect yang
menyinkronkan dua sumber kebenaran.

Pagination-nya bernomor — halaman pertama, terakhir, dan halaman aktif dengan
satu tetangga di kiri-kanan, dengan celah di antaranya, yang dihitung
[`pageWindow`](src/lib/pagination.ts) dan dikunci oleh test (termasuk kasus di
mana sebuah celah hanya akan menyembunyikan satu halaman, dan bahwa satu halaman
tidak pernah muncul dua kali). Semuanya `<Link>` biasa, jadi berpindah halaman
tidak butuh JavaScript di klien dan setiap halaman adalah URL nyata yang bisa
di-bookmark.

Dua filter yang menyebut nama sesuatu memakai typeahead, bukan `<select>`, karena
select bawaan browser tidak bisa diketik. Keduanya bukan library combobox —
listbox yang difilter biasa: klik, Enter untuk hasil pertama, Escape untuk
menutup.

- **Campaign** memfilter secara lokal. Delapan campaign-nya sudah datang bersama
  halaman, jadi tidak ada yang perlu di-fetch.
- **Creator** bertanya ke database, lima sekaligus, karena 2.000 nama bukan
  daftar untuk di-scroll — mengetik lebih panjang yang mempersempitnya. Ia
  di-debounce 250 ms, membatalkan request yang masih jalan pada ketikan
  berikutnya, dan menyimpan hasil **bersama query yang dijawabnya**, sehingga
  jawaban yang datang setelah teksnya berubah tidak pernah ditampilkan. Nilainya
  tetap teks bebas: username sepotong tetap berlaku sebagai pencarian substring,
  dipilih dari saran atau tidak.

### Konfirmasi, dan mengabarkan hasilnya

Kedua aksi tidak bisa dibatalkan dan salah satunya memindahkan uang, jadi tidak
ada yang langsung jalan dari satu klik. Konfirmasinya menyebutkan nominalnya
sebelum nominal itu berpindah — untuk approve: siapa yang dibayar, berapa
Net Earning-nya, Gross Earning yang dipotong dari campaign mana, dan berapa
Remaining Budget-nya setelah itu; untuk reject: bahwa tidak ada yang dibayar dan
bahwa sebuah Review hanya terjadi sekali.

Angka di dalamnya berasal dari [`calculateEarning`](src/lib/money.ts) — fungsi
murni yang sama yang dipakai server, jadi pratinjau dan pembayaran tidak bisa
berbeda. Tetap hanya pratinjau: nominal yang benar-benar ditulis dihitung di
dalam transaksi, dari views yang dipegang baris itu saat di-lock.

`window.confirm` cuma satu baris, dan itu yang pertama dipertimbangkan. Ia tidak
bisa menata nominal supaya terbaca, dan ia membekukan event loop selama muncul.
Sebagai gantinya [`Modal`](src/components/modal.tsx) membungkus `<dialog>` bawaan
browser, yang sudah membawa focus trap, backdrop, top layer, dan
Escape-untuk-menutup — tanpa library, tanpa mengimplementasikan ulang apa pun.

Hasilnya disampaikan lewat [toast](src/components/toasts.tsx), bukan teks yang
dijejalkan ke kolom aksi: sukses berwarna hijau dan menyebutkan nominal yang
dibayar, gagal berwarna merah dan membawa pesan dari endpoint-nya sendiri —
sehingga "sudah di-review" tetap terbaca berbeda dari "Remaining Budget tidak
cukup". Baris yang gagal kembali ke keadaan semula dengan tombolnya aktif, karena
sebagian besar kegagalan memang layak dicoba ulang. Baris tetap menyimpan
keadaan akhirnya sendiri ("Paid Rp…", "Rejected") supaya jelas baris **mana** yang
berhasil.

### Dialog detail

Setiap baris punya tombol Details, dan judul campaign membuka hal yang sama.
Isinya: submission-nya (id, creator, platform, tautan video, views, status, kedua
timestamp), campaign-nya (brand, status, CPM, Total Budget dan Remaining Budget),
dan berapa yang akan dibayar kalau di-approve sekarang — termasuk satu baris
penjelasan, bila relevan, bahwa views-nya membulat ke nol rupiah atau bahwa
budget-nya tidak akan menutup Gross Earning.

Tidak butuh endpoint dan tidak punya state loading: kolom campaign-nya menumpang
join yang sudah dilakukan query listing. Fetch per baris saat dialog dibuka akan
menjadi N+1 yang menunggu untuk ditulis.

Empat state-nya: loading berupa skeleton `Suspense` yang di-key pada query
string, jadi ia muncul lagi setiap kali filter berubah; kosong membedakan "tidak
ada yang cocok" dari "halaman ini sudah melewati baris terakhir"; filter tidak
valid merender pesan validasinya di server; dan `error.tsx` menangkap database
yang tidak menjawab, dengan menyatakan terang-terangan bahwa tidak ada yang
di-approve.

Warna dipusatkan di [`src/components/ui.tsx`](src/components/ui.tsx) supaya
perbaikan kontras cukup sekali. Teks redup memakai `zinc-600` / `zinc-400`, bukan
`zinc-500` yang terbaca kelabu-di-atas-kelabu di **kedua** latar. Setiap simpul
teks di halaman diukur terhadap latar terhitungnya yang sebenarnya di browser:
rasio terendah sekarang 5,36:1 (putih di atas `emerald-700`, tombol Approve) di
kedua tema, terhadap minimum 4,5:1. Satu-satunya pengecualian yang disengaja
adalah Previous/Next yang sedang mati, yang memang harus terbaca tidak tersedia.

Hal-hal kecil di file yang sama supaya konsisten dengan sendirinya: status
dirender `HURUF BESAR` di tabel dan `Huruf depan besar` di filter (`<option>`
mengabaikan `text-transform` di sebagian browser, jadi label itu dikapitalkan di
JS), platform `Huruf depan besar`, Approve hijau dan Reject merah karena
keduanya melakukan hal yang berlawanan, dan setiap tombol membawa
`cursor-pointer` — reset Tailwind memberi tombol `cursor: default`, yang terbaca
"tidak bisa diklik".

Tabelnya juga menampilkan **Remaining Budget setiap campaign dengan Total
Budget-nya di bawah**, karena itulah angka yang menentukan sebuah approve berhasil
atau tidak; melihatnya langsung di baris berarti tidak perlu membuka dialog hanya
untuk tahu kenapa sebuah approve ditolak.

### Satu bug yang tersingkap oleh refactor ini

"All statuses" tidak berfungsi. Page menganggap `status` yang **tidak ada**
sebagai "pakai default, `pending`", sementara filter dulu **menghapus** param itu
saat dikosongkan — jadi memilih "All statuses" langsung kembali ke `pending`.
Sekarang `apply` menulis `?status=` untuk kasus itu: tidak ada berarti "default",
ada tapi kosong berarti "semua". API sudah membaca param kosong sebagai tanpa
filter, jadi yang salah hanya penulis di sisi page.

## Yang dipotong, dan apa selanjutnya

- **Tidak ada test komponen.** React Testing Library tidak dipasang. Risiko yang
  dinilai ada di uang dan transaksinya, dan ke situ waktunya dialokasikan;
  halamannya diverifikasi dengan menjalankannya di browser sungguhan —
  meng-approve sebuah baris, memastikan baris `earnings` dan Remaining Budget-nya
  tepat, lalu memeriksa pesan 409/422.
- **`count(*)` eksak di setiap listing**, dan itu hal pertama yang akan melambat
  jauh di atas 50.000 baris. Peningkatannya: estimasi murah dari
  `pg_class.reltuples` untuk hitungan tanpa filter, atau melepas total eksak dan
  memakai cursor keyset tanpa offset (`where (submitted_at, id) < (?, ?)`), yang
  sudah disiapkan oleh urutan `submitted_at desc, id desc`.
- **Offset yang dalam.** `offset 40000` tetap menyusuri 40.000 entri index.
  Solusinya sama: pagination keyset. Cukup untuk 2.500 halaman queue admin, tidak
  cukup untuk API publik.
- **Tanpa autentikasi.** Hanya ada satu aktor di irisan ini dan soal tidak
  memintanya, jadi setiap request dipercaya sebagai admin.
- **Halaman untuk endpoint summary.** B3 baru berupa JSON; belum ada bagian UI
  yang memakainya.
- **Reject tanpa alasan.** Skemanya tidak punya tempat untuk menyimpannya
  ([ADR-0005](docs/adr/0005-rejection-is-the-other-half-of-a-review.md)).
- **Tanpa review massal.** Satu baris sekali jalan; queue 50.000 baris pada
  akhirnya menginginkan "approve semua yang cocok dengan filter ini", yang
  merupakan transaksi lain dan cerita konfirmasi yang lain juga.
