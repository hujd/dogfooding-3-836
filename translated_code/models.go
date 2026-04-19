// models.go - 数据模型定义（Go 语言版本）
package models

import (
	"time"
)

// Dimension 评测维度
type Dimension string

const (
	DimensionComprehension  Dimension = "comprehension"
	DimensionBugDetection   Dimension = "bug_detection"
	DimensionComplexity     Dimension = "complexity"
	DimensionRefactoring    Dimension = "refactoring"
	DimensionSecurity       Dimension = "security"
	DimensionExecutionTrace Dimension = "execution_trace"
	DimensionTranslation    Dimension = "translation"
)

// TaskStatus 任务状态
type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
)

// AnalyzeRequest 提交代码分析任务
type AnalyzeRequest struct {
	Code            string    `json:"code"`
	Language        string    `json:"language"`
	Dimension       Dimension `json:"dimension"`
	InputData       *string   `json:"input_data,omitempty"`
	TargetLanguage  *string   `json:"target_language,omitempty"`
	Model           *string   `json:"model,omitempty"`
}

// TaskResponse 任务结果
type TaskResponse struct {
	TaskID        string     `json:"task_id"`
	Dimension     Dimension  `json:"dimension"`
	Status        TaskStatus `json:"status"`
	Code          string     `json:"code"`
	Language      string     `json:"language"`
	ModelUsed     string     `json:"model_used"`
	PromptSent    string     `json:"prompt_sent"`
	ModelResponse string     `json:"model_response"`
	CreatedAt     string     `json:"created_at"`
	CompletedAt   *string    `json:"completed_at,omitempty"`
	Error         *string    `json:"error,omitempty"`
}

// NewTaskResponse 创建任务响应
func NewTaskResponse(dimension Dimension, code, language, model, prompt string) *TaskResponse {
	now := time.Now().UTC().Format(time.RFC3339)
	return &TaskResponse{
		TaskID:     generateTaskID(),
		Dimension:  dimension,
		Status:     TaskStatusPending,
		Code:       code,
		Language:   language,
		ModelUsed:  model,
		PromptSent: prompt,
		CreatedAt:  now,
	}
}

// generateTaskID 生成唯一任务 ID
func generateTaskID() string {
	return fmt.Sprintf("%d-%s", time.Now().UnixMilli(), randomString(8))
}

// EvaluationResult 评分结果
type EvaluationResult struct {
	TaskID      string            `json:"task_id"`
	Dimension   Dimension         `json:"dimension"`
	Score       float64           `json:"score"`
	Breakdown   map[string]any    `json:"breakdown"`
	Issues      []string          `json:"issues"`
	IssueTypes  []string          `json:"issue_types"`
	Summary     string            `json:"summary"`
	EvaluatedAt string            `json:"evaluated_at"`
}

// TestCase 测试用例
type TestCase struct {
	ID                 string    `json:"id"`
	Dimension          Dimension `json:"dimension"`
	Title              string    `json:"title"`
	Description        string    `json:"description"`
	Code               string    `json:"code"`
	Language           string    `json:"language"`
	ExpectedKeyPoints  []string  `json:"expected_key_points,omitempty"`
	KnownBugs          []string  `json:"known_bugs,omitempty"`
	KnownVulnerabilities []string `json:"known_vulnerabilities,omitempty"`
	ExpectedOutput     *string   `json:"expected_output,omitempty"`
	InputData          *string   `json:"input_data,omitempty"`
	TargetLanguage     *string   `json:"target_language,omitempty"`
	ExpectedComplexity *string   `json:"expected_complexity,omitempty"`
}
