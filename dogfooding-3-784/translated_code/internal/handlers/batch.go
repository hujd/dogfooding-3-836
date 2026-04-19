// internal/handlers/batch.go
// 批量评测路由处理
package handlers

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"code-eval/internal/config"
	"code-eval/internal/models"
	"code-eval/internal/services"
)

// RegisterBatchRoutes 注册批量评测路由
func RegisterBatchRoutes(rg *gin.RouterGroup) {
	rg.POST("/run", runBatch)
}

// runBatch 批量运行测试用例
func runBatch(c *gin.Context) {
	var req models.BatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 设置默认值
	model := cfg.LLMModel
	if req.Model != nil {
		model = *req.Model
	}

	concurrency := req.Concurrency
	if concurrency == 0 {
		concurrency = 5
	}

	startedAt := time.Now()

	// 获取测试用例
	cases := getTestCases(req.Dimensions)

	// 并发处理
	results := processCasesConcurrently(c.Request.Context(), cases, model, concurrency)

	// 统计
	stats := calculateStats(results)
	finishedAt := time.Now()

	response := models.BatchResponse{
		ModelUsed:       model,
		TotalCases:      len(cases),
		Completed:       stats.completed,
		Failed:          stats.failed,
		AvgScore:        stats.avgScore,
		DimensionScores: stats.dimensionScores,
		Results:         results,
		StartedAt:       startedAt,
		FinishedAt:      finishedAt,
	}

	c.JSON(http.StatusOK, response)
}

// 测试用例数据（简化版）
var testCases = []models.TestCase{
	{
		ID:          "comp-001",
		Dimension:   models.DimensionComprehension,
		Title:       "LRU Cache 实现",
		Description: "基于 OrderedDict 的 LRU 缓存",
		Language:    "python",
		Code:        "from collections import OrderedDict\n\nclass LRUCache:\n    def __init__(self, capacity: int):\n        self.cache = OrderedDict()\n        self.capacity = capacity",
	},
	{
		ID:          "bug-001",
		Dimension:   models.DimensionBugDetection,
		Title:       "二分查找 off-by-one",
		Description: "经典的二分查找实现，含有边界错误",
		Language:    "python",
		Code:        "def binary_search(arr, target):\n    left, right = 0, len(arr)\n    while left < right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid",
	},
}

// getTestCases 获取测试用例
func getTestCases(dimensions []string) []models.TestCase {
	if len(dimensions) == 0 {
		return testCases
	}

	var filtered []models.TestCase
	dimMap := make(map[string]bool)
	for _, d := range dimensions {
		dimMap[d] = true
	}

	for _, c := range testCases {
		if dimMap[string(c.Dimension)] {
			filtered = append(filtered, c)
		}
	}
	return filtered
}

// stats 统计信息
type stats struct {
	completed       int
	failed          int
	avgScore        float64
	dimensionScores map[string]float64
}

// calculateStats 计算统计信息
func calculateStats(results []models.BatchResultItem) stats {
	s := stats{
		dimensionScores: make(map[string]float64),
	}

	dimScores := make(map[string][]float64)
	var totalScore float64
	var scoreCount int

	for _, r := range results {
		if r.Task.Status == models.TaskStatusCompleted {
			s.completed++
			if r.Evaluation != nil {
				dimKey := string(r.Task.Dimension)
				dimScores[dimKey] = append(dimScores[dimKey], r.Evaluation.Score)
				totalScore += r.Evaluation.Score
				scoreCount++
			}
		} else {
			s.failed++
		}
	}

	// 计算平均分
	if scoreCount > 0 {
		s.avgScore = totalScore / float64(scoreCount)
	}

	// 计算各维度平均分
	for dim, scores := range dimScores {
		var sum float64
		for _, score := range scores {
			sum += score
		}
		s.dimensionScores[dim] = sum / float64(len(scores))
	}

	return s
}

// processCasesConcurrently 并发处理测试用例
func processCasesConcurrently(
	ctx context.Context,
	cases []models.TestCase,
	model string,
	concurrency int,
) []models.BatchResultItem {
	// 创建信号量控制并发
	semaphore := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	results := make([]models.BatchResultItem, len(cases))
	var mu sync.Mutex

	for i, c := range cases {
		wg.Add(1)
		go func(index int, tc models.TestCase) {
			defer wg.Done()

			semaphore <- struct{}{}        // 获取信号量
			defer func() { <-semaphore }() // 释放信号量

			result := processSingleCase(ctx, tc, model)

			mu.Lock()
			results[index] = result
			mu.Unlock()
		}(i, c)
	}

	wg.Wait()
	return results
}

// processSingleCase 处理单个用例
func processSingleCase(
	ctx context.Context,
	c models.TestCase,
	model string,
) models.BatchResultItem {
	// 构建请求
	req := models.AnalyzeRequest{
		Code:           c.Code,
		Language:       c.Language,
		Dimension:      c.Dimension,
		InputData:      c.InputData,
		TargetLanguage: c.TargetLanguage,
		Model:          &model,
	}

	// 构建提示词
	systemPrompt, userPrompt, err := services.BuildPrompt(req)
	if err != nil {
		return createFailedResult(c, model, err.Error())
	}

	// 创建任务
	taskID := uuid.New().String()[:12]
	task := models.TaskResponse{
		TaskID:     taskID,
		Dimension:  c.Dimension,
		Status:     models.TaskStatusRunning,
		Code:       c.Code,
		Language:   c.Language,
		ModelUsed:  model,
		PromptSent: userPrompt,
		CreatedAt:  time.Now(),
	}

	// 调用 LLM
	response, err := llmClient.CallLLM(ctx, systemPrompt, userPrompt, &model, nil, nil)

	if err != nil {
		task.Status = models.TaskStatusFailed
		errMsg := err.Error()
		task.Error = &errMsg
		return models.BatchResultItem{Task: task}
	}

	task.Status = models.TaskStatusCompleted
	task.ModelResponse = response
	now := time.Now()
	task.CompletedAt = &now

	// TODO: 实际应调用评分服务
	eval := &models.EvaluationResult{
		TaskID:      taskID,
		Dimension:   c.Dimension,
		Score:       4.0,
		EvaluatedAt: time.Now(),
	}

	return models.BatchResultItem{
		Task:       task,
		Evaluation: eval,
	}
}

// createFailedResult 创建失败结果
func createFailedResult(c models.TestCase, model, errMsg string) models.BatchResultItem {
	taskID := uuid.New().String()[:12]
	task := models.TaskResponse{
		TaskID:    taskID,
		Dimension: c.Dimension,
		Status:    models.TaskStatusFailed,
		Code:      c.Code,
		Language:  c.Language,
		ModelUsed: model,
		Error:     &errMsg,
		CreatedAt: time.Now(),
	}
	return models.BatchResultItem{Task: task}
}
