package service

import (
	"context"

	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/model"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/repository"
)

// NbaTeamService 定义了服务层接口
type NbaTeamService interface {
	ListTeams(ctx context.Context) ([]model.NBATeam, error)
}

// nbaTeamService 服务层实现
type nbaTeamService struct {
	repo repository.NBATeamRepository
}

// NewNbaTeamService 构造函数
func NewNbaTeamService(repo repository.NBATeamRepository) NbaTeamService {
	return &nbaTeamService{repo: repo}
}

// ListTeams 返回所有 NBA 球队数据
func (s *nbaTeamService) ListTeams(ctx context.Context) ([]model.NBATeam, error) {
	return s.repo.ScanAll(ctx)
}
