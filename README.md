# Smart Door Lock System

Project ini merupakan implementasi sistem **Smart Door Lock** berbasis:
- Backend: Golang (Gin + SQLite)
- Frontend: React + Vite

## Architecture
Frontend (React) 
    ↓ HTTP/REST
Backend (Golang) → SQLite Database
    ↓ MQTT
MQTT Broker (Mosquitto)
    ↓
IoT Devices (Door Lock, Buzzer, Sensors)
    ↑
Telegram Bot ← Notifications

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
├── docker-compose.yml          # Docker compose setup
├── .env.example               # Environment variables template
├── backend/                   # Golang backend
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   ├── Dockerfile
│   └── data.db (auto-generated)
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── services/
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
├── mosquitto/                 # MQTT broker config
│   └── config/
│       └── mosquitto.conf
└── scripts/                   # Management scripts
    ├── start.sh
    ├── stop.sh
    └── logs.sh

## 🛠️ Cara Menjalankan

### Backend
cd backend
go run main.go

- Backend berjalan di: `http://localhost8090`

### Frontend
cd frontend
bun install
bun dev

- Frontend berjalan di: `http://localhost:5173`

## Docker
# Build and start all services
docker compose up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f

## 📌 Catatan
- File database `backend/data.db` sudah di-`.gitignore`.
- Default admin login:
  - Username: `admin`
  - Password: `admin123`
