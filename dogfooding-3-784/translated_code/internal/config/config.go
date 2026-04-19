// internal/config/config.go
// 应用配置管理
package config

import (
	"os"
	"strconv"
)

// Config 全局配置
type Config struct {
	// 大模型 API 配置
	LLMAPIURL      string
	LLMAPIKey      string
	LLMModel       string
	LLMTemperature float64
	LLMMaxTokens   int

	// 服务配置
	Host  string
	Port  string
	Debug bool
}

// Load 从环境变量加载配置
func Load() *Config {
	return &Config{
		LLMAPIURL:      getEnv("LLM_API_URL", "https://api.openai.com/v1/chat/completions"),
		LLMAPIKey:      getEnv("LLM_API_KEY", ""),
		LLMModel:       getEnv("LLM_MODEL", "gpt-4o"),
		LLMTemperature: getEnvAsFloat("LLM_TEMPERATURE", 0.1),
		LLMMaxTokens:   getEnvAsInt("LLM_MAX_TOKENS", 4096),
		Host:           getEnv("HOST", "0.0.0.0"),
		Port:           getEnv("PORT", "8100"),
		Debug:          getEnvAsBool("DEBUG", false),
	}
}

// getEnv 获取字符串环境变量
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsFloat 获取浮点数环境变量
func getEnvAsFloat(key string, defaultValue float64) float64 {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.ParseFloat(valueStr, 64)
	if err != nil {
		return defaultValue
	}
	return value
}

// getEnvAsInt 获取整数环境变量
func getEnvAsInt(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return defaultValue
	}
	return value
}

// getEnvAsBool 获取布尔环境变量
func getEnvAsBool(key string, defaultValue bool) bool {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}
	value, err := strconv.ParseBool(valueStr)
	if err != nil {
		return defaultValue
	}
	return value
}
