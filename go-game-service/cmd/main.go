package main

import (
	"context"
	"log"

	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/api"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/config"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/handlers"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/repository"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/service"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/pkg/dynamodb"

	"github.com/gin-gonic/gin"
)

func main() {
	ctx := context.Background()

	// 1. 初始化 AWS 配置
	awsConfig, err := config.LoadAWSConfig(ctx)
	if err != nil {
		log.Fatalf("加载 AWS 配置失败: %v", err)
	}

	dynamoClient := dynamodb.NewClient(ctx, awsConfig)

	// 3. 初始化仓库
	tableNBATeams := "NBA_Teams" // 表名常量
	// 假设您的 pkg/dynamodb.Client 有一个方法或字段可以访问原始的 AWS SDK Client
	nbaTeamRepo := repository.NewDynamoDBNBATeamRepository(dynamoClient.GetAWSClient(), tableNBATeams)

	// 4. 初始化服务
	nbaTeamService := service.NewNbaTeamService(nbaTeamRepo)

	// 5. 初始化处理程序
	nbaTeamHandler := handlers.NewNbaTeamHandler(nbaTeamService)

	// 6. 初始化 Gin 引擎
	engine := gin.Default()

	// 7. 配置路由
	api.SetupRoutes(engine, nbaTeamHandler)

	// 8. 启动服务器
	log.Fatal(engine.Run(":8080"))
}
