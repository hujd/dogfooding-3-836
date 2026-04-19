/**
 * 代码分析页面 - 重构版本
 * 修复了：1. any 类型 2. XSS 风险 3. 提取 loading 逻辑 4. 串行改为并行请求
 */
import { useState } from 'react'
import { Card, Select, Button, Tabs, message, Space, Spin } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import DOMPurify from 'dompurify'
import { analyzeCode, type Dimension } from '../services/api'
import { useAppStore } from '../store'
import { DIMENSION_LABELS, LANGUAGES, TARGET_LANGUAGES } from '../utils/constants'
import { useAsync } from '../hooks/useAsync'

function AnalyzePage() {
  const [code, setCode] = useState('# 在此输入代码...\n')
  const [language, setLanguage] = useState('python')
  const [dimensions, setDimensions] = useState<Dimension[]>(['comprehension'])
  const [targetLanguage, setTargetLanguage] = useState('go')
  const [inputData, setInputData] = useState('')
  const [results, setResults] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState('comprehension')

  const addHistory = useAppStore((s) => s.addHistory)
  const { execute: runAnalyze, loading } = useAsync(analyzeCode)

  const handleAnalyze = async () => {
    if (!code.trim()) {
      message.warning('请输入代码')
      return
    }
    if (dimensions.length === 0) {
      message.warning('请选择至少一个分析维度')
      return
    }

    setResults({})

    try {
      const promises = dimensions.map(async (dim) => {
        try {
          const { data } = await runAnalyze({
            code,
            language,
            dimension: dim,
            input_data: dim === 'execution_trace' ? inputData : undefined,
            target_language: dim === 'translation' ? targetLanguage : undefined,
          })
          return { success: true as const, dim, data }
        } catch {
          return { success: false as const, dim }
        }
      })

      const settledResults = await Promise.all(promises)
      const newResults: Record<string, string> = {}
      
      settledResults.forEach((r) => {
        if (r.success) {
          newResults[r.dim] = r.data.model_response
          addHistory(r.data)
        }
      })

      setResults(newResults)
      setActiveTab(dimensions[0])
      
      const successCount = settledResults.filter(r => r.success).length
      message.success(`分析完成：${successCount}/${dimensions.length} 个维度成功`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误'
      message.error(`分析失败: ${errorMsg}`)
    }
  }

  const handleExport = () => {
    const content = Object.entries(results)
      .map(([dim, res]) => `# ${DIMENSION_LABELS[dim]}\n\n${res}`)
      .join('\n\n---\n\n')

    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'analysis_report.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Card title="代码输入" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space>
            <Select
              value={language}
              onChange={setLanguage}
              options={LANGUAGES}
              style={{ width: 150 }}
              placeholder="选择语言"
            />
            <Select
              mode="multiple"
              value={dimensions}
              onChange={setDimensions}
              style={{ width: 400 }}
              placeholder="选择分析维度"
              options={Object.entries(DIMENSION_LABELS).map(([k, v]) => ({
                value: k,
                label: v,
              }))}
            />
            {dimensions.includes('translation') && (
              <Select
                value={targetLanguage}
                onChange={setTargetLanguage}
                options={TARGET_LANGUAGES}
                style={{ width: 150 }}
                placeholder="目标语言"
              />
            )}
          </Space>

          <Editor
            height="350px"
            language={language}
            value={code}
            onChange={(v) => setCode(v || '')}
            theme="vs-dark"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
            }}
          />

          <Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleAnalyze}
              loading={loading}
              size="large"
            >
              开始分析
            </Button>
            {Object.keys(results).length > 0 && (
              <Button onClick={handleExport}>导出报告</Button>
            )}
          </Space>
        </Space>
      </Card>

      {(loading || Object.keys(results).length > 0) && (
        <Card title="分析结果">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin size="large" tip="正在分析中..." />
            </div>
          ) : (
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={dimensions.map((dim) => ({
                key: dim,
                label: DIMENSION_LABELS[dim],
                children: results[dim] ? (
                  <div style={{ padding: 16 }}>
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                      {DOMPurify.sanitize(results[dim])}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div style={{ color: '#999', padding: 16 }}>暂无结果</div>
                ),
              }))}
            />
          )}
        </Card>
      )}
    </div>
  )
}

export default AnalyzePage
