// cmd/server/main.go
// 代码理解与分析 - 评测后端 API 服务 (Go 版本)
package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"code-eval/internal/config"
	"code-eval/internal/handlers"
)

func main() {
	// 加载配置
	cfg := config.Load()

	// 设置运行模式
	if !cfg.Debug {
		gin.SetMode(gin.ReleaseMode)
	}

	// 创建路由
	router := gin.Default()

	// 配置 CORS
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowOrigins = []string{"*"}
	corsConfig.AllowCredentials = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"*"}
	router.Use(cors.New(corsConfig))

	// 注册 API 路由
	api := router.Group("/api/v1")
	{
		handlers.RegisterAnalyzeRoutes(api)
		handlers.RegisterTestCaseRoutes(api)
		handlers.RegisterBatchRoutes(api)
	}

	// 健康检查端点
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"model":  cfg.LLMModel,
		})
	})

	// 启动服务
	addr := cfg.Host + ":" + cfg.Port
	log.Printf("Server starting on %s", addr)
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
