import { useState, useEffect, useCallback } from 'react'

interface UseLocalStorageOptions<T> {
  key: string
  initialValue: T
  maxLength?: number
}

interface UseLocalStorageReturn<T> {
  value: T
  setValue: (value: T | ((prev: T) => T)) => void
  remove: () => void
  loading: boolean
}

export function useLocalStorage<T>({
  key,
  initialValue,
  maxLength,
}: UseLocalStorageOptions<T>): UseLocalStorageReturn<T> {
  const [value, setValueState] = useState<T>(initialValue)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        setValueState(parsed)
      }
    } catch {
      console.error(`Failed to load ${key} from localStorage`)
    } finally {
      setLoading(false)
    }
  }, [key])

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValueState((prev) => {
        const resolvedValue = newValue instanceof Function ? newValue(prev) : newValue
        let finalValue = resolvedValue

        if (Array.isArray(finalValue) && maxLength !== undefined) {
          finalValue = finalValue.slice(0, maxLength) as T
        }

        try {
          localStorage.setItem(key, JSON.stringify(finalValue))
        } catch (err) {
          console.error(`Failed to save ${key} to localStorage:`, err)
        }

        return finalValue
      })
    },
    [key, maxLength]
  )

  const remove = useCallback(() => {
    setValueState(initialValue)
    localStorage.removeItem(key)
  }, [key, initialValue])

  return { value, setValue, remove, loading }
}
