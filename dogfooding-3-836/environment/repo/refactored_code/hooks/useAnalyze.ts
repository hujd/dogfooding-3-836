import { useState, useCallback } from 'react'
import { message } from 'antd'
import { analyzeCode } from '../../services/api'
import { useAppStore } from '../../store'
import type { Dimension } from '../types'

interface AnalyzeOptions {
  targetLanguage?: string
  inputData?: string
}

interface UseAnalyzeReturn {
  results: Record<string, string>
  loading: boolean
  analyze: (
    code: string,
    language: string,
    dimensions: Dimension[],
    options?: AnalyzeOptions
  ) => Promise<{ success: boolean; error?: string }>
  resetResults: () => void
}

const MAX_CODE_LENGTH = 100000

export function useAnalyze(): UseAnalyzeReturn {
  const [results, setResults] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const addHistory = useAppStore((s) => s.addHistory)

  const analyze = useCallback(
    async (
      code: string,
      language: string,
      dimensions: Dimension[],
      options?: AnalyzeOptions
    ) => {
      if (loading) {
        return { success: false, error: '正在分析中，请稍候' }
      }

      if (!code.trim()) {
        message.warning('请输入代码')
        return { success: false, error: '请输入代码' }
      }

      if (code.length > MAX_CODE_LENGTH) {
        message.warning(`代码长度超过限制（最大 ${MAX_CODE_LENGTH / 1000}KB）`)
        return { success: false, error: '代码长度超过限制' }
      }

      if (dimensions.length === 0) {
        message.warning('请选择至少一个分析维度')
        return { success: false, error: '请选择分析维度' }
      }

      setLoading(true)
      setResults({})

      try {
        for (const dim of dimensions) {
          const { data } = await analyzeCode({
            code,
            language,
            dimension: dim,
            input_data: dim === 'execution_trace' ? options?.inputData : undefined,
            target_language: dim === 'translation' ? options?.targetLanguage : undefined,
          })
          setResults((prev) => ({ ...prev, [dim]: data.model_response }))
          addHistory(data)
        }

        message.success('分析完成')
        return { success: true }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '未知错误'
        message.error(`分析失败: ${errorMessage}`)
        return { success: false, error: errorMessage }
      } finally {
        setLoading(false)
      }
    },
    [loading, addHistory]
  )

  const resetResults = useCallback(() => {
    setResults({})
  }, [])

  return { results, loading, analyze, resetResults }
}
