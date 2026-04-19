import { useState } from 'react'
import { Card, Select, Button, Tabs, Space, Spin, message } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import { useAnalyze } from '../hooks/useAnalyze'
import { DIMENSION_LABELS, LANGUAGES, TARGET_LANGUAGES } from '../utils/constants'
import type { Dimension } from '../types'

function AnalyzePage() {
  const [code, setCode] = useState('# 在此输入代码...\n')
  const [language, setLanguage] = useState('python')
  const [dimensions, setDimensions] = useState<Dimension[]>(['comprehension'])
  const [targetLanguage, setTargetLanguage] = useState('go')
  const [inputData, setInputData] = useState('')
  const [activeTab, setActiveTab] = useState('comprehension')

  const { results, loading, analyze, resetResults } = useAnalyze()

  const handleAnalyze = async () => {
    await analyze(code, language, dimensions, {
      targetLanguage,
      inputData,
    })
    if (dimensions.length > 0) {
      setActiveTab(dimensions[0])
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

  const handleLanguageChange = (value: string) => {
    setLanguage(value)
    resetResults()
  }

  const handleDimensionsChange = (value: Dimension[]) => {
    setDimensions(value)
    if (value.length > 0 && !value.includes(activeTab as Dimension)) {
      setActiveTab(value[0])
    }
    resetResults()
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Card title="代码输入" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space>
            <Select
              value={language}
              onChange={handleLanguageChange}
              options={LANGUAGES}
              style={{ width: 150 }}
              placeholder="选择语言"
            />
            <Select
              mode="multiple"
              value={dimensions}
              onChange={handleDimensionsChange}
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

          {dimensions.includes('execution_trace') && (
            <div>
              <label style={{ marginRight: 8 }}>输入数据：</label>
              <textarea
                value={inputData}
                onChange={(e) => setInputData(e.target.value)}
                placeholder="输入执行推演所需的输入数据"
                style={{
                  width: '100%',
                  minHeight: 60,
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid #d9d9d9',
                }}
              />
            </div>
          )}

          <Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleAnalyze}
              loading={loading}
              size="large"
              disabled={loading}
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
                  <div className="markdown-body" style={{ padding: 16 }}>
                    <ReactMarkdown
                      rehypePlugins={[rehypeHighlight, rehypeSanitize]}
                    >
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
