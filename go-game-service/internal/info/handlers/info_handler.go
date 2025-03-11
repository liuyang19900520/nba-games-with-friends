package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/service"
)

// NbaTeamHandler 用于处理 NBA_Teams 相关的 HTTP 请求
type NbaTeamHandler struct {
	svc service.NbaTeamService
}

// NewNbaTeamHandler 构造函数
func NewNbaTeamHandler(svc service.NbaTeamService) *NbaTeamHandler {
	return &NbaTeamHandler{svc: svc}
}

// GetNBATeams 处理获取 NBA 球队的请求
func (h *NbaTeamHandler) GetNBATeams(c *gin.Context) {
	ctx := c.Request.Context()
	teams, err := h.svc.ListTeams(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve NBA teams"})
		return
	}

	c.JSON(http.StatusOK, teams)
}
