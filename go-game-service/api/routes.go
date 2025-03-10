package api

import (
	"github.com/gin-gonic/gin"
	gameHandlers "github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/game/handlers"
	infoHandlers "github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/handlers"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/repository"
)

// SetupRoutes 设置路由
func SetupRoutes(r *gin.Engine, nbaTeamRepo repository.NBATeamRepository) {
	api := r.Group("/api")
	{
		info := api.Group("/info")
		{
			// 使用 GetNBATeamsHandler 函数创建 handler
			info.GET("/", infoHandlers.GetNBATeamsHandler(nbaTeamRepo))
		}

		game := api.Group("/game")
		{
			game.GET("/", gameHandlers.GetGameData)
		}
	}
}
