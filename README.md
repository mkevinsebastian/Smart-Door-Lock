# SMART DOOR LOCK SYSTEM
## IoT Project - Binus University

## 📋 PROJECT OVERVIEW
Project ini merupakan implementasi sistem **Smart Door Lock** berbasis IoT dengan arsitektur:
Frontend (React)
↓ HTTP/REST
Backend (Golang) → SQLite Database
↓ MQTT
MQTT Broker (Mosquitto)
↓
IoT Devices (Door Lock, Buzzer, Sensors)
↑
Telegram Bot ← Notifications


## 🚀 FITUR UTAMA

### 1. Authentication & Security
- ✅ Login dengan JWT Authentication
- ✅ Encrypted communication
- ✅ Role-based access (Admin/User)

### 2. User Management  
- ✅ System users management
- ✅ Doorlock users dengan PIN 2FA
- ✅ Real-time user synchronization via MQTT

### 3. Access Control & Monitoring
- ✅ Automatic attendance recording
- ✅ Real-time door status monitoring
- ✅ Alarm system dengan Telegram notifications

### 4. Dashboard & Analytics
- ✅ Real-time dashboard dengan auto-refresh
- ✅ Separate Visitor In/Out charts
- ✅ Trend analysis (frequent access, long open doors)

### 5. IoT Integration
- ✅ MQTT-based device control
- ✅ Door lock remote control
- ✅ Buzzer control
- ✅ Real-time status updates

## 📂 PROJECT STRUCTURE
Smart-Door-Lock/
├── backend/ # Golang Backend API
│ ├── main.go # Main application
│ ├── go.mod # Go dependencies
│ ├── data.db # SQLite database (auto-generated)
│ └── Dockerfile # Docker configuration
├── frontend/ # React Frontend
│ ├── src/
│ │ ├── components/ # React components
│ │ ├── services/
│ │ │ └── api.js # API services & MQTT
│ │ └── pages/ # Application pages
│ └── package.json
├── mosquitto/ # MQTT Broker config
│ └── config/
│ └── mosquitto.conf
└── docker-compose.yml # Docker compose setup

## 🛠️ PREREQUISITES

### Required Software:
1. **Node.js** (v16 or higher) - for frontend
2. **Go** (v1.21 or higher) - for backend  
3. **Docker Desktop** - for MQTT broker
4. **Git** - version control

### Optional Tools for Testing:
1. **MQTTX** (GUI MQTT client) - download from https://mqttx.app/
2. **Postman** - for API testing

## 🚀 QUICK START

### OPTION 1: DEVELOPMENT MODE (Recommended for Coding)
```bash
# Terminal 1 - Start MQTT Broker
docker-compose up -d mosquitto

# Terminal 2 - Start Backend (Hot Reload)
cd backend
go run main.go

# Terminal 3 - Start Frontend
cd frontend
bun run dev
```