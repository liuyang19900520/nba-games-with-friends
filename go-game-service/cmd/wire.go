//go:build wireinject

package main

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/wire"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/api"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/handlers"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/repository"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/service"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/pkg/dynamodb"
)

func InitializeApp(ctx context.Context) (*gin.Engine, error) {
	wire.Build(
		dynamodbclient.NewDynamoDBClient,        // 创建 DynamoDB 客户端
		repository.NewDynamoDBNBATeamRepository, // 创建 Repository
		service.NewNbaTeamService,               // 创建 Service
		handlers.NewNbaTeamHandler,              // 创建 Handler
		api.SetupRoutes,                         // 设置路由
		gin.Default,                             // 初始化 Gin
		wire.Value("NBA_Teams"),                 // 注入表名
	)
	return nil, nil
}
