package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5" // <-- TAMBAHAN
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var jwtSecret = []byte("super-secret-key")
var aesKey = []byte("kuncirahasia1234") // <-- Ini 16 byte

// --- TAMBAHAN UNTUK TELEGRAM ---
var (
	telegramBotToken = "7273408012:AAEAcr-u0AjF8gaT2sPLxYLOPdcNV3jUKxI"
	telegramChatID int64 = 7805994005 

	botAPI *tgbotapi.BotAPI
)

// ====== MODELS ======
type User struct {
// ... (Model Anda tidak berubah) ...
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username" gorm:"uniqueIndex"`
	Password  string    `json:"-"` 
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type Attendance struct {
// ... (Model Anda tidak berubah) ...
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username"`
	AccessID  string    `json:"access_id"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type Alarm struct {
// ... (Model Anda tidak berubah) ...
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username"`
	AccessID  string    `json:"access_id"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

type DoorlockUser struct {
// ... (Model Anda tidak berubah) ...
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name"`
	AccessID  string    `json:"access_id" gorm:"uniqueIndex"`
	DoorID    string    `json:"door_id"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// ====== DB INITIALIZATION & SEEDING ======
// ... (Fungsi initDB tidak berubah) ...
func initDB() *gorm.DB {
	db, err := gorm.Open(sqlite.Open("data.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	if err := db.AutoMigrate(&User{}, &Attendance{}, &Alarm{}, &DoorlockUser{}); err != nil {
		log.Fatal(err)
	}

	// Seeding data jika database kosong
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

// ... (Fungsi seedUsers tidak berubah) ...
func seedUsers(db *gorm.DB) {
	adminPass, err := EncryptAES("admin123")
	if err != nil { log.Fatalf("Gagal enkripsi seed pass admin: %v", err) }
	
	userPass, err := EncryptAES("password123")
	if err != nil { log.Fatalf("Gagal enkripsi seed pass user: %v", err) }


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

// ... (Fungsi seedDoorlockUsers tidak berubah) ...
func seedDoorlockUsers(db *gorm.DB) {
	doorUsers := []DoorlockUser{
		{Name: "Budi", AccessID: "A001", DoorID: "D01", IsActive: true, CreatedAt: time.Now()},
		{Name: "Citra", AccessID: "A002", DoorID: "D01", IsActive: true, CreatedAt: time.Now()},
		{Name: "Dewi", AccessID: "A003", DoorID: "D02", IsActive: true, CreatedAt: time.Now()},
		{Name: "Eka", AccessID: "A004", DoorID: "D02", IsActive: true, CreatedAt: time.Now()},
		{Name: "Fajar", AccessID: "A005", DoorID: "D01", IsActive: false, CreatedAt: time.Now()},
	}
	if err := db.Create(&doorUsers).Error; err != nil {
		log.Fatalf("❌ Failed to seed doorlock users: %v", err)
	}
	log.Println(" 	-> ✅ Doorlock Users seeded.")
}

// ... (Fungsi seedAttendanceData tidak berubah) ...
func seedAttendanceData(db *gorm.DB) {
	loc, _ := time.LoadLocation("Asia/Jakarta")

	attendances := []Attendance{
		{Username: "Budi", AccessID: "A001", Status: "success", CreatedAt: time.Date(2025, 10, 5, 9, 15, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", CreatedAt: time.Date(2025, 10, 5, 14, 30, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", CreatedAt: time.Date(2025, 10, 6, 8, 5, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", CreatedAt: time.Date(2025, 10, 6, 8, 7, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", CreatedAt: time.Date(2025, 10, 6, 8, 10, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", CreatedAt: time.Date(2025, 10, 6, 9, 0, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", CreatedAt: time.Date(2025, 10, 6, 17, 30, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", CreatedAt: time.Date(2025, 10, 7, 8, 20, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", CreatedAt: time.Date(2025, 10, 7, 9, 5, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", CreatedAt: time.Date(2025, 10, 7, 18, 0, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", CreatedAt: time.Date(2025, 10, 8, 7, 55, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", CreatedAt: time.Date(2025, 10, 8, 8, 1, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", CreatedAt: time.Date(2025, 10, 8, 8, 2, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", CreatedAt: time.Date(2025, 10, 8, 8, 15, 0, 0, loc)},
		{Username: "Fajar", AccessID: "A005", Status: "success", CreatedAt: time.Date(2025, 10, 8, 10, 0, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", CreatedAt: time.Date(2025, 10, 8, 16, 45, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", CreatedAt: time.Date(2025, 10, 9, 8, 30, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", CreatedAt: time.Date(2025, 10, 9, 8, 32, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", CreatedAt: time.Date(2025, 10, 9, 9, 0, 0, 0, loc)},
		{Username: "Fajar", AccessID: "A005", Status: "success", CreatedAt: time.Date(2025, 10, 9, 17, 5, 0, 0, loc)},
	}

	if err := db.Create(&attendances).Error; err != nil {
		log.Fatalf("❌ Failed to seed attendance data: %v", err)
	}

	log.Println(" 	-> ✅ Attendance data seeded.")
}


// ... (Fungsi EncryptAES dan DecryptAES tidak berubah) ...
// EncryptAES mengenkripsi teks menggunakan AES-GCM
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

// DecryptAES mendekripsi teks dari AES-GCM
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

// --- FUNGSI HELPER TELEGRAM --- // <-- TAMBAHAN
// Fungsi untuk menginisialisasi bot saat server pertama kali jalan
func initTelegramBot() {
	var err error
	botAPI, err = tgbotapi.NewBotAPI(telegramBotToken)
	
	if err != nil {
		// Jangan pakai log.Fatal, agar server tetap jalan meski bot gagal konek
		log.Printf("PERINGATAN: Gagal menginisialisasi Telegram Bot: %v. Notifikasi nonaktif.", err)
		botAPI = nil // Set jadi nil agar fungsi send tahu
	} else {
		log.Println("✅ Telegram Bot terhubung:", botAPI.Self.UserName)
	}
}

// Fungsi untuk mengirim pesan
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
// --- SELESAI FUNGSI HELPER ---


// ====== JWT & AUTH MIDDLEWARE ======
// ... (Fungsi JWT & middleware tidak berubah) ...
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

// ... (Fungsi stringToUint tidak berubah) ...
func stringToUint(s string) uint {
	var i uint
	fmt.Sscanf(s, "%d", &i)
	return i
}


func main() {
	db := initDB()
	initTelegramBot() // <-- TAMBAHAN: Inisialisasi bot saat start

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"http://localhost:5173"},
		AllowMethods: []string{"GET", "POST", "DELETE", "PUT", "OPTIONS"},
		AllowHeaders: []string{"Authorization", "Content-Type"},
	}))

	api := r.Group("/api")

	// ====== LOGIN ======
	// ... (Handler Login tidak berubah) ...
	api.POST("/login", func(c *gin.Context) {
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

		decryptedPassword, err := DecryptAES(u.Password)
		if err != nil {
			log.Printf("ERROR: Gagal dekripsi password user %s: %v", req.Username, err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		if decryptedPassword != req.Password {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		token, _ := makeToken(u.Username)
		c.JSON(http.StatusOK, gin.H{"token": token, "username": u.Username, "role": u.Role})
	})

	// Protected routes
	api.Use(authMiddleware())

	// ====== USER MANAGEMENT ======
	// ... (Semua handler /users tidak berubah) ...
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

		encryptedPassword, err := EncryptAES(req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encrypt password"})
			return
		}

		user := User{
			Username:  req.Username,
			Password:  encryptedPassword,
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
			encryptedPassword, err := EncryptAES(req.Password)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encrypt new password"})
				return
			}
			user.Password = encryptedPassword
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
	// ... (Handler /doorlock tidak berubah) ...
	doorlock := api.Group("/doorlock")
	doorlock.GET("/users", func(c *gin.Context) {
		var list []DoorlockUser
		db.Find(&list)
		c.JSON(http.StatusOK, list)
	})
	doorlock.POST("/users", func(c *gin.Context) {
		var req struct {
			Name     string `json:"name"`
			AccessID string `json:"access_id"`
			DoorID   string `json:"door_id"`
		}
		if err := c.BindJSON(&req); err != nil || req.Name == "" || req.AccessID == "" || req.DoorID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1})
			return
		}

		u := DoorlockUser{
			Name:      req.Name,
			AccessID:  req.AccessID,
			DoorID:    req.DoorID,
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


	// ====== ATTENDANCE ======
	// ... (Handler /attendance tidak berubah) ...
	api.POST("/attendance", func(c *gin.Context) {
		var req struct{ AccessID string `json:"access_id"` }
		if err := c.BindJSON(&req); err != nil || req.AccessID == "" {
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
			CreatedAt: time.Now(),
		}
		db.Create(&rec)
		c.JSON(http.StatusOK, gin.H{"status": true, "error_code": 0})
	})
	api.GET("/attendance", func(c *gin.Context) {
		var list []Attendance
		db.Order("created_at desc").Find(&list)
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
	// --- HANDLER ALARM DIMODIFIKASI ---
	api.POST("/alarm", func(c *gin.Context) {
		var req struct {
			AlarmType int    `json:"alarm_type"`
			AccessID  string `json:"access_id"`
		}
		if err := c.BindJSON(&req); err != nil || req.AccessID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1})
			return
		}

		var doorUser DoorlockUser
		if err := db.Where("access_id = ?", req.AccessID).First(&doorUser).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"status": false, "error_code": 2, "message": "access_id not found"})
			return
		}

		reason := "Unknown"
		if req.AlarmType == 1 {
			reason = "3 kali gagal masuk"
		} else if req.AlarmType == 2 {
			reason = "Pintu terbuka > 1 menit"
		}

		al := Alarm{
			Username:  doorUser.Name,
			AccessID:  req.AccessID,
			Reason:    reason,
			CreatedAt: time.Now(),
		}
		
		// 1. Simpan alarm ke database
		if err := db.Create(&al).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": false, "error_code": 3, "message": "failed to save alarm"})
			return
		}

		// 2. Langsung kirim balasan sukses ke frontend (React/Thunder Client)
		c.JSON(http.StatusOK, gin.H{"status": true, "error_code": 0})

		// 3. Kirim notifikasi secara ASINKRON (menggunakan goroutine)
		go func() {
			// Atur zona waktu ke WIB (Asia/Jakarta)
			loc, _ := time.LoadLocation("Asia/Jakarta")
			wibTime := al.CreatedAt.In(loc)

			// Buat pesan notifikasi
			message := fmt.Sprintf(
				"🚨 ALARM TERDETEKSI 🚨\n\nNama: %s\nAccess ID: %s\nAlasan: %s\nWaktu: %s WIB",
				al.Username,
				al.AccessID,
				al.Reason,
				wibTime.Format("2 Jan 2006, 15:04:05"), // Format waktu yang mudah dibaca
			)

			// Panggil fungsi pengirim notifikasi
			if err := sendTelegramNotification(message); err != nil {
				// Jika gagal, cukup log di sisi server.
				log.Printf("Gagal mengirim notifikasi Telegram: %v", err)
			}
		}()
	})

	api.GET("/alarms", func(c *gin.Context) {
		var list []Alarm
		db.Order("created_at desc").Find(&list)
		c.JSON(http.StatusOK, list)
	})

	log.Println("🚀 Backend listening on :8090")
	if err := r.Run(":8090"); err != nil {
		log.Fatal(err)
	}
}