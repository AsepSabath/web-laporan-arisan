# Web Laporan Arisan

Website laporan pembayaran arisan dengan:

- Halaman publik untuk transparansi data pembayaran
- Panel admin untuk mengelola peserta, status bayar, dan pemenang periode
- Auth admin berbasis Supabase role
- Siap deploy gratis di Netlify dari repo GitHub

## Fitur

### Halaman publik

- Menampilkan nama pemenang periode aktif
- Menampilkan total peserta sudah bayar dan belum bayar
- Menampilkan total uang yang sudah terkumpul
- Menampilkan status bayar tiap peserta

### Panel admin

- Login admin dengan akun Supabase
- Edit status pembayaran dan nominal pembayaran
- Tambah dan hapus peserta
- Edit nama pemenang periode aktif

## Stack

- React + Vite
- Supabase (Auth + Postgres + RLS)
- Netlify (hosting static)

## Setup Lokal

1. Install dependency:

```bash
npm install
```

2. Buat file .env berdasarkan .env.example:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Jalankan project:

```bash
npm run dev
```

## Setup Supabase

1. Buat project Supabase baru.
2. Masuk ke SQL Editor, jalankan file supabase/schema.sql.
3. Buat user admin dari menu Authentication (email + password).
4. Setelah user dibuat, tambahkan role admin lewat SQL berikut:

```sql
insert into user_roles (user_id, role)
values ('UUID_USER_DARI_AUTH_USERS', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

5. Pastikan ada 1 periode aktif di tabel periods.

## Deploy Gratis ke Netlify dari GitHub

1. Push project ini ke repository GitHub.
2. Login ke Netlify, pilih Add new project > Import from Git.
3. Pilih repository ini.
4. Build setting:
   - Build command: npm run build
   - Publish directory: dist
5. Tambahkan environment variables di Netlify:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
6. Deploy.

Catatan: file public/_redirects sudah disiapkan supaya route React (contoh /admin) tetap jalan saat refresh di Netlify.

## Rencana Pengembangan Lanjutan

- Tambah fitur periode baru dan riwayat periode
- Tambah export laporan (CSV/PDF)
- Tambah catatan pembayaran per tanggal
