package api

import (
	"github.com/gin-gonic/gin"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/handlers"
)

// SetupRoutes 设置路由，但不返回 *gin.Engine
func SetupRoutes(r *gin.Engine, nbaHandler *handlers.NbaTeamHandler) {
	api := r.Group("/api")
	{
		info := api.Group("/nba")
		{
			info.GET("/teams", nbaHandler.GetNBATeams)
		}
	}
}
