import { useEffect, useMemo } from 'react'
import { Card, Table, Button, Progress, message, Space, Tag } from 'antd'
import { PlayCircleOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { getTestCases, runBatch } from '../../services/api'
import { useAppStore } from '../../store'
import { DIMENSION_LABELS } from '../../utils/constants'
import { handleApiError } from '../utils/errorHandler'
import type { TestCase, BatchResponse } from '../types'

function BatchPage() {
  const { testCases, setTestCases, batchResult, setBatchResult, loading, setLoading } = useAppStore()

  useEffect(() => {
    loadTestCases()
  }, [])

  const loadTestCases = async () => {
    try {
      const { data } = await getTestCases()
      setTestCases(data)
    } catch (err) {
      console.error('加载测试用例失败:', err)
      message.error(handleApiError(err, '加载测试用例失败'))
    }
  }

  const handleRunBatch = async () => {
    if (loading) return

    setLoading(true)
    setBatchResult(null)
    try {
      const { data } = await runBatch()
      setBatchResult(data)
      message.success(`评测完成：${data.completed}/${data.total_cases} 通过`)
    } catch (err) {
      console.error('评测失败:', err)
      message.error(handleApiError(err, '评测失败'))
    } finally {
      setLoading(false)
    }
  }

  const radarOption = useMemo(() => {
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
  }, [batchResult])

  const columns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', key: 'id', width: 120 },
      {
        title: '维度',
        dataIndex: 'dimension',
        key: 'dimension',
        render: (d: string) => <Tag color="blue">{DIMENSION_LABELS[d] || d}</Tag>,
      },
      { title: '标题', dataIndex: 'title', key: 'title' },
      { title: '语言', dataIndex: 'language', key: 'language', width: 100 },
    ],
    []
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleRunBatch}
            loading={loading}
            disabled={loading}
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

      {batchResult && (
        <Card title="评分结果" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: 1 }}>
              <ReactECharts option={radarOption} style={{ height: 400 }} />
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
