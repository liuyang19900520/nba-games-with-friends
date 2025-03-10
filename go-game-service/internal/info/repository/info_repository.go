package repository

import (
	"context"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info"
)

// NBATeamRepository 接口
type NBATeamRepository interface {
	ScanAll(ctx context.Context) ([]info.NBATeam, error)
}

// DynamoDBNBATeamRepository 结构体
type DynamoDBNBATeamRepository struct {
	Client    *dynamodb.Client
	TableName string
}

// NewDynamoDBNBATeamRepository 创建 DynamoDBNBATeamRepository 实例
func NewDynamoDBNBATeamRepository(client *dynamodb.Client, tableName string) NBATeamRepository {
	return &DynamoDBNBATeamRepository{
		Client:    client,
		TableName: tableName,
	}
}

// ScanAll 扫描 NBA_Teams 表
func (r *DynamoDBNBATeamRepository) ScanAll(ctx context.Context) ([]info.NBATeam, error) {
	// 实现扫描表的逻辑
	// ...
	return nil, nil
}
