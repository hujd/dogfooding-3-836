/**
 * API 请求封装
 * 对接后端代码分析 API 服务
 */
import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 120000, // 大模型调用可能较慢
})

/** 分析维度枚举 */
export type Dimension =
  | 'comprehension'
  | 'bug_detection'
  | 'complexity'
  | 'refactoring'
  | 'security'
  | 'execution_trace'
  | 'translation'

/** 分析请求参数 */
export interface AnalyzeRequest {
  code: string
  language: string
  dimension: Dimension
  input_data?: string
  target_language?: string
  model?: string
}

/** 任务响应 */
export interface TaskResponse {
  task_id: string
  dimension: Dimension
  status: 'pending' | 'running' | 'completed' | 'failed'
  code: string
  language: string
  model_used: string
  prompt_sent: string
  model_response: string
  created_at: string
  completed_at?: string
  error?: string
}

/** 测试用例 */
export interface TestCase {
  id: string
  dimension: Dimension
  title: string
  description: string
  code: string
  language: string
}

/** 批量评测结果 */
export interface BatchResponse {
  model_used: string
  total_cases: number
  completed: number
  failed: number
  avg_score: number
  dimension_scores: Record<string, number>
  results: Array<{ task: TaskResponse; evaluation: any }>
}

/** 提交代码分析任务 */
export const analyzeCode = (data: AnalyzeRequest) =>
  api.post<TaskResponse>('/analyze', data)

/** 获取任务结果 */
export const getTask = (taskId: string) =>
  api.get<TaskResponse>(`/tasks/${taskId}`)

/** 获取所有测试用例 */
export const getTestCases = () =>
  api.get<TestCase[]>('/test-cases')

/** 获取特定维度的测试用例 */
export const getTestCasesByDimension = (dimension: Dimension) =>
  api.get<TestCase[]>(`/test-cases/dimension/${dimension}`)

/** 批量评测 */
export const runBatch = (model?: string, dimensions?: string[]) =>
  api.post<BatchResponse>('/batch/run', { model, dimensions })

/** 评分 */
export const evaluateTask = (taskId: string, referenceAnswer?: string) =>
  api.post('/evaluate', { task_id: taskId, reference_answer: referenceAnswer })

export default api
