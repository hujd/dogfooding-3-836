/**
 * 批量评测页面
 * 一键运行所有测试用例，展示评分雷达图
 */
import { useState, useEffect } from 'react'
import { Card, Button, Table, Progress, message, Space, Tag } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { getTestCases, runBatch, type TestCase, type BatchResponse } from '../services/api'
import { DIMENSION_LABELS } from '../utils/constants'

function BatchPage() {
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [loading, setLoading] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchResponse | null>(null)

  // 加载测试用例列表
  useEffect(() => {
    getTestCases()
      .then(({ data }) => setTestCases(data))
      .catch(() => message.error('加载测试用例失败'))
  }, [])

  /** 运行批量评测 */
  const handleRunBatch = async () => {
    setLoading(true)
    setBatchResult(null)
    try {
      const { data } = await runBatch()
      setBatchResult(data)
      message.success(`评测完成：${data.completed}/${data.total_cases} 通过`)
    } catch (err: any) {
      message.error(`评测失败: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  /** 雷达图配置 */
  const getRadarOption = () => {
    if (!batchResult) return {}
    const dims = Object.keys(batchResult.dimension_scores)
    return {
      radar: {
        indicator: dims.map((d) => ({
          name: DIMENSION_LABELS[d] || d,
          max: 5,
        })),
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: dims.map((d) => batchResult.dimension_scores[d]),
              name: batchResult.model_used,
              areaStyle: { opacity: 0.3 },
            },
          ],
        },
      ],
    }
  }

  // 测试用例表格列
  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 120 },
    {
      title: '维度',
      dataIndex: 'dimension',
      key: 'dimension',
      render: (d: string) => <Tag color="blue">{DIMENSION_LABELS[d] || d}</Tag>,
    },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '语言', dataIndex: 'language', key: 'language', width: 100 },
  ]

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* 操作区 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleRunBatch}
            loading={loading}
            size="large"
          >
            一键批量评测
          </Button>
          {batchResult && (
            <span style={{ fontSize: 16 }}>
              综合评分：<strong>{batchResult.avg_score}</strong> / 5.0
            </span>
          )}
        </Space>
        {loading && <Progress percent={50} status="active" style={{ marginTop: 16 }} />}
      </Card>

      {/* 评分结果 */}
      {batchResult && (
        <Card title="评分结果" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            {/* 雷达图 */}
            <div style={{ flex: 1 }}>
              <ReactECharts option={getRadarOption()} style={{ height: 400 }} />
            </div>
            {/* 评分卡片 */}
            <div style={{ flex: 1 }}>
              <Card size="small" title="评测概览">
                <p>模型：{batchResult.model_used}</p>
                <p>总用例：{batchResult.total_cases}</p>
                <p>通过：{batchResult.completed}</p>
                <p>失败：{batchResult.failed}</p>
                <p>综合评分：{batchResult.avg_score} / 5.0</p>
              </Card>
            </div>
          </div>
        </Card>
      )}

      {/* 测试用例列表 */}
      <Card title={`内置测试用例（${testCases.length} 个）`}>
        <Table
          dataSource={testCases}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  )
}

export default BatchPage
