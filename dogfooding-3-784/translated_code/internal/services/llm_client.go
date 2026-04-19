// internal/services/llm_client.go
// 大模型 API 客户端
package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"code-eval/internal/config"
)

// LLMClient 大模型客户端
type LLMClient struct {
	config     *config.Config
	httpClient *http.Client
}

// NewLLMClient 创建 LLM 客户端
func NewLLMClient(cfg *config.Config) *LLMClient {
	return &LLMClient{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// Message 聊天消息
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// LLMRequest API 请求体
type LLMRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"max_tokens"`
}

// LLMResponse API 响应体
type LLMResponse struct {
	Choices []struct {
		Message Message `json:"message"`
	} `json:"choices"`
}

// CallLLM 调用大模型 API
//
// 参数:
//   - ctx: 上下文
//   - systemPrompt: 系统提示词
//   - userPrompt: 用户提示词
//   - model: 模型名称（可选，默认使用配置）
//   - temperature: 采样温度（可选）
//   - maxTokens: 最大 token 数（可选）
//
// 返回:
//   - 模型生成的响应文本
//   - 错误信息
func (c *LLMClient) CallLLM(
	ctx context.Context,
	systemPrompt string,
	userPrompt string,
	model *string,
	temperature *float64,
	maxTokens *int,
) (string, error) {
	// 使用传入参数或默认值
	m := c.config.LLMModel
	if model != nil {
		m = *model
	}

	t := c.config.LLMTemperature
	if temperature != nil {
		t = *temperature
	}

	mt := c.config.LLMMaxTokens
	if maxTokens != nil {
		mt = *maxTokens
	}

	// 构建请求体
	payload := LLMRequest{
		Model: m,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature: t,
		MaxTokens:   mt,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	// 创建请求
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.config.LLMAPIURL,
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	// 设置请求头
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.config.LLMAPIKey)

	// 发送请求
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	// 解析响应
	var llmResp LLMResponse
	if err := json.NewDecoder(resp.Body).Decode(&llmResp); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if len(llmResp.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	return llmResp.Choices[0].Message.Content, nil
}
