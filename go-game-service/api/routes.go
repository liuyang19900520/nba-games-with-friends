package api

import (
	"go-game-service/internal/game/handlers"
	"go-game-service/internal/info/handlers"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		info := api.Group("/info")
		{
			info.GET("/", handlers.GetInfo)
		}

		game := api.Group("/game")
		{
			game.GET("/", handlers.GetGameData)
		}
	}
}
