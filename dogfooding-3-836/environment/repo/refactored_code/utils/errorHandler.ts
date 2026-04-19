export function handleApiError(err: unknown, prefix: string = '操作失败'): string {
  const message = err instanceof Error ? err.message : '未知错误'
  return `${prefix}: ${message}`
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'string') {
    return err
  }
  return '未知错误'
}
