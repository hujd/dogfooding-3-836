import { Routes, Route } from 'react-router-dom'
import { ConfigProvider, Layout, Menu, Switch } from 'antd'
import { CodeOutlined, ExperimentOutlined, HistoryOutlined } from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import AnalyzePage from './pages/AnalyzePage'
import BatchPage from './pages/BatchPage'
import HistoryPage from './pages/HistoryPage'
import zhCN from 'antd/locale/zh_CN'

const { Header, Content } = Layout

/**
 * 应用根组件
 * 包含导航栏、路由和主题切换
 */
function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [darkMode, setDarkMode] = useState(false)

  // 导航菜单项
  const menuItems = [
    { key: '/', icon: <CodeOutlined />, label: '代码分析' },
    { key: '/batch', icon: <ExperimentOutlined />, label: '批量评测' },
    { key: '/history', icon: <HistoryOutlined />, label: '历史记录' },
  ]

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ minHeight: '100vh' }}>
        {/* 顶部导航 */}
        <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
          <h1 style={{ color: '#fff', marginRight: 32, fontSize: 18 }}>
            代码理解与分析
          </h1>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ flex: 1 }}
          />
          <Switch
            checkedChildren="🌙"
            unCheckedChildren="☀️"
            checked={darkMode}
            onChange={(checked) => {
              setDarkMode(checked)
              document.documentElement.setAttribute('data-theme', checked ? 'dark' : 'light')
            }}
          />
        </Header>

        {/* 主内容区 */}
        <Content style={{ padding: 24 }}>
          <Routes>
            <Route path="/" element={<AnalyzePage />} />
            <Route path="/batch" element={<BatchPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </Content>
      </Layout>
    </ConfigProvider>
  )
}

export default App
