/**
 * 维度名称映射
 */
export const DIMENSION_LABELS: Record<string, string> = {
  comprehension: '代码功能理解',
  bug_detection: 'Bug 检测',
  complexity: '复杂度分析',
  refactoring: '代码重构建议',
  security: '安全漏洞识别',
  execution_trace: '代码执行推演',
  translation: '跨语言翻译',
}

/** 支持的编程语言 */
export const LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'rust', label: 'Rust' },
  { value: 'cpp', label: 'C++' },
]

/** 翻译目标语言 */
export const TARGET_LANGUAGES = LANGUAGES
