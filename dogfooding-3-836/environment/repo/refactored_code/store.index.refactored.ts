/**
 * 全局状态管理 - 重构版本
 * 修复了：1. localStorage 容量异常捕获 2. 类型安全
 */
import { create } from 'zustand'
import type { TaskResponse } from '../services/api'

export interface HistoryItem {
  id: string
  task: TaskResponse
  timestamp: string
}

function isValidHistoryItem(item: unknown): item is HistoryItem {
  if (typeof item !== 'object' || item === null) return false
  const obj = item as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.task === 'object' &&
    obj.task !== null &&
    typeof (obj.task as Record<string, unknown>).task_id === 'string'
  )
}

interface AppState {
  history: HistoryItem[]
  addHistory: (task: TaskResponse) => void
  clearHistory: () => void
  loadHistory: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  history: [],

  addHistory: (task) => {
    const item: HistoryItem = {
      id: task.task_id,
      task,
      timestamp: new Date().toISOString(),
    }
    const updated = [item, ...get().history].slice(0, 50)
    set({ history: updated })
    
    try {
      localStorage.setItem('analysis_history', JSON.stringify(updated))
    } catch (error) {
      console.error('Failed to save history:', error)
    }
  },

  clearHistory: () => {
    set({ history: [] })
    try {
      localStorage.removeItem('analysis_history')
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  },

  loadHistory: () => {
    try {
      const raw = localStorage.getItem('analysis_history')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.every(isValidHistoryItem)) {
          set({ history: parsed })
        } else {
          console.warn('Invalid history format, resetting')
          set({ history: [] })
        }
      }
    } catch {
      set({ history: [] })
    }
  },
}))
