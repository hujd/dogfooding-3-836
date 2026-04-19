// store.go - 任务存储接口（Go 语言版本）
package services

import (
	"sync"
	
	"code-analysis/models"
)

// TaskStore 任务存储接口
type TaskStore interface {
	SaveTask(task *models.TaskResponse) error
	GetTask(taskID string) (*models.TaskResponse, error)
	ListTasks(dimension *models.Dimension, status *string, limit int) ([]*models.TaskResponse, error)
	SaveEvaluation(evaluation *models.EvaluationResult) error
	GetEvaluation(taskID string) (*models.EvaluationResult, error)
}

// InMemoryTaskStore 内存存储实现
type InMemoryTaskStore struct {
	tasks       map[string]*models.TaskResponse
	evaluations map[string]*models.EvaluationResult
	mu          sync.RWMutex
}

// NewInMemoryTaskStore 创建内存存储实例
func NewInMemoryTaskStore() *InMemoryTaskStore {
	return &InMemoryTaskStore{
		tasks:       make(map[string]*models.TaskResponse),
		evaluations: make(map[string]*models.EvaluationResult),
	}
}

// SaveTask 保存任务
func (s *InMemoryTaskStore) SaveTask(task *models.TaskResponse) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tasks[task.TaskID] = task
	return nil
}

// GetTask 获取任务
func (s *InMemoryTaskStore) GetTask(taskID string) (*models.TaskResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	task, ok := s.tasks[taskID]
	if !ok {
		return nil, fmt.Errorf("task not found: %s", taskID)
	}
	return task, nil
}

// ListTasks 列出任务
func (s *InMemoryTaskStore) ListTasks(dimension *models.Dimension, status *string, limit int) ([]*models.TaskResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var results []*models.TaskResponse
	for _, task := range s.tasks {
		// 过滤维度
		if dimension != nil && task.Dimension != *dimension {
			continue
		}
		// 过滤状态
		if status != nil && string(task.Status) != *status {
			continue
		}
		results = append(results, task)
	}

	// 限制返回数量
	if len(results) > limit {
		results = results[len(results)-limit:]
	}

	return results, nil
}

// SaveEvaluation 保存评估结果
func (s *InMemoryTaskStore) SaveEvaluation(evaluation *models.EvaluationResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.evaluations[evaluation.TaskID] = evaluation
	return nil
}

// GetEvaluation 获取评估结果
func (s *InMemoryTaskStore) GetEvaluation(taskID string) (*models.EvaluationResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	eval, ok := s.evaluations[taskID]
	if !ok {
		return nil, fmt.Errorf("evaluation not found: %s", taskID)
	}
	return eval, nil
}
