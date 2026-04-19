import { create } from 'zustand'
import type { HistoryItem, TaskResponse, TestCase, BatchResponse } from './types'

interface AppState {
  history: HistoryItem[]
  testCases: TestCase[]
  batchResult: BatchResponse | null
  loading: boolean
  addHistory: (task: TaskResponse) => void
  clearHistory: () => void
  loadHistory: () => void
  setTestCases: (cases: TestCase[]) => void
  setBatchResult: (result: BatchResponse | null) => void
  setLoading: (loading: boolean) => void
}

const MAX_HISTORY_LENGTH = 50

export const useAppStore = create<AppState>((set, get) => ({
  history: [],
  testCases: [],
  batchResult: null,
  loading: false,

  addHistory: (task) => {
    const item: HistoryItem = {
      id: task.task_id,
      task,
      timestamp: new Date().toISOString(),
    }
    const updated = [item, ...get().history].slice(0, MAX_HISTORY_LENGTH)
    set({ history: updated })
    try {
      localStorage.setItem('analysis_history', JSON.stringify(updated))
    } catch (err) {
      console.error('Failed to save history to localStorage:', err)
    }
  },

  clearHistory: () => {
    set({ history: [] })
    localStorage.removeItem('analysis_history')
  },

  loadHistory: () => {
    try {
      const raw = localStorage.getItem('analysis_history')
      if (raw) {
        const parsed = JSON.parse(raw)
        set({ history: parsed })
      }
    } catch (err) {
      console.error('Failed to load history from localStorage:', err)
    }
  },

  setTestCases: (cases) => set({ testCases: cases }),
  setBatchResult: (result) => set({ batchResult: result }),
  setLoading: (loading) => set({ loading }),
}))
