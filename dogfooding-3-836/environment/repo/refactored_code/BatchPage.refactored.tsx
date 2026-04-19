/**
 * 批量评测页面 - 重构版本
 * 修复了：1. useEffect 竞态条件 2. 假进度条 3. any 类型 4. columns 类型
 */
import { useState, useEffect } from 'react'
import { Card, Button, Table, Progress, message, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlayCircleOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { getTestCases, runBatch, type TestCase, type BatchResponse } from '../services/api'
import { DIMENSION_LABELS } from '../utils/constants'
import { useAsync } from '../hooks/useAsync'

function BatchPage() {
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [batchResult, setBatchResult] = useState<BatchResponse | null>(null)

  const { execute: runBatchAsync, loading } = useAsync(runBatch)

  useEffect(() => {
    let mounted = true

    getTestCases()
      .then(({ data }) => {
        if (mounted) setTestCases(data)
      })
      .catch(() => {
        if (mounted) message.error('加载测试用例失败')
      })

    return () => { mounted = false }
  }, [])

  const handleRunBatch = async () => {
    setBatchResult(null)
    try {
      const { data } = await runBatchAsync()
      setBatchResult(data)
      message.success(`评测完成：${data.completed}/${data.total_cases} 通过`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误'
      message.error(`评测失败: ${errorMsg}`)
    }
  }

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

  const columns: ColumnsType<TestCase> = [
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
        {loading && <Progress indeterminate style={{ marginTop: 16 }} />}
      </Card>

      {batchResult && (
        <Card title="评分结果" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: 1 }}>
              <ReactECharts option={getRadarOption()} style={{ height: 400 }} />
            </div>
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
