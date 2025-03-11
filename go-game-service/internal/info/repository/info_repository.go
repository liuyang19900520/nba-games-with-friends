package repository

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/internal/info/model"
)

// NBATeamRepository 接口
type NBATeamRepository interface {
	ScanAll(ctx context.Context) ([]model.NBATeam, error)
}

// DynamoDBNBATeamRepository 实现 NBATeamRepository 接口
type DynamoDBNBATeamRepository struct {
	Client    *dynamodb.Client
	TableName string
}

// NewDynamoDBNBATeamRepository 创建 DynamoDBNBATeamRepository 实例
func NewDynamoDBNBATeamRepository(client *dynamodb.Client, tableName string) *DynamoDBNBATeamRepository {
	return &DynamoDBNBATeamRepository{
		Client:    client,
		TableName: tableName,
	}
}

// ScanAll 扫描 NBA_Teams 表
func (r *DynamoDBNBATeamRepository) ScanAll(ctx context.Context) ([]model.NBATeam, error) {
	input := &dynamodb.ScanInput{
		TableName: &r.TableName,
	}

	// 发送 Scan 请求
	result, err := r.Client.Scan(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("failed to scan table %s: %v", r.TableName, err)
	}

	// 反序列化结果
	var teams []model.NBATeam
	err = attributevalue.UnmarshalListOfMaps(result.Items, &teams)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal items: %v", err)
	}

	return teams, nil
}
