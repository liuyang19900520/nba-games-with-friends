package main

import (
	"context"
	"log"
)

func main() {
	ctx := context.Background()

	// 使用 Wire 生成的初始化函数
	engine, err := InitializeApp(ctx)
	if err != nil {
		log.Fatalf("failed to initialize application: %v", err)
	}

	// 启动服务器
	if err := engine.Run(":8080"); err != nil {
		log.Fatalf("failed to run the server: %v", err)
	}
}
