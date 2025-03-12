package dynamodb

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/liuyang19900520/nba-games-with-friends/go-game-service/config"
)

// Client DynamoDB 客户端结构体
type Client struct {
	client *dynamodb.Client
}

type ClientWrapper struct {
	Client *dynamodb.Client
}

// NewClient 创建一个新的 DynamoDB 客户端，接收 AWSConfig 作为参数
func NewClient(ctx context.Context, awsCfg *config.AWSConfig) *Client {
	cfg, err := config.NewAWSSessionWithConfig(ctx, awsCfg)
	if err != nil {
		return nil
	}

	return &Client{client: dynamodb.NewFromConfig(cfg)}
}

// ListTables 列出所有 DynamoDB 表
func (c *Client) ListTables(ctx context.Context) ([]string, error) {
	resp, err := c.client.ListTables(ctx, &dynamodb.ListTablesInput{})
	if err != nil {
		return nil, fmt.Errorf("列出 DynamoDB 表失败: %w", err)
	}
	return resp.TableNames, nil
}

// ScanTable 扫描整个表并返回所有项目
func (c *Client) ScanTable(ctx context.Context, tableName string) ([]map[string]interface{}, error) {
	input := &dynamodb.ScanInput{
		TableName: aws.String(tableName),
	}

	result, err := c.client.Scan(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("扫描表 %s 失败: %w", tableName, err)
	}

	var items []map[string]interface{}
	for _, item := range result.Items {
		var data map[string]interface{}
		err = attributevalue.UnmarshalMap(item, &data)
		if err != nil {
			return nil, fmt.Errorf("解析表项失败: %w", err)
		}
		items = append(items, data)
	}

	return items, nil
}

// GetItem 根据主键获取项目
func (c *Client) GetItem(ctx context.Context, tableName string, key map[string]types.AttributeValue) (map[string]interface{}, error) {
	input := &dynamodb.GetItemInput{
		TableName: aws.String(tableName),
		Key:       key,
	}

	result, err := c.client.GetItem(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("获取项目失败: %w", err)
	}

	if result.Item == nil {
		return nil, nil // 未找到项目
	}

	var item map[string]interface{}
	err = attributevalue.UnmarshalMap(result.Item, &item)
	if err != nil {
		return nil, fmt.Errorf("解析项目失败: %w", err)
	}

	return item, nil
}

// PutItem 添加或更新项目
func (c *Client) PutItem(ctx context.Context, tableName string, item interface{}) error {
	av, err := attributevalue.MarshalMap(item)
	if err != nil {
		return fmt.Errorf("序列化项目失败: %w", err)
	}

	input := &dynamodb.PutItemInput{
		TableName: aws.String(tableName),
		Item:      av,
	}

	_, err = c.client.PutItem(ctx, input)
	if err != nil {
		return fmt.Errorf("添加项目失败: %w", err)
	}

	return nil
}

// UpdateItem 更新项目的特定属性
func (c *Client) UpdateItem(ctx context.Context, tableName string, key map[string]types.AttributeValue,
	updateExpression string, expressionAttributeNames map[string]string,
	expressionAttributeValues map[string]types.AttributeValue) error {
	input := &dynamodb.UpdateItemInput{
		TableName:                 aws.String(tableName),
		Key:                       key,
		UpdateExpression:          aws.String(updateExpression),
		ExpressionAttributeNames:  expressionAttributeNames,
		ExpressionAttributeValues: expressionAttributeValues,
	}

	_, err := c.client.UpdateItem(ctx, input)
	if err != nil {
		return fmt.Errorf("更新项目失败: %w", err)
	}

	return nil
}

// DeleteItem 删除项目
func (c *Client) DeleteItem(ctx context.Context, tableName string, key map[string]types.AttributeValue) error {
	input := &dynamodb.DeleteItemInput{
		TableName: aws.String(tableName),
		Key:       key,
	}

	_, err := c.client.DeleteItem(ctx, input)
	if err != nil {
		return fmt.Errorf("删除项目失败: %w", err)
	}

	return nil
}

// QueryItems 根据查询条件查询项目
func (c *Client) QueryItems(ctx context.Context, tableName string,
	keyConditionExpression string,
	expressionAttributeNames map[string]string,
	expressionAttributeValues map[string]types.AttributeValue) ([]map[string]interface{}, error) {
	input := &dynamodb.QueryInput{
		TableName:                 aws.String(tableName),
		KeyConditionExpression:    aws.String(keyConditionExpression),
		ExpressionAttributeNames:  expressionAttributeNames,
		ExpressionAttributeValues: expressionAttributeValues,
	}

	result, err := c.client.Query(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("查询失败: %w", err)
	}

	var items []map[string]interface{}
	for _, item := range result.Items {
		var data map[string]interface{}
		err = attributevalue.UnmarshalMap(item, &data)
		if err != nil {
			return nil, fmt.Errorf("解析查询结果失败: %w", err)
		}
		items = append(items, data)
	}

	return items, nil
}

// CreateTable 创建表
func (c *Client) CreateTable(ctx context.Context, input *dynamodb.CreateTableInput) error {
	_, err := c.client.CreateTable(ctx, input)
	if err != nil {
		return fmt.Errorf("创建表失败: %w", err)
	}
	return nil
}

// DeleteTable 删除表
func (c *Client) DeleteTable(ctx context.Context, tableName string) error {
	input := &dynamodb.DeleteTableInput{
		TableName: aws.String(tableName),
	}

	_, err := c.client.DeleteTable(ctx, input)
	if err != nil {
		return fmt.Errorf("删除表失败: %w", err)
	}
	return nil
}

// 在 pkg/dynamodb/dynamodb.go 中添加
func (c *Client) GetAWSClient() *dynamodb.Client {
	return c.client
}
