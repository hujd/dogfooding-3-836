/**
 * 代码分析页面
 * 用户输入代码、选择维度、查看分析结果
 */
import { useState } from 'react'
import { Card, Select, Button, Tabs, message, Space, Spin } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import { analyzeCode, type Dimension } from '../services/api'
import { useAppStore } from '../store'
import { DIMENSION_LABELS, LANGUAGES, TARGET_LANGUAGES } from '../utils/constants'

function AnalyzePage() {
  // 表单状态
  const [code, setCode] = useState('# 在此输入代码...\n')
  const [language, setLanguage] = useState('python')
  const [dimensions, setDimensions] = useState<Dimension[]>(['comprehension'])
  const [targetLanguage, setTargetLanguage] = useState('go')
  const [inputData, setInputData] = useState('')

  // 结果状态
  const [results, setResults] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('comprehension')

  const addHistory = useAppStore((s) => s.addHistory)

  /** 提交分析任务 */
  const handleAnalyze = async () => {
    if (!code.trim()) {
      message.warning('请输入代码')
      return
    }
    if (dimensions.length === 0) {
      message.warning('请选择至少一个分析维度')
      return
    }

    setLoading(true)
    setResults({})

    try {
      // 逐维度提交分析
      for (const dim of dimensions) {
        const { data } = await analyzeCode({
          code,
          language,
          dimension: dim,
          input_data: dim === 'execution_trace' ? inputData : undefined,
          target_language: dim === 'translation' ? targetLanguage : undefined,
        })

        setResults((prev) => ({ ...prev, [dim]: data.model_response }))
        addHistory(data)
      }

      setActiveTab(dimensions[0])
      message.success('分析完成')
    } catch (err: any) {
      message.error(`分析失败: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  /** 导出分析结果 */
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
      {/* 代码输入区 */}
      <Card title="代码输入" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* 语言选择 */}
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
            {/* 翻译目标语言 */}
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

          {/* 代码编辑器 */}
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

          {/* 操作按钮 */}
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

      {/* 分析结果区 */}
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
                      {results[dim]}
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
