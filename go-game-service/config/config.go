package config

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/joho/godotenv"
)

// AWSConfig AWS 配置结构体
type AWSConfig struct {
	Region string
	// 其他需要的 AWS 配置字段，例如 Endpoint 等
}

func LoadAWSConfig(ctx context.Context) (*AWSConfig, error) {
	// 加载 .env 文件
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file") // 注意：这里使用 log.Println，以便在 .env 文件不存在时不会 panic
	}

	cfg := &AWSConfig{
		Region: os.Getenv("AWS_REGION"), // 从环境变量读取 Region
		// 加载其他配置...
	}

	// 可以添加一些校验逻辑，确保必要的环境变量已设置
	if cfg.Region == "" {
		log.Println("AWS_REGION is not set, please check your environment variables or .env file.")
		//可以选择返回一个错误，或者使用默认值
		//return nil, fmt.Errorf("AWS_REGION is not set")
	}

	return cfg, nil
}

// NewAWSSessionWithConfig 创建一个带有指定配置的 AWS Session
func NewAWSSessionWithConfig(ctx context.Context, awsCfg *AWSConfig) (aws.Config, error) {
	// 创建 AWS 配置加载选项
	loadOptions := []func(*config.LoadOptions) error{
		config.WithRegion(awsCfg.Region),
		// 添加其他配置选项，例如 config.WithEndpointResolver 等
	}

	// 使用自定义配置创建 AWS Session
	cfg, err := config.LoadDefaultConfig(ctx, loadOptions...)
	if err != nil {
		return aws.Config{}, fmt.Errorf("创建 AWS session 失败: %w", err)
	}

	return cfg, nil
}
