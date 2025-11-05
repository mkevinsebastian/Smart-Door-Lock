package main

import (
	"sync" 
	"crypto/aes"
	"crypto/cipher"
	"crypto/md5"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var jwtSecret = []byte("super-secret-key")
var aesKey = []byte("12345678901234567890123456789012") // 32 bytes exactly for AES-256

// --- TELEGRAM ---
var (
	telegramBotToken = "7273408012:AAEAcr-u0AjF8gaT2sPLxYLOPdcNV3jUKxI"
	telegramChatID   int64 = 7805994005
	botAPI           *tgbotapi.BotAPI
)

// --- MQTT Configuration ---
var (
	mqttClient mqtt.Client
	mqttBroker = "tcp://localhost:1883"
	mqttClientID = "doorlock_backend"
)

var deviceStatus = struct {
	sync.RWMutex
	Data map[string]interface{}
}{
	Data: make(map[string]interface{}),
}

// ====== MODELS ======
type User struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username" gorm:"uniqueIndex"`
	Password  string    `json:"-"` // MD5 hash
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type Attendance struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username"`
	AccessID  string    `json:"access_id"`
	Status    string    `json:"status"`
	Arrow     string    `json:"arrow"` // "in" atau "out"
	CreatedAt time.Time `json:"created_at"`
}

type Alarm struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username"`
	AccessID  string    `json:"access_id"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

type DoorlockUser struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name"`
	AccessID  string    `json:"access_id" gorm:"uniqueIndex"`
	DoorID    string    `json:"door_id"`
	Pin       string    `json:"pin" gorm:"size:6"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// ====== TREND ANALYSIS MODELS ======
type DoorOpenLog struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	DoorID    string    `json:"door_id"`
	AccessID  string    `json:"access_id"`
	Username  string    `json:"username"`
	Duration  int       `json:"duration"`
	CreatedAt time.Time `json:"created_at"`
}

type AccessFrequency struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	AccessID     string    `json:"access_id"`
	Username     string    `json:"username"`
	AccessCount  int       `json:"access_count"`
	TimeFrame    string    `json:"time_frame"`
	PeriodStart  time.Time `json:"period_start"`
	PeriodEnd    time.Time `json:"period_end"`
}

// ====== DB INITIALIZATION & SEEDING ======
func initDB() *gorm.DB {
	db, err := gorm.Open(sqlite.Open("data.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	
	if err := db.AutoMigrate(&User{}, &Attendance{}, &Alarm{}, &DoorlockUser{}, 
		&DoorOpenLog{}, &AccessFrequency{}); err != nil {
		log.Fatal(err)
	}

	var userCount int64
	db.Model(&User{}).Count(&userCount)
	if userCount == 0 {
		log.Println("Database is empty, seeding initial data...")
		seedUsers(db) 
		seedDoorlockUsers(db)
		seedAttendanceData(db)
		log.Println("✅ Initial data seeding complete.")
	}

	return db
}

func seedUsers(db *gorm.DB) {
	adminPass := HashMD5("admin123")
	userPass := HashMD5("password123")

	users := []User{
		{Username: "admin", Password: adminPass, Role: "admin", IsActive: true, CreatedAt: time.Now()},
		{Username: "budi", Password: userPass, Role: "user", IsActive: true, CreatedAt: time.Now()},
		{Username: "citra", Password: userPass, Role: "user", IsActive: false, CreatedAt: time.Now()},
	}

	if err := db.Create(&users).Error; err != nil {
		log.Fatalf("❌ Failed to seed users: %v", err)
	}
	log.Println(" 	-> ✅ Users seeded.")
}

func seedDoorlockUsers(db *gorm.DB) {
	doorUsers := []DoorlockUser{
		{Name: "Budi", AccessID: "A001", DoorID: "D01", Pin: "123456", IsActive: true, CreatedAt: time.Now()},
		{Name: "Citra", AccessID: "A002", DoorID: "D01", Pin: "654321", IsActive: true, CreatedAt: time.Now()},
		{Name: "Dewi", AccessID: "A003", DoorID: "D02", Pin: "111111", IsActive: true, CreatedAt: time.Now()},
		{Name: "Eka", AccessID: "A004", DoorID: "D02", Pin: "222222", IsActive: true, CreatedAt: time.Now()},
		{Name: "Fajar", AccessID: "A005", DoorID: "D01", Pin: "333333", IsActive: false, CreatedAt: time.Now()},
	}
	if err := db.Create(&doorUsers).Error; err != nil {
		log.Fatalf("❌ Failed to seed doorlock users: %v", err)
	}
	log.Println(" 	-> ✅ Doorlock Users seeded.")
}

func seedAttendanceData(db *gorm.DB) {
	loc, _ := time.LoadLocation("Asia/Jakarta")

	attendances := []Attendance{
		{Username: "Budi", AccessID: "A001", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 5, 9, 15, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 5, 14, 30, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", Arrow: "out", CreatedAt: time.Date(2025, 10, 5, 17, 0, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 6, 8, 5, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 6, 8, 7, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 6, 8, 10, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 6, 9, 0, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", Arrow: "out", CreatedAt: time.Date(2025, 10, 6, 17, 30, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 7, 8, 20, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 7, 9, 5, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", Arrow: "out", CreatedAt: time.Date(2025, 10, 7, 18, 0, 0, 0, loc)},
	}

	if err := db.Create(&attendances).Error; err != nil {
		log.Fatalf("❌ Failed to seed attendance data: %v", err)
	}

	log.Println(" 	-> ✅ Attendance data seeded.")
}

// ====== HASHING & ENCRYPTION FUNCTIONS ======
func HashMD5(password string) string {
	hash := md5.Sum([]byte(password))
	return hex.EncodeToString(hash[:])
}

// Simple AES encryption function
func EncryptAES(plaintext string) (string, error) {
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return "", fmt.Errorf("cannot create cipher: %v", err)
	}

	// Use GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("cannot create GCM: %v", err)
	}

	// Create a nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("cannot read random bytes: %v", err)
	}

	// Encrypt the data
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func DecryptAES(ciphertext string) (string, error) {
	// Decode from base64
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("cannot decode base64: %v", err)
	}

	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return "", fmt.Errorf("cannot create cipher: %v", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("cannot create GCM: %v", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", fmt.Errorf("decryption failed: %v", err)
	}

	return string(plaintext), nil
}

// --- TELEGRAM BOT FUNCTIONS ---
func initTelegramBot() {
	var err error
	botAPI, err = tgbotapi.NewBotAPI(telegramBotToken)
	
	if err != nil {
		log.Printf("PERINGATAN: Gagal menginisialisasi Telegram Bot: %v. Notifikasi nonaktif.", err)
		botAPI = nil
	} else {
		log.Println("✅ Telegram Bot terhubung:", botAPI.Self.UserName)
	}
}

func sendTelegramNotification(message string) error {
	if botAPI == nil {
		return errors.New("Telegram bot tidak terinisialisasi")
	}

	msg := tgbotapi.NewMessage(telegramChatID, message)
	if _, err := botAPI.Send(msg); err != nil {
		return fmt.Errorf("gagal mengirim pesan: %w", err)
	}
	
	log.Println("Notifikasi Telegram terkirim.")
	return nil
}

// Initialize device status
func initDeviceStatus() {
	deviceStatus.Lock()
	deviceStatus.Data["door"] = "closed"
	deviceStatus.Data["reader"] = "disconnected"
	deviceStatus.Data["pinpad"] = "disconnected"
	deviceStatus.Data["buzzer"] = false
	deviceStatus.Data["last_updated"] = time.Now()
	deviceStatus.Unlock()
}

// --- MQTT FUNCTIONS ---
func initMQTT() {
	opts := mqtt.NewClientOptions()
	opts.AddBroker(mqttBroker)
	opts.SetClientID(mqttClientID)
	opts.SetKeepAlive(60 * time.Second)
	opts.SetPingTimeout(1 * time.Second)

	mqttClient = mqtt.NewClient(opts)
	if token := mqttClient.Connect(); token.Wait() && token.Error() != nil {
		log.Printf("PERINGATAN: Gagal terhubung ke MQTT broker: %v", token.Error())
		mqttClient = nil
	} else {
		log.Println("✅ MQTT Client terhubung")
	}
}

func publishMQTT(topic string, message string) error {
	if mqttClient == nil || !mqttClient.IsConnected() {
		return errors.New("MQTT client tidak terhubung")
	}

	token := mqttClient.Publish(topic, 0, false, message)
	token.Wait()
	if token.Error() != nil {
		return fmt.Errorf("gagal publish MQTT: %w", token.Error())
	}
	
	log.Printf("MQTT message published: %s -> %s", topic, message)
	return nil
}

// ====== JWT & AUTH MIDDLEWARE ======
type jwtClaims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

func makeToken(username string) (string, error) {
	claims := jwtClaims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(jwtSecret)
}

func parseToken(tok string) (*jwtClaims, error) {
	parsed, err := jwt.ParseWithClaims(tok, &jwtClaims{}, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := parsed.Claims.(*jwtClaims); ok && parsed.Valid {
		return claims, nil
	}
	return nil, errors.New("invalid token")
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if len(h) < 8 || h[:7] != "Bearer " {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		claims, err := parseToken(h[7:])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}
		c.Set("username", claims.Username)
		c.Next()
	}
}

func stringToUint(s string) uint {
	var i uint
	fmt.Sscanf(s, "%d", &i)
	return i
}

// ====== TREND ANALYSIS FUNCTIONS ======
func analyzeFrequentAccess(db *gorm.DB, hours int) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	
	timeThreshold := time.Now().Add(-time.Duration(hours) * time.Hour)
	
	err := db.Model(&Attendance{}).
		Select("access_id, username, COUNT(*) as access_count").
		Where("created_at >= ?", timeThreshold).
		Group("access_id, username").
		Having("COUNT(*) > ?", 5).
		Find(&results).Error
		
	return results, err
}

func analyzeLongOpenDoors(db *gorm.DB, durationThreshold int) ([]map[string]interface{}, error) {
	var results []map[string]interface{}
	
	err := db.Model(&DoorOpenLog{}).
		Select("door_id, access_id, username, AVG(duration) as avg_duration, COUNT(*) as occurrence_count").
		Where("duration > ?", durationThreshold).
		Group("door_id, access_id, username").
		Find(&results).Error
		
	return results, err
}

// ====== ENCRYPTED LOGIN HANDLER ======
func encryptResponse(data interface{}) (map[string]interface{}, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("cannot marshal data: %v", err)
	}
	
	encrypted, err := EncryptAES(string(jsonData))
	if err != nil {
		return nil, fmt.Errorf("cannot encrypt data: %v", err)
	}
	
	return map[string]interface{}{
		"data": encrypted,
	}, nil
}

// ====== MAIN APPLICATION ======
func main() {
	db := initDB()
	initTelegramBot()
	initMQTT()
	initDeviceStatus() // Initialize device status

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"http://localhost:5173"},
		AllowMethods: []string{"GET", "POST", "DELETE", "PUT", "OPTIONS"},
		AllowHeaders: []string{"Authorization", "Content-Type"},
	}))

	api := r.Group("/api")

	// ====== LOGIN (DENGAN ENKRIPSI) ======
	api.POST("/login", func(c *gin.Context) {
		var encryptedReq struct {
			Data string `json:"data"`
		}

		if err := c.BindJSON(&encryptedReq); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad request format"})
			return
		}

		if encryptedReq.Data == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "encrypted data is required"})
			return
		}

		// Decrypt the request data
		decryptedData, err := DecryptAES(encryptedReq.Data)
		if err != nil {
			log.Printf("Decryption error: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to decrypt data: " + err.Error()})
			return
		}

		// Parse decrypted data
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}

		if err := json.Unmarshal([]byte(decryptedData), &req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid decrypted data format"})
			return
		}

		// Validate credentials
		var u User
		if err := db.Where("username = ?", req.Username).First(&u).Error; err != nil {
			// Return encrypted error response
			encryptedResp, err := encryptResponse(gin.H{"error": "invalid username or password"})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encrypt response"})
				return
			}
			c.JSON(http.StatusUnauthorized, encryptedResp)
			return
		}

		// Verify MD5 hash
		hashedInput := HashMD5(req.Password)
		if u.Password != hashedInput {
			encryptedResp, err := encryptResponse(gin.H{"error": "invalid username or password"})
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encrypt response"})
				return
			}
			c.JSON(http.StatusUnauthorized, encryptedResp)
			return
		}

		// Generate token and send encrypted response
		token, _ := makeToken(u.Username)
		responseData := gin.H{
			"token": token, 
			"username": u.Username, 
			"role": u.Role,
		}
		
		encryptedResp, err := encryptResponse(responseData)
		if err != nil {
			log.Printf("Encryption error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encrypt response: " + err.Error()})
			return
		}
		
		c.JSON(http.StatusOK, encryptedResp)
	})

	// ====== UTILITY ENDPOINT UNTUK ENCRYPT DATA TESTING ======
	api.POST("/encrypt-test", func(c *gin.Context) {
		var data map[string]interface{}
		if err := c.BindJSON(&data); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid data format"})
			return
		}
		
		jsonData, err := json.Marshal(data)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot marshal data"})
			return
		}
		
		encrypted, err := EncryptAES(string(jsonData))
		if err != nil {
			log.Printf("Encryption error in /encrypt-test: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "encryption failed: " + err.Error()})
			return
		}
		
		c.JSON(http.StatusOK, gin.H{"encrypted": encrypted})
	})

	// ====== SIMPLE LOGIN (BACKUP - TANPA ENKRIPSI) ======
	api.POST("/login-simple", func(c *gin.Context) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}

		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
			return
		}

		var u User
		if err := db.Where("username = ?", req.Username).First(&u).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		// Verify MD5 hash
		hashedInput := HashMD5(req.Password)
		if u.Password != hashedInput {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		token, _ := makeToken(u.Username)
		c.JSON(http.StatusOK, gin.H{
			"token": token, 
			"username": u.Username, 
			"role": u.Role,
		})
	})

	// Protected routes
	api.Use(authMiddleware())

	// ====== DEVICE STATUS ENDPOINTS (REST API BYPASS MQTT) ======

	// Get all device status
	api.GET("/device/status", func(c *gin.Context) {
		deviceStatus.RLock()
		defer deviceStatus.RUnlock()
		
		c.JSON(http.StatusOK, deviceStatus.Data)
	})

	// Update door status
	api.POST("/device/status/door", func(c *gin.Context) {
		var req struct {
			DoorID  string `json:"door_id"`
			Status  string `json:"status"`
		}
		
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		
		deviceStatus.Lock()
		deviceStatus.Data["door"] = req.Status
		deviceStatus.Data["last_updated"] = time.Now()
		deviceStatus.Unlock()
		
		log.Printf("Door status updated via REST: %s -> %s", req.DoorID, req.Status)
		
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": fmt.Sprintf("Door %s status updated to %s", req.DoorID, req.Status),
		})
	})

	// Update reader status
	api.POST("/device/status/reader", func(c *gin.Context) {
		var req struct {
			ReaderID string `json:"reader_id"`
			Status   string `json:"status"`
		}
		
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		
		deviceStatus.Lock()
		deviceStatus.Data["reader"] = req.Status
		deviceStatus.Data["last_updated"] = time.Now()
		deviceStatus.Unlock()
		
		log.Printf("Reader status updated via REST: %s -> %s", req.ReaderID, req.Status)
		
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": fmt.Sprintf("Reader %s status updated to %s", req.ReaderID, req.Status),
		})
	})

	// Update pinpad status
	api.POST("/device/status/pinpad", func(c *gin.Context) {
		var req struct {
			PinpadID string `json:"pinpad_id"`
			Status   string `json:"status"`
		}
		
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		
		deviceStatus.Lock()
		deviceStatus.Data["pinpad"] = req.Status
		deviceStatus.Data["last_updated"] = time.Now()
		deviceStatus.Unlock()
		
		log.Printf("Pinpad status updated via REST: %s -> %s", req.PinpadID, req.Status)
		
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": fmt.Sprintf("Pinpad %s status updated to %s", req.PinpadID, req.Status),
		})
	})

	// Update buzzer status
	api.POST("/device/status/buzzer", func(c *gin.Context) {
		var req struct {
			BuzzerID string `json:"buzzer_id"`
			Status   bool   `json:"status"`
		}
		
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		
		deviceStatus.Lock()
		deviceStatus.Data["buzzer"] = req.Status
		deviceStatus.Data["last_updated"] = time.Now()
		deviceStatus.Unlock()
		
		statusText := "off"
		if req.Status {
			statusText = "on"
		}
		
		log.Printf("Buzzer status updated via REST: %s -> %s", req.BuzzerID, statusText)
		
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": fmt.Sprintf("Buzzer %s status updated to %s", req.BuzzerID, statusText),
		})
	})

	// Simulate attendance event
	api.POST("/device/events/attendance", func(c *gin.Context) {
		var req struct {
			Username  string `json:"username"`
			AccessID  string `json:"access_id"`
			Status    string `json:"status"`
			Arrow     string `json:"arrow"`
		}
		
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		
		// Create attendance record
		rec := Attendance{
			Username:  req.Username,
			AccessID:  req.AccessID,
			Status:    req.Status,
			Arrow:     req.Arrow,
			CreatedAt: time.Now(),
		}
		
		if err := db.Create(&rec).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create attendance record"})
			return
		}
		
		log.Printf("Attendance event simulated via REST: %s (%s) - %s", req.Username, req.AccessID, req.Arrow)
		
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Attendance event simulated successfully",
			"record_id": rec.ID,
		})
	})

	// Simulate alarm event
	api.POST("/device/events/alarm", func(c *gin.Context) {
		var req struct {
			Username string `json:"username"`
			AccessID string `json:"access_id"`
			Reason   string `json:"reason"`
		}
		
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		
		// Create alarm record
		al := Alarm{
			Username:  req.Username,
			AccessID:  req.AccessID,
			Reason:    req.Reason,
			CreatedAt: time.Now(),
		}
		
		if err := db.Create(&al).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create alarm record"})
			return
		}
		
		log.Printf("Alarm event simulated via REST: %s (%s) - %s", req.Username, req.AccessID, req.Reason)
		
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Alarm event simulated successfully",
			"record_id": al.ID,
		})
	})

	// ====== USER MANAGEMENT ======
	userGroup := api.Group("/users")
	userGroup.GET("/", func(c *gin.Context) {
		var users []User
		if err := db.Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch users"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"users": users})
	})

	userGroup.POST("/", func(c *gin.Context) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
			Role     string `json:"role"`
		}

		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		if req.Username == "" || req.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "username and password are required"})
			return
		}

		hashedPassword := HashMD5(req.Password)
		user := User{
			Username:  req.Username,
			Password:  hashedPassword,
			Role:      req.Role,
			IsActive:  true,
			CreatedAt: time.Now(),
		}

		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
			return
		}

		c.JSON(http.StatusCreated, user)
	})

	userGroup.PUT("/:id", func(c *gin.Context) {
		id := c.Param("id")

		var req struct {
			Username string `json:"username"`
			Password string `json:"password,omitempty"`
			Role     string `json:"role"`
			IsActive bool   `json:"is_active"`
		}

		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		var user User
		if err := db.First(&user, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}

		user.Username = req.Username
		user.Role = req.Role
		user.IsActive = req.IsActive

		if req.Password != "" {
			hashedPassword := HashMD5(req.Password)
			user.Password = hashedPassword
		}

		if err := db.Save(&user).Error; err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
			return
		}

		c.JSON(http.StatusOK, user)
	})

	userGroup.DELETE("/:id", func(c *gin.Context) {
		id := c.Param("id")

		currentUsername, _ := c.Get("username")
		var currentUser User
		db.Where("username = ?", currentUsername).First(&currentUser)

		if currentUser.ID == stringToUint(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete your own account"})
			return
		}

		result := db.Delete(&User{}, id)
		if result.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "user deleted successfully"})
	})

	// ====== DOORLOCK USERS (UPDATED WITH PIN) ======
	doorlock := api.Group("/doorlock")
	doorlock.GET("/users", func(c *gin.Context) {
		var list []DoorlockUser
		if err := db.Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doorlock users"})
			return
		}
		c.JSON(http.StatusOK, list)
	})

	doorlock.POST("/users", func(c *gin.Context) {
		var req struct {
			Name     string `json:"name"`
			AccessID string `json:"access_id"`
			DoorID   string `json:"door_id"`
			Pin      string `json:"pin"`
		}
		if err := c.BindJSON(&req); err != nil || req.Name == "" || req.AccessID == "" || req.DoorID == "" || req.Pin == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1})
			return
		}

		u := DoorlockUser{
			Name:      req.Name,
			AccessID:  req.AccessID,
			DoorID:    req.DoorID,
			Pin:       req.Pin,
			IsActive:  true,
			CreatedAt: time.Now(),
		}
		if err := db.Create(&u).Error; err != nil {
			c.JSON(http.StatusConflict, gin.H{"status": false, "error_code": 2})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": true, "error_code": 0})
	})

	doorlock.DELETE("/users/:access_id", func(c *gin.Context) {
		accessID := c.Param("access_id")
		res := db.Where("access_id = ?", accessID).Delete(&DoorlockUser{})
		if res.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": false, "error_code": 3, "message": "user not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": true, "error_code": 0, "message": "deleted successfully"})
	})

	// ====== ATTENDANCE (UPDATED WITH ARROW) ======
	api.POST("/attendance", func(c *gin.Context) {
		var req struct{ 
			AccessID string `json:"access_id"`
			Arrow    string `json:"arrow"` // "in" atau "out"
		}
		if err := c.BindJSON(&req); err != nil || req.AccessID == "" || req.Arrow == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1})
			return
		}

		var doorUser DoorlockUser
		if err := db.Where("access_id = ?", req.AccessID).First(&doorUser).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": false, "error_code": 2, "message": "access_id not found"})
			return
		}

		rec := Attendance{
			Username:  doorUser.Name,
			AccessID:  req.AccessID,
			Status:    "success",
			Arrow:     req.Arrow,
			CreatedAt: time.Now(),
		}
		db.Create(&rec)
		c.JSON(http.StatusOK, gin.H{"status": true, "error_code": 0})
	})
	
	api.GET("/attendance", func(c *gin.Context) {
		var list []Attendance
		if err := db.Order("created_at desc").Find(&list).Error; err != nil {
			log.Printf("Error fetching attendance: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch attendance data"})
			return
		}
		log.Printf("Fetched %d attendance records", len(list))
		c.JSON(http.StatusOK, list)
	})

	api.GET("/attendance/summary", func(c *gin.Context) {
		var summary []struct {
			Date  string `json:"date"`
			Count int    `json:"count"`
		}

		sevenDaysAgo := time.Now().AddDate(0, 0, -7)

		db.Model(&Attendance{}).
			Select("DATE(created_at) as date, COUNT(*) as count").
			Where("created_at >= ?", sevenDaysAgo).
			Group("DATE(created_at)").
			Order("date DESC").
			Limit(7).
			Find(&summary)

		c.JSON(http.StatusOK, summary)
	})

	// ====== ALARM (UPDATED - NO ACCESS_ID FILTER FOR TYPE 1) ======
	api.POST("/alarm", func(c *gin.Context) {
		var req struct {
			AlarmType int    `json:"alarm_type"`
			AccessID  string `json:"access_id"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1})
			return
		}

		var username string
		var accessID string

		// Untuk alarm type 1 (gagal masuk), skip access_id validation
		if req.AlarmType == 1 {
			username = "Unknown"
			accessID = req.AccessID
		} else {
			// Untuk alarm type lainnya, validasi access_id
			if req.AccessID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1})
				return
			}
			
			var doorUser DoorlockUser
			if err := db.Where("access_id = ?", req.AccessID).First(&doorUser).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"status": false, "error_code": 2, "message": "access_id not found"})
				return
			}
			username = doorUser.Name
			accessID = req.AccessID
		}

		reason := "Unknown"
		if req.AlarmType == 1 {
			reason = "3 kali gagal masuk"
		} else if req.AlarmType == 2 {
			reason = "Pintu terbuka > 1 menit"
		}

		al := Alarm{
			Username:  username,
			AccessID:  accessID,
			Reason:    reason,
			CreatedAt: time.Now(),
		}
		
		if err := db.Create(&al).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": false, "error_code": 3, "message": "failed to save alarm"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": true, "error_code": 0})

		// Send Telegram notification
		go func() {
			loc, _ := time.LoadLocation("Asia/Jakarta")
			wibTime := al.CreatedAt.In(loc)

			message := fmt.Sprintf(
				"🚨 ALARM TERDETEKSI 🚨\n\nNama: %s\nAccess ID: %s\nAlasan: %s\nWaktu: %s WIB",
				al.Username,
				al.AccessID,
				al.Reason,
				wibTime.Format("2 Jan 2006, 15:04:05"),
			)

			if err := sendTelegramNotification(message); err != nil {
				log.Printf("Gagal mengirim notifikasi Telegram: %v", err)
			}
		}()
	})

	api.GET("/alarms", func(c *gin.Context) {
		var list []Alarm
		if err := db.Order("created_at desc").Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch alarms"})
			return
		}
		c.JSON(http.StatusOK, list)
	})

	// ====== HEALTH & ROOT ENDPOINTS ======
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now(),
			"service":   "doorlock-backend",
		})
	})
	
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Doorlock Backend API",
			"version": "1.0.0",
		})
	})

	// ====== TREND ANALYSIS ENDPOINTS ======
	api.GET("/trends/frequent-access", func(c *gin.Context) {
		hours := 24
		if h := c.Query("hours"); h != "" {
			fmt.Sscanf(h, "%d", &hours)
		}

		results, err := analyzeFrequentAccess(db, hours)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menganalisis data akses"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"time_period_hours": hours,
			"frequent_access":   results,
		})
	})

	api.GET("/trends/long-open-doors", func(c *gin.Context) {
		durationThreshold := 60
		if d := c.Query("duration"); d != "" {
			fmt.Sscanf(d, "%d", &durationThreshold)
		}

		results, err := analyzeLongOpenDoors(db, durationThreshold)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menganalisis data pintu"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"duration_threshold_seconds": durationThreshold,
			"long_open_doors":           results,
		})
	})

	api.POST("/trends/door-open-log", func(c *gin.Context) {
		var req struct {
			DoorID   string `json:"door_id"`
			AccessID string `json:"access_id"`
			Username string `json:"username"`
			Duration int    `json:"duration"`
		}
		
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		log := DoorOpenLog{
			DoorID:    req.DoorID,
			AccessID:  req.AccessID,
			Username:  req.Username,
			Duration:  req.Duration,
			CreatedAt: time.Now(),
		}

		if err := db.Create(&log).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save door open log"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "success"})
	})

	// ====== MQTT CONTROL ENDPOINTS ======
	api.POST("/control/doorlock", func(c *gin.Context) {
		var req struct {
			DoorID  string `json:"door_id"`
			Command string `json:"command"`
		}
		
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		topic := fmt.Sprintf("doorlock/%s/control", req.DoorID)
		message := fmt.Sprintf(`{"command": "%s", "timestamp": "%s"}`, 
			req.Command, time.Now().Format(time.RFC3339))

		if err := publishMQTT(topic, message); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Gagal mengirim perintah ke doorlock",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": fmt.Sprintf("Perintah %s dikirim ke door %s", req.Command, req.DoorID),
		})
	})

	api.POST("/control/buzzer", func(c *gin.Context) {
		var req struct {
			BuzzerID string `json:"buzzer_id"`
			Command  string `json:"command"`
			Duration int    `json:"duration,omitempty"`
		}
		
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		topic := fmt.Sprintf("buzzer/%s/control", req.BuzzerID)
		message := fmt.Sprintf(`{"command": "%s", "duration": %d, "timestamp": "%s"}`,
			req.Command, req.Duration, time.Now().Format(time.RFC3339))

		if err := publishMQTT(topic, message); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Gagal mengirim perintah ke buzzer",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": fmt.Sprintf("Perintah %s dikirim ke buzzer %s", req.Command, req.BuzzerID),
		})
	})

	// ====== DASHBOARD STATISTICS ======
	api.GET("/dashboard/stats", func(c *gin.Context) {
		var stats struct {
			TotalUsers        int64 `json:"total_users"`
			TotalAttendance   int64 `json:"total_attendance"`
			ActiveAlarms      int64 `json:"active_alarms"`
			TodayAttendance   int64 `json:"today_attendance"`
		}

		db.Model(&User{}).Count(&stats.TotalUsers)
		db.Model(&Attendance{}).Count(&stats.TotalAttendance)
		
		today := time.Now().AddDate(0, 0, -1)
		db.Model(&Alarm{}).Where("created_at >= ?", today).Count(&stats.ActiveAlarms)
		
		todayStart := time.Now().Truncate(24 * time.Hour)
		db.Model(&Attendance{}).Where("created_at >= ?", todayStart).Count(&stats.TodayAttendance)

		c.JSON(http.StatusOK, stats)
	})

	log.Println("🚀 Backend listening on :8090")
	if err := r.Run(":8090"); err != nil {
		log.Fatal(err)
	}
}