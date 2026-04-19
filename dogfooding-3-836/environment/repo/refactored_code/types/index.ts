export type Dimension =
  | 'comprehension'
  | 'bug_detection'
  | 'complexity'
  | 'refactoring'
  | 'security'
  | 'execution_trace'
  | 'translation'

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

export interface HistoryItem {
  id: string
  task: TaskResponse
  timestamp: string
}

export interface AnalyzeRequest {
  code: string
  language: string
  dimension: Dimension
  input_data?: string
  target_language?: string
  model?: string
}

export interface TestCase {
  id: string
  dimension: Dimension
  title: string
  description: string
  code: string
  language: string
}

export interface BatchResponse {
  model_used: string
  total_cases: number
  completed: number
  failed: number
  avg_score: number
  dimension_scores: Record<string, number>
  results: Array<{ task: TaskResponse; evaluation: unknown }>
}
