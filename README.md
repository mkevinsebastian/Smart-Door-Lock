# Smart Door Lock System

Project ini merupakan implementasi sistem **Smart Door Lock** berbasis:
- Backend: Golang (Gin + SQLite)
- Frontend: React + Vite

## 🚀 Fitur Utama
1. **Login & JWT Authentication**
   - Admin dan user dengan proteksi token.
2. **Manajemen User**
   - Tambah user baru
   - Hapus user
   - List semua user
3. **Attendance**
   - Mencatat akses masuk user
   - Melihat daftar riwayat attendance
4. **Alarm**
   - Trigger alarm (3x gagal masuk atau pintu terbuka > 1 menit)
   - List riwayat alarm

## 📂 Struktur Project
Smart-Door-Lock/
│
├── backend/ # Golang backend (API + SQLite DB)
│ ├── main.go
│ ├── go.mod
│ └── data.db (ignored di .gitignore)
│
├── frontend/ # React frontend (Vite)
│ ├── src/
│ │ ├── pages/
│ │ ├── components/
│ │ └── services/
│ ├── index.html
│ ├── vite.config.js
│ └── package.json
│
└── README.md

## 🛠️ Cara Menjalankan

### Backend
cd backend
go run main.go

- Backend berjalan di: `http://localhost:8080`

### Frontend
cd frontend
bun install
bun dev

- Frontend berjalan di: `http://localhost:5173`

## 📌 Catatan
- File database `backend/data.db` sudah di-`.gitignore`.
- Default admin login:
  - Username: `admin`
  - Password: `admin123`
