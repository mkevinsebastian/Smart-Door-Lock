package main

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt" // <-- TAMBAHAN
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var jwtSecret = []byte("super-secret-key")

// ====== MODELS ======
type User struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username" gorm:"uniqueIndex"`
	Password  string    `json:"-"`
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type Attendance struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username"`
	AccessID  string    `json:"access_id"`
	Status    string    `json:"status"`
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
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// ====== DB INITIALIZATION & SEEDING ======
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

// seedUsers creates default admin and other users
func seedUsers(db *gorm.DB) {
	// <-- PERUBAHAN: Hash passwords untuk seeding
	adminPass, _ := hashPassword("admin123")
	userPass, _ := hashPassword("password123")

	users := []User{
		{Username: "admin", Password: adminPass, Role: "admin", IsActive: true, CreatedAt: time.Now()},
		{Username: "budi", Password: userPass, Role: "user", IsActive: true, CreatedAt: time.Now()},
		{Username: "citra", Password: userPass, Role: "user", IsActive: false, CreatedAt: time.Now()},
	}

	if err := db.Create(&users).Error; err != nil {
		log.Fatalf("❌ Failed to seed users: %v", err)
	}
	log.Println("   -> ✅ Users seeded.")
}

// seedDoorlockUsers creates dummy doorlock users synchronized with attendance data
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
	log.Println("   -> ✅ Doorlock Users seeded.")
}

// seedAttendanceData creates dummy attendance records for demonstration
func seedAttendanceData(db *gorm.DB) {
	loc, _ := time.LoadLocation("Asia/Jakarta")

	attendances := []Attendance{
		// ---- Tanggal 5 Oktober ----
		{Username: "Budi", AccessID: "A001", Status: "success", CreatedAt: time.Date(2025, 10, 5, 9, 15, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", CreatedAt: time.Date(2025, 10, 5, 14, 30, 0, 0, loc)},
		// ---- Tanggal 6 Oktober ----
		{Username: "Budi", AccessID: "A001", Status: "success", CreatedAt: time.Date(2025, 10, 6, 8, 5, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", CreatedAt: time.Date(2025, 10, 6, 8, 7, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", CreatedAt: time.Date(2025, 10, 6, 8, 10, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", CreatedAt: time.Date(2025, 10, 6, 9, 0, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", CreatedAt: time.Date(2025, 10, 6, 17, 30, 0, 0, loc)},
		// ---- Tanggal 7 Oktober ----
		{Username: "Citra", AccessID: "A002", Status: "success", CreatedAt: time.Date(2025, 10, 7, 8, 20, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", CreatedAt: time.Date(2025, 10, 7, 9, 5, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", CreatedAt: time.Date(2025, 10, 7, 18, 0, 0, 0, loc)},
		// ---- Tanggal 8 Oktober ----
		{Username: "Budi", AccessID: "A001", Status: "success", CreatedAt: time.Date(2025, 10, 8, 7, 55, 0, 0, loc)},
		{Username: "Citra", AccessID: "A002", Status: "success", CreatedAt: time.Date(2025, 10, 8, 8, 1, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", CreatedAt: time.Date(2025, 10, 8, 8, 2, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", CreatedAt: time.Date(2025, 10, 8, 8, 15, 0, 0, loc)},
		{Username: "Fajar", AccessID: "A005", Status: "success", CreatedAt: time.Date(2025, 10, 8, 10, 0, 0, 0, loc)},
		{Username: "Budi", AccessID: "A001", Status: "success", CreatedAt: time.Date(2025, 10, 8, 16, 45, 0, 0, loc)},
		// ---- Tanggal 9 Oktober ----
		{Username: "Citra", AccessID: "A002", Status: "success", CreatedAt: time.Date(2025, 10, 9, 8, 30, 0, 0, loc)},
		{Username: "Dewi", AccessID: "A003", Status: "success", CreatedAt: time.Date(2025, 10, 9, 8, 32, 0, 0, loc)},
		{Username: "Eka", AccessID: "A004", Status: "success", CreatedAt: time.Date(2025, 10, 9, 9, 0, 0, 0, loc)},
		{Username: "Fajar", AccessID: "A005", Status: "success", CreatedAt: time.Date(2025, 10, 9, 17, 5, 0, 0, loc)},
	}

	if err := db.Create(&attendances).Error; err != nil {
		log.Fatalf("❌ Failed to seed attendance data: %v", err)
	}

	log.Println("   -> ✅ Attendance data seeded.")
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

// ====== BCRYPT HELPER FUNCTIONS ====== // <-- TAMBAHAN
func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func checkPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// Helper function to convert string to uint
func stringToUint(s string) uint {
	var i uint
	fmt.Sscanf(s, "%d", &i)
	return i
}

func main() {
	db := initDB()
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"http://localhost:5173"},
		AllowMethods: []string{"GET", "POST", "DELETE", "PUT", "OPTIONS"},
		AllowHeaders: []string{"Authorization", "Content-Type"},
	}))

	api := r.Group("/api")

	// ====== LOGIN ======
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
			// <-- PERUBAHAN: Pesan error yang lebih umum untuk keamanan
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		// <-- PERUBAHAN: Gunakan checkPasswordHash
		if !checkPasswordHash(req.Password, u.Password) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
			return
		}

		token, _ := makeToken(u.Username)
		c.JSON(http.StatusOK, gin.H{"token": token, "username": u.Username, "role": u.Role})
	})

	// Protected routes
	api.Use(authMiddleware())

	// ====== USER MANAGEMENT ======
	userGroup := api.Group("/users")

	// Get all users
	userGroup.GET("/", func(c *gin.Context) {
		var users []User
		if err := db.Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch users"})
			return
		}

		// Remove passwords from response for security
		for i := range users {
			users[i].Password = ""
		}
		c.JSON(http.StatusOK, gin.H{"users": users})
	})

	// Create new user
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

		// <-- PERUBAHAN: Hash password sebelum disimpan
		hashedPassword, err := hashPassword(req.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
			return
		}

		user := User{
			Username:  req.Username,
			Password:  hashedPassword, // <-- PERUBAHAN
			Role:      req.Role,
			IsActive:  true,
			CreatedAt: time.Now(),
		}

		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
			return
		}

		// Don't return password
		user.Password = ""
		c.JSON(http.StatusCreated, user)
	})

	// Update user
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

		// Update fields
		user.Username = req.Username
		user.Role = req.Role
		user.IsActive = req.IsActive

		// <-- PERUBAHAN: Hanya update password jika diberikan, dan HASH password baru
		if req.Password != "" {
			hashedPassword, err := hashPassword(req.Password)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
				return
			}
			user.Password = hashedPassword
		}

		if err := db.Save(&user).Error; err != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
			return
		}

		// Don't return password
		user.Password = ""
		c.JSON(http.StatusOK, user)
	})

	// Delete user
	userGroup.DELETE("/:id", func(c *gin.Context) {
		id := c.Param("id")

		// Prevent deleting yourself
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

	// DELETE by access_id
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

	// GET semua attendance
	api.GET("/attendance", func(c *gin.Context) {
		var list []Attendance
		db.Order("created_at desc").Find(&list)
		c.JSON(http.StatusOK, list)
	})

	// ====== ATTENDANCE SUMMARY ======
	api.GET("/attendance/summary", func(c *gin.Context) {
		var summary []struct {
			Date  string `json:"date"`
			Count int    `json:"count"`
		}

		// Get last 7 days attendance count
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
		db.Create(&al)
		c.JSON(http.StatusOK, gin.H{"status": true, "error_code": 0})
	})

	api.GET("/alarms", func(c *gin.Context) {
		var list []Alarm
		db.Order("created_at desc").Find(&list)
		c.JSON(http.StatusOK, list)
	})

	log.Println("🚀 Backend listening on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}