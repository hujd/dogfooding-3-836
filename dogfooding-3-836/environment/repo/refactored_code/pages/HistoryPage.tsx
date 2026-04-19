import { useEffect, useMemo } from 'react'
import { Card, Table, Button, Tag, Popconfirm, message, Empty } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { useAppStore } from '../../store'
import { DIMENSION_LABELS } from '../../utils/constants'
import type { HistoryItem } from '../types'
import dayjs from 'dayjs'

function HistoryPage() {
  const { history, clearHistory, loadHistory } = useAppStore()

  useEffect(() => {
    loadHistory()
  }, [])

  const columns = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 180,
        render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm:ss'),
      },
      {
        title: '维度',
        key: 'dimension',
        width: 150,
        render: (_: unknown, record: HistoryItem) => (
          <Tag color="blue">
            {DIMENSION_LABELS[record.task.dimension] || record.task.dimension}
          </Tag>
        ),
      },
      {
        title: '语言',
        key: 'language',
        width: 100,
        render: (_: unknown, record: HistoryItem) => record.task.language,
      },
      {
        title: '状态',
        key: 'status',
        width: 100,
        render: (_: unknown, record: HistoryItem) => (
          <Tag color={record.task.status === 'completed' ? 'green' : 'red'}>
            {record.task.status === 'completed' ? '成功' : '失败'}
          </Tag>
        ),
      },
      {
        title: '模型',
        key: 'model',
        render: (_: unknown, record: HistoryItem) => record.task.model_used,
      },
    ],
    []
  )

  const handleClearHistory = () => {
    clearHistory()
    message.success('历史已清空')
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Card
        title={`分析历史（${history.length} 条）`}
        extra={
          history.length > 0 && (
            <Popconfirm
              title="确定清空所有历史记录？"
              onConfirm={handleClearHistory}
            >
              <Button danger icon={<DeleteOutlined />}>
                清空历史
              </Button>
            </Popconfirm>
          )
        }
      >
        {history.length === 0 ? (
          <Empty description="暂无历史记录" />
        ) : (
          <Table
            dataSource={history}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            size="small"
          />
        )}
      </Card>
    </div>
  )
}

export default HistoryPage
