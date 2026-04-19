import { useState, useCallback } from 'react'

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  maxItems?: number
) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function
        ? value(storedValue)
        : value

      const finalValue = maxItems && Array.isArray(valueToStore)
        ? valueToStore.slice(0, maxItems)
        : valueToStore

      setStoredValue(finalValue)
      window.localStorage.setItem(key, JSON.stringify(finalValue))
    } catch (error) {
      console.error('Error saving to localStorage:', error)
    }
  }, [key, storedValue, maxItems])

  return [storedValue, setValue] as const
}
