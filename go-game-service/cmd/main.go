package main

import (
	"fmt"
	"go-game-service/api"
	"go-game-service/pkg/db"
	"go-game-service/pkg/logger"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	// 初始化日志
	logger.InitLogger()

	// 连接数据库
	db.InitPostgres()
	db.InitDynamoDB()

	// 初始化 Gin
	r := gin.Default()
	api.SetupRoutes(r)

	// 启动服务器
	fmt.Println("Server is running on port 8080...")
	log.Fatal(r.Run(":8080"))
}
