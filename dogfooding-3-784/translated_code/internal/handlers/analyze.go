// internal/handlers/analyze.go
// 分析任务路由处理
package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"code-eval/internal/config"
	"code-eval/internal/models"
	"code-eval/internal/services"
)

// TaskStore 任务存储接口
type TaskStore interface {
	Save(task models.TaskResponse)
	Get(taskID string) (models.TaskResponse, bool)
	List(dimension, status string, limit int) []models.TaskResponse
	SaveEvaluation(eval models.EvaluationResult)
	GetEvaluation(taskID string) (models.EvaluationResult, bool)
}

// MemoryTaskStore 内存任务存储
type MemoryTaskStore struct {
	tasks       map[string]models.TaskResponse
evaluations map[string]models.EvaluationResult
}

// NewMemoryTaskStore 创建内存存储
func NewMemoryTaskStore() *MemoryTaskStore {
	return &MemoryTaskStore{
		tasks:       make(map[string]models.TaskResponse),
		evaluations: make(map[string]models.EvaluationResult),
	}
}

// Save 保存任务
func (s *MemoryTaskStore) Save(task models.TaskResponse) {
	s.tasks[task.TaskID] = task
}

// Get 获取任务
func (s *MemoryTaskStore) Get(taskID string) (models.TaskResponse, bool) {
	task, ok := s.tasks[taskID]
	return task, ok
}

// List 列出任务
func (s *MemoryTaskStore) List(dimension, status string, limit int) []models.TaskResponse {
	var results []models.TaskResponse
	for _, task := range s.tasks {
		if dimension != "" && string(task.Dimension) != dimension {
			continue
		}
		if status != "" && string(task.Status) != status {
			continue
		}
		results = append(results, task)
	}
	// 限制数量并返回最后 limit 个
	if len(results) > limit {
		results = results[len(results)-limit:]
	}
	return results
}

// SaveEvaluation 保存评分
func (s *MemoryTaskStore) SaveEvaluation(eval models.EvaluationResult) {
	s.evaluations[eval.TaskID] = eval
}

// GetEvaluation 获取评分
func (s *MemoryTaskStore) GetEvaluation(taskID string) (models.EvaluationResult, bool) {
	eval, ok := s.evaluations[taskID]
	return eval, ok
}

var (
	taskStore *MemoryTaskStore
	cfg       *config.Config
	llmClient *services.LLMClient
)

func init() {
	taskStore = NewMemoryTaskStore()
	cfg = config.Load()
	llmClient = services.NewLLMClient(cfg)
}

// RegisterAnalyzeRoutes 注册分析路由
func RegisterAnalyzeRoutes(rg *gin.RouterGroup) {
	rg.POST("/analyze", createAnalysis)
	rg.GET("/tasks/:task_id", getTask)
	rg.GET("/tasks", listTasks)
	rg.POST("/evaluate", evaluate)
	rg.GET("/evaluations/:task_id", getEvaluation)
}

// createAnalysis 提交分析任务
func createAnalysis(c *gin.Context) {
	var req models.AnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 构建提示词
	systemPrompt, userPrompt, err := services.BuildPrompt(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 确定模型
	model := cfg.LLMModel
	if req.Model != nil {
		model = *req.Model
	}

	// 创建任务
	taskID := uuid.New().String()[:12]
	task := models.TaskResponse{
		TaskID:     taskID,
		Dimension:  req.Dimension,
		Status:     models.TaskStatusRunning,
		Code:       req.Code,
		Language:   req.Language,
		ModelUsed:  model,
		PromptSent: userPrompt,
		CreatedAt:  time.Now(),
	}

	// 先保存任务（确保失败也能追踪）
	taskStore.Save(task)

	// 调用 LLM
	ctx := c.Request.Context()
	response, err := llmClient.CallLLM(ctx, systemPrompt, userPrompt, &model, nil, nil)

	if err != nil {
		task.Status = models.TaskStatusFailed
		errMsg := err.Error()
		task.Error = &errMsg
	} else {
		task.Status = models.TaskStatusCompleted
		task.ModelResponse = response
		now := time.Now()
		task.CompletedAt = &now
	}

	taskStore.Save(task)
	c.JSON(http.StatusOK, task)
}

// getTask 查询任务
func getTask(c *gin.Context) {
	taskID := c.Param("task_id")
	task, ok := taskStore.Get(taskID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}
	c.JSON(http.StatusOK, task)
}

// listTasks 列出任务
func listTasks(c *gin.Context) {
	dimension := c.Query("dimension")
	status := c.Query("status")
	limit := 50

	tasks := taskStore.List(dimension, status, limit)
	c.JSON(http.StatusOK, tasks)
}

// evaluate 评分
func evaluate(c *gin.Context) {
	var req models.EvaluateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, ok := taskStore.Get(req.TaskID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if task.Status != models.TaskStatusCompleted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Task not completed"})
		return
	}

	// TODO: 实现评分逻辑
	// 这里简化处理，实际应调用评分服务
	eval := models.EvaluationResult{
		TaskID:      task.TaskID,
		Dimension:   task.Dimension,
		Score:       4.0,
		Breakdown:   make(map[string]interface{}),
		Issues:      []string{},
		IssueTypes:  []string{},
		Summary:     "评分功能待完善",
		EvaluatedAt: time.Now(),
	}

	taskStore.SaveEvaluation(eval)
	c.JSON(http.StatusOK, eval)
}

// getEvaluation 获取评分
func getEvaluation(c *gin.Context) {
	taskID := c.Param("task_id")
	eval, ok := taskStore.GetEvaluation(taskID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "Evaluation not found"})
		return
	}
	c.JSON(http.StatusOK, eval)
}
