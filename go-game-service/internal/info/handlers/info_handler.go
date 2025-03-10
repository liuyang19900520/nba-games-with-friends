package handlers

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/repository"
)

// GetInfo 获取基本信息
func GetInfo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Information retrieved successfully",
	})
}

// GetNBATeamsHandler 获取 NBA 球队数据
func GetNBATeamsHandler(repo repository.NBATeamRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := context.Background()
		teams, err := repo.ScanAll(ctx)
		if err != nil {
			log.Printf("扫描 NBA_Teams 表失败: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve NBA teams"})
			return
		}

		// 可以进行其他业务逻辑处理，例如过滤、排序等
		c.JSON(http.StatusOK, teams)
	}
}
