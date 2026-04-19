import axios from 'axios'
import type { AnalyzeRequest, TaskResponse, TestCase, BatchResponse, Dimension } from './types'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 120000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('未授权，请重新登录')
    } else if (error.response?.status && error.response.status >= 500) {
      console.error('服务器错误:', error.response.status)
    }
    return Promise.reject(error)
  }
)

export const analyzeCode = (data: AnalyzeRequest) =>
  api.post<TaskResponse>('/analyze', data)

export const getTask = (taskId: string) =>
  api.get<TaskResponse>(`/tasks/${taskId}`)

export const getTestCases = () =>
  api.get<TestCase[]>('/test-cases')

export const getTestCasesByDimension = (dimension: Dimension) =>
  api.get<TestCase[]>(`/test-cases/dimension/${dimension}`)

export const runBatch = (model?: string, dimensions?: string[]) =>
  api.post<BatchResponse>('/batch/run', { model, dimensions })

export const evaluateTask = (taskId: string, referenceAnswer?: string) =>
  api.post('/evaluate', { task_id: taskId, reference_answer: referenceAnswer })

export default api
