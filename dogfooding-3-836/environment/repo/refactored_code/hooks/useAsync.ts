import { useState, useCallback } from 'react'

export function useAsync<T, Args extends any[] = []>(
  fn: (...args: Args) => Promise<T>
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(async (...args: Args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn(...args)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [fn])

  return { execute, loading, error }
}
