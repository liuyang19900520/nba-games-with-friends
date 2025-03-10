package main

import (
	"context"
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/api"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/config"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/repository"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/pkg/dynamodb"
)

func main() {
	// 创建一个 context
	ctx := context.Background()

	// 加载 AWS 配置
	awsCfg, err := config.LoadAWSConfig(ctx)
	if err != nil {
		log.Fatalf("加载 AWS 配置失败: %v", err)
	}

	// 创建 DynamoDB 客户端
	dbClient, err := dynamodb.NewClient(ctx, awsCfg)
	if err != nil {
		log.Fatalf("创建 DynamoDB 客户端失败: %v", err)
	}

	// 创建 NBATeamRepository 实例
	nbaTeamRepo := repository.NewDynamoDBNBATeamRepository(dbClient.Client, "NBA_Teams")

	// 初始化 Gin
	r := gin.Default()

	// 设置路由，并将 nbaTeamRepo 传递给 SetupRoutes
	api.SetupRoutes(r, nbaTeamRepo) // 传递 nbaTeamRepo

	// 启动服务器
	fmt.Println("Server is running on port 8080...")
	log.Fatal(r.Run(":8080"))
}
