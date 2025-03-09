package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetGameData(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message": "Game data retrieved successfully",
	})
}
