// llm_client.go - 大模型 API 客户端（Go 语言版本）
package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Config 定义 LLM 客户端配置
type Config struct {
	APIURL      string
	APIKey      string
	Model       string
	Temperature float64
	MaxTokens   int
	Timeout     time.Duration
}

// LLMClient 大模型客户端
type LLMClient struct {
	config Config
	client *http.Client
}

// NewLLMClient 创建 LLM 客户端实例
func NewLLMClient(config Config) *LLMClient {
	if config.Timeout == 0 {
		config.Timeout = 120 * time.Second
	}
	return &LLMClient{
		config: config,
		client: &http.Client{Timeout: config.Timeout},
	}
}

// Message 定义消息结构
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Request 定义请求体
type Request struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"max_tokens"`
}

// Response 定义响应体
type Response struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
}

// CallOption 调用选项函数类型
type CallOption func(*Config)

// WithModel 设置模型
func WithModel(model string) CallOption {
	return func(c *Config) {
		c.Model = model
	}
}

// WithTemperature 设置温度
func WithTemperature(temp float64) CallOption {
	return func(c *Config) {
		c.Temperature = temp
	}
}

// WithMaxTokens 设置最大 token 数
func WithMaxTokens(tokens int) CallOption {
	return func(c *Config) {
		c.MaxTokens = tokens
	}
}

// CallLLM 调用大模型 API
func (c *LLMClient) CallLLM(ctx context.Context, systemPrompt, userPrompt string, opts ...CallOption) (string, error) {
	// 应用可选参数
	cfg := c.config
	for _, opt := range opts {
		opt(&cfg)
	}

	// 构建请求体
	reqBody := Request{
		Model: cfg.Model,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: cfg.Temperature,
		MaxTokens:   cfg.MaxTokens,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("序列化请求失败: %w", err)
	}

	// 创建 HTTP 请求
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.APIURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("创建请求失败: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", cfg.APIKey))

	// 发送请求
	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	// 检查状态码
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API 返回错误: status=%d, body=%s", resp.StatusCode, string(body))
	}

	// 解析响应
	var result Response
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析响应失败: %w", err)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("响应中没有选择项")
	}

	return result.Choices[0].Message.Content, nil
}

// Close 关闭客户端
func (c *LLMClient) Close() {
	c.client.CloseIdleConnections()
}
