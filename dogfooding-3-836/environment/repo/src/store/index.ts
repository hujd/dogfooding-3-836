/**
 * 全局状态管理
 * 使用 Zustand 管理应用状态
 */
import { create } from 'zustand'
import type { TaskResponse } from '../services/api'

/** 历史记录项 */
export interface HistoryItem {
  id: string
  task: TaskResponse
  timestamp: string
}

interface AppState {
  /** 历史记录列表 */
  history: HistoryItem[]
  /** 添加历史记录 */
  addHistory: (task: TaskResponse) => void
  /** 清空历史记录 */
  clearHistory: () => void
  /** 从本地存储加载历史 */
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
    const updated = [item, ...get().history].slice(0, 50) // 最多保留 50 条
    set({ history: updated })
    localStorage.setItem('analysis_history', JSON.stringify(updated))
  },

  clearHistory: () => {
    set({ history: [] })
    localStorage.removeItem('analysis_history')
  },

  loadHistory: () => {
    try {
      const raw = localStorage.getItem('analysis_history')
      if (raw) {
        set({ history: JSON.parse(raw) })
      }
    } catch {
      // 解析失败忽略
    }
  },
}))
