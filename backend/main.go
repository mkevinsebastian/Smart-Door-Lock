package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json" // PERUBAHAN: Dibutuhkan untuk enkripsi/dekripsi body
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
	"golang.org/x/crypto/bcrypt" // PERUBAHAN: Menggunakan bcrypt untuk password
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var jwtSecret = []byte("super-secret-key")
var aesKey = []byte("kuncirahasia1234") // Kunci ini untuk enkripsi payload API (Kriteria 4)

// --- TELEGRAM ---
var (
	telegramBotToken = "7273408012:AAEAcr-u0AjF8gaT2sPLxYLOPdcNV3jUKxI"
	telegramChatID   int64 = 7805994005
	botAPI           *tgbotapi.BotAPI
)

// --- MQTT Configuration ---
var (
	mqttClient mqtt.Client
	mqttBroker = "tcp://localhost:1883" // Ganti dengan broker MQTT Anda
	mqttClientID = "doorlock_backend"
)

// ====== MODELS ======
type User struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username" gorm:"uniqueIndex"`
	Password  string    `json:"-"` // Tetap json:"-" agar tidak pernah terkirim
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type Attendance struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username"`
	AccessID  string    `json:"access_id"`
	Status    string    `json:"status"`
	Arrow     string    `json:"arrow"` // PERUBAHAN (Kriteria 7): in/out
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
	Pin       string    `json:"-"` // PERUBAHAN (Kriteria 5 & 6): Disimpan tapi tidak dikirim
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// ... (Model Trend Analysis tetap sama) ...
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

// PERUBAHAN (Kriteria 3): Menggunakan bcrypt
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 14)
	return string(bytes), err
}

// PERUBAHAN (Kriteria 3): Menggunakan bcrypt
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func seedUsers(db *gorm.DB) {
	// PERUBAHAN (Kriteria 3): Menggunakan HashPassword (bcrypt)
	adminPass, err := HashPassword("admin123")
	if err != nil { log.Fatalf("Gagal hash seed pass admin: %v", err) }
	
	userPass, err := HashPassword("password123")
	if err != nil { log.Fatalf("Gagal hash seed pass user: %v", err) }

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
	// PERUBAHAN (Kriteria 6): Menambahkan PIN (dihash) ke data seed
	pin1, _ := HashPassword("1234")
	pin2, _ := HashPassword("5678")
	pin3, _ := HashPassword("1111")
	pin4, _ := HashPassword("2222")
	pin5, _ := HashPassword("9999")

	doorUsers := []DoorlockUser{
		{Name: "Budi", AccessID: "A001", DoorID: "D01", Pin: pin1, IsActive: true, CreatedAt: time.Now()},
		{Name: "Citra", AccessID: "A002", DoorID: "D01", Pin: pin2, IsActive: true, CreatedAt: time.Now()},
		{Name: "Dewi", AccessID: "A003", DoorID: "D02", Pin: pin3, IsActive: true, CreatedAt: time.Now()},
		{Name: "Eka", AccessID: "A004", DoorID: "D02", Pin: pin4, IsActive: true, CreatedAt: time.Now()},
		{Name: "Fajar", AccessID: "A005", DoorID: "D01", Pin: pin5, IsActive: false, CreatedAt: time.Now()},
	}
	if err := db.Create(&doorUsers).Error; err != nil {
		log.Fatalf("❌ Failed to seed doorlock users: %v", err)
	}
	log.Println(" 	-> ✅ Doorlock Users seeded.")
}

func seedAttendanceData(db *gorm.DB) {
	loc, _ := time.LoadLocation("Asia/Jakarta")

	// PERUBAHAN (Kriteria 7): Menambahkan data "Arrow"
	attendances := []Attendance{
		{Username: "Budi", AccessID: "A001", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 5, 9, 15, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 5, 14, 30, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 6, 8, 5, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 6, 8, 7, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 6, 8, 10, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 6, 9, 0, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", Arrow: "out", CreatedAt: time.Date(2025, 10, 6, 17, 30, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 7, 8, 20, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 7, 9, 5, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", Arrow: "out", CreatedAt: time.Date(2025, 10, 7, 18, 0, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 8, 7, 55, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 8, 8, 1, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 8, 8, 2, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 8, 8, 15, 0, 0, loc)},
		{Username: "Fajar", AccessID: "A005", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 8, 10, 0, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", Arrow: "out", CreatedAt: time.Date(2025, 10, 8, 16, 45, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 9, 8, 30, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 9, 8, 32, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", Arrow: "in", CreatedAt: time.Date(2025, 10, 9, 9, 0, 0, 0, loc)},
		{Username: "Fajar", AccessID: "A005", Status: "success", Arrow: "out", CreatedAt: time.Date(2025, 10, 9, 17, 5, 0, 0, loc)},
	}

	if err := db.Create(&attendances).Error; err != nil {
		log.Fatalf("❌ Failed to seed attendance data: %v", err)
	}

	log.Println(" 	-> ✅ Attendance data seeded.")
}

// PERUBAHAN: Fungsi Enkripsi/Dekripsi AES ini sekarang HANYA untuk payload API (Kriteria 4)
// BUKAN untuk password.
func EncryptAES(plaintext string) (string, error) {
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func DecryptAES(ciphertext string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext terlalu pendek")
	}

	nonce, ciphertextBytes := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertextBytes, nil)
	if err != nil {
		return "", errors.New("gagal dekripsi")
	}

	return string(plaintext), nil
}

// --- (Fungsi Telegram & MQTT tetap sama) ---
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

// --- (JWT & Middleware tetap sama) ---
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

// --- (Fungsi Trend Analysis tetap sama) ---
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

func main() {
	db := initDB()
	initTelegramBot()
	initMQTT()

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"http://localhost:5173"},
		AllowMethods: []string{"GET", "POST", "DELETE", "PUT", "OPTIONS"},
		AllowHeaders: []string{"Authorization", "Content-Type"},
	}))

	api := r.Group("/api")

	// ====== LOGIN ======
	// PERUBAHAN (Kriteria 4): API Login dienkripsi
	api.POST("/login", func(c *gin.Context) {
		// 1. Definisikan struct untuk request/response plain & encrypted
		type LoginRequestPlain struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		type LoginRequestEncrypted struct {
			Payload string `json:"payload"`
		}
		type LoginResponsePlain struct {
			Token    string `json:"token"`
			Username string `json:"username"`
			Role     string `json:"role"`
		}

		var reqEncrypted LoginRequestEncrypted
		if err := c.BindJSON(&reqEncrypted); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad request (missing payload)"})
			return
		}

		// 2. Dekripsi payload
		decryptedPayload, err := DecryptAES(reqEncrypted.Payload)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "failed to decrypt payload"})
			return
		}

		// 3. Unmarshal payload
		var reqPlain LoginRequestPlain
		if err := json.Unmarshal([]byte(decryptedPayload), &reqPlain); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload structure"})
			return
		}

		// 4. Logika login (PERUBAHAN Kriteria 3: Menggunakan bcrypt)
		var u User
		if err := db.Where("username = ?", reqPlain.Username).First(&u).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		if !CheckPasswordHash(reqPlain.Password, u.Password) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		// 5. Buat token
		token, _ := makeToken(u.Username)

		// 6. Siapkan respons plain
		resPlain := LoginResponsePlain{
			Token:    token,
			Username: u.Username,
			Role:     u.Role,
		}

		// 7. Marshal respons
		resPlainJSON, err := json.Marshal(resPlain)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare response"})
			return
		}

		// 8. Enkripsi respons
		encryptedResponse, err := EncryptAES(string(resPlainJSON))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encrypt response"})
			return
		}

		// 9. Kirim respons terenkripsi
		c.JSON(http.StatusOK, gin.H{"payload": encryptedResponse})
	})

	// Protected routes
	api.Use(authMiddleware())

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

		// PERUBAHAN (Kriteria 3): Menggunakan bcrypt
		hashedPassword, err := HashPassword(req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
			return
		}

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

		// PERUBAHAN (Kriteria 3): Menggunakan bcrypt
		if req.Password != "" {
			hashedPassword, err := HashPassword(req.Password)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash new password"})
				return
			}
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

	// ====== DOORLOCK USERS ======
	doorlock := api.Group("/doorlock")
	doorlock.GET("/users", func(c *gin.Context) {
		var list []DoorlockUser
		if err := db.Find(&list).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch doorlock users"})
			return
		}
		// PERUBAHAN (Kriteria 5): PIN tidak dikirim dalam response
		c.JSON(http.StatusOK, list)
	})

	doorlock.POST("/users", func(c *gin.Context) {
		// PERUBAHAN (Kriteria 6): Menambahkan 'Pin'
		var req struct {
			Name     string `json:"name"`
			AccessID string `json:"access_id"`
			DoorID   string `json:"door_id"`
			Pin      string `json:"pin"`
		}
		if err := c.BindJSON(&req); err != nil || req.Name == "" || req.AccessID == "" || req.DoorID == "" || req.Pin == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1, "message": "name, access_id, door_id, and pin are required"})
			return
		}

		// PERUBAHAN (Kriteria 6): Hash PIN sebelum disimpan
		hashedPin, err := HashPassword(req.Pin)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": false, "error_code": 4, "message": "failed to hash pin"})
			return
		}

		u := DoorlockUser{
			Name:      req.Name,
			AccessID:  req.AccessID,
			DoorID:    req.DoorID,
			Pin:       hashedPin, // Simpan PIN yang sudah di-hash
			IsActive:  true,
			CreatedAt: time.Now(),
		}
		if err := db.Create(&u).Error; err != nil {
			c.JSON(http.StatusConflict, gin.H{"status": false, "error_code": 2, "message": "access_id already exists"})
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
	
	// ====== ATTENDANCE ======
	api.POST("/attendance", func(c *gin.Context) {
		// PERUBAHAN (Kriteria 7): Menambahkan 'Arrow'
		var req struct{ 
			AccessID string `json:"access_id"` 
			Arrow    string `json:"arrow"` // "in" or "out"
		}
		if err := c.BindJSON(&req); err != nil || req.AccessID == "" || req.Arrow == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1, "message": "access_id and arrow are required"})
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
			Arrow:     req.Arrow, // PERUBAHAN (Kriteria 7)
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

	// ====== ALARM ======
	// PERUBAHAN (Kriteria 8): Logika diubah
	api.POST("/alarm", func(c *gin.Context) {
		var req struct {
			AlarmType int    `json:"alarm_type"`
			AccessID  string `json:"access_id"` // Boleh kosong jika type 1
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1})
			return
		}

		var username string
		var reason string
		
		if req.AlarmType == 1 {
			// PERUBAHAN: Tidak perlu access_id valid
			reason = "3 kali gagal masuk"
			username = "Unknown" // Karena kita tidak tahu siapa yg gagal
			
			// Coba cari user jika access_id diberikan, tapi jangan error jika tidak ada
			var doorUser DoorlockUser
			if req.AccessID != "" && db.Where("access_id = ?", req.AccessID).First(&doorUser).Error == nil {
				username = doorUser.Name
			}

		} else if req.AlarmType == 2 {
			reason = "Pintu terbuka > 1 menit"
			
			// PERUBAHAN: Wajib access_id untuk alarm type 2
			if req.AccessID == "" {
				c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1, "message": "access_id is required for this alarm type"})
				return
			}
			var doorUser DoorlockUser
			if err := db.Where("access_id = ?", req.AccessID).First(&doorUser).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"status": false, "error_code": 2, "message": "access_id not found"})
				return
			}
			username = doorUser.Name

		} else {
			reason = "Unknown"
			username = "System"
		}


		al := Alarm{
			Username:  username,
			AccessID:  req.AccessID, // Tetap catat access_id yg (mungkin) gagal
			Reason:    reason,
			CreatedAt: time.Now(),
		}
		
		if err := db.Create(&al).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": false, "error_code": 3, "message": "failed to save alarm"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": true, "error_code": 0})

		// Kirim notifikasi Telegram
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

	// --- (Health, Root, Trends, MQTT Control, Dashboard Stats tetap sama) ---
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