// internal/models/models.go
// 数据模型定义
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

// IsValid 检查维度是否有效
func (d Dimension) IsValid() bool {
	switch d {
	case DimensionComprehension, DimensionBugDetection, DimensionComplexity,
		DimensionRefactoring, DimensionSecurity, DimensionExecutionTrace,
		DimensionTranslation:
		return true
	}
	return false
}

// TaskStatus 任务状态
type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
)

// AnalyzeRequest 提交代码分析请求
type AnalyzeRequest struct {
	Code           string     `json:"code" binding:"required"`
	Language       string     `json:"language" default:"python"`
	Dimension      Dimension  `json:"dimension" binding:"required"`
	InputData      *string    `json:"input_data,omitempty"`
	TargetLanguage *string    `json:"target_language,omitempty"`
	Model          *string    `json:"model,omitempty"`
}

// EvaluateRequest 评分请求
type EvaluateRequest struct {
	TaskID          string  `json:"task_id" binding:"required"`
	ReferenceAnswer *string `json:"reference_answer,omitempty"`
}

// TaskResponse 任务响应
type TaskResponse struct {
	TaskID        string     `json:"task_id"`
	Dimension     Dimension  `json:"dimension"`
	Status        TaskStatus `json:"status"`
	Code          string     `json:"code"`
	Language      string     `json:"language"`
	ModelUsed     string     `json:"model_used"`
	PromptSent    string     `json:"prompt_sent"`
	ModelResponse string     `json:"model_response"`
	CreatedAt     time.Time  `json:"created_at"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
	Error         *string    `json:"error,omitempty"`
}

// EvaluationResult 评分结果
type EvaluationResult struct {
	TaskID      string                 `json:"task_id"`
	Dimension   Dimension              `json:"dimension"`
	Score       float64                `json:"score" binding:"gte=1,lte=5"`
	Breakdown   map[string]interface{} `json:"breakdown"`
	Issues      []string               `json:"issues"`
	IssueTypes  []string               `json:"issue_types"`
	Summary     string                 `json:"summary"`
	EvaluatedAt time.Time              `json:"evaluated_at"`
}

// TestCase 测试用例
type TestCase struct {
	ID                   string     `json:"id"`
	Dimension            Dimension  `json:"dimension"`
	Title                string     `json:"title"`
	Description          string     `json:"description"`
	Code                 string     `json:"code"`
	Language             string     `json:"language"`
	ExpectedKeyPoints    []string   `json:"expected_key_points"`
	KnownBugs            []string   `json:"known_bugs"`
	KnownVulnerabilities []string   `json:"known_vulnerabilities"`
	ExpectedOutput       *string    `json:"expected_output,omitempty"`
	InputData            *string    `json:"input_data,omitempty"`
	TargetLanguage       *string    `json:"target_language,omitempty"`
	ExpectedComplexity   *string    `json:"expected_complexity,omitempty"`
}

// BatchRequest 批量评测请求
type BatchRequest struct {
	Model       *string  `json:"model,omitempty"`
	Dimensions  []string `json:"dimensions,omitempty"`
	Concurrency int      `json:"concurrency" binding:"gte=1,lte=20"`
}

// BatchResultItem 批量结果项
type BatchResultItem struct {
	Task       TaskResponse       `json:"task"`
	Evaluation *EvaluationResult  `json:"evaluation,omitempty"`
}

// BatchResponse 批量评测响应
type BatchResponse struct {
	ModelUsed        string            `json:"model_used"`
	TotalCases       int               `json:"total_cases"`
	Completed        int               `json:"completed"`
	Failed           int               `json:"failed"`
	AvgScore         float64           `json:"avg_score"`
	DimensionScores  map[string]float64 `json:"dimension_scores"`
	Results          []BatchResultItem `json:"results"`
	StartedAt        time.Time         `json:"started_at"`
	FinishedAt       time.Time         `json:"finished_at"`
}
