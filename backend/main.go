package main

import (
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var jwtSecret = []byte("super-secret-key")

// ====== MODELS ======
type User struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username" gorm:"uniqueIndex"`
	Password  string    `json:"-"` // plain text untuk testing
	Role      string    `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type Attendance struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type Alarm struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

// ====== DB ======
func initDB() *gorm.DB {
	db, err := gorm.Open(sqlite.Open("data.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	if err := db.AutoMigrate(&User{}, &Attendance{}, &Alarm{}); err != nil {
		log.Fatal(err)
	}

	// seed admin jika kosong
	var count int64
	db.Model(&User{}).Count(&count)
	if count == 0 {
		db.Create(&User{
			Username:  "admin",
			Password:  "admin123", // plain text
			Role:      "admin",
			IsActive:  true,
			CreatedAt: time.Now(),
		})
		log.Println("✅ Default admin created (username: admin, password: admin123)")
	}
	return db
}

// ====== JWT ======
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
			c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
			return
		}
		// cek password plain text
		if u.Password != req.Password {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "wrong password"})
			return
		}
		token, _ := makeToken(u.Username)
		c.JSON(http.StatusOK, gin.H{"token": token, "username": u.Username, "role": u.Role})
	})

	// ====== PROTECTED ROUTES ======
	api.Use(authMiddleware())

	// Get All Users
	api.GET("/users", func(c *gin.Context) {
		var users []User
		db.Find(&users)
		names := []string{}
		for _, u := range users {
			names = append(names, u.Username)
		}
		c.JSON(http.StatusOK, gin.H{"users": names})
	})

	// Create User
	api.POST("/users", func(c *gin.Context) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := c.BindJSON(&req); err != nil || req.Username == "" || req.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1})
			return
		}
		u := User{
			Username:  req.Username,
			Password:  req.Password, // plain text
			Role:      "user",
			IsActive:  true,
			CreatedAt: time.Now(),
		}
		if err := db.Create(&u).Error; err != nil {
			c.JSON(http.StatusConflict, gin.H{"status": false, "error_code": 2})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": true, "error_code": 0})
	})

	// Delete User
	api.POST("/users/delete", func(c *gin.Context) {
		var req struct{ Username string `json:"username"` }
		if err := c.BindJSON(&req); err != nil || req.Username == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1})
			return
		}
		res := db.Where("username = ?", req.Username).Delete(&User{})
		if res.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"status": false, "error_code": 3})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": true, "error_code": 0})
	})

	// Attendance
	api.POST("/attendance", func(c *gin.Context) {
		var req struct{ Username string `json:"username"` }
		if err := c.BindJSON(&req); err != nil || req.Username == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1})
			return
		}
		rec := Attendance{Username: req.Username, Status: "success", CreatedAt: time.Now()}
		db.Create(&rec)
		c.JSON(http.StatusOK, gin.H{"status": true, "error_code": 0})
	})

	api.GET("/attendance", func(c *gin.Context) {
		var list []Attendance
		db.Order("created_at desc").Find(&list)
		c.JSON(http.StatusOK, list)
	})

	// Alarm
	api.POST("/alarm", func(c *gin.Context) {
		var req struct {
			AlarmType int    `json:"alarm_type"`
			Username  string `json:"username"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": false, "error_code": 1})
			return
		}
		reason := "Unknown"
		if req.AlarmType == 1 {
			reason = "3 kali gagal masuk"
		} else if req.AlarmType == 2 {
			reason = "Pintu terbuka > 1 menit"
		}
		al := Alarm{Username: req.Username, Reason: reason, CreatedAt: time.Now()}
		db.Create(&al)
		c.JSON(http.StatusOK, gin.H{"status": true, "error_code": 0})
	})

	api.GET("/alarms", func(c *gin.Context) {
		var list []Alarm
		db.Order("created_at desc").Find(&list)
		c.JSON(http.StatusOK, list)
	})

	log.Println("Backend listening on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
