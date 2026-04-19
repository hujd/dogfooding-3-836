interface PageContainerProps {
  title?: string
  children: React.ReactNode
  style?: React.CSSProperties
}

export const PageContainer: React.FC<PageContainerProps> = ({
  title,
  children,
  style
}) => (
  <div style={{ maxWidth: 1200, margin: '0 auto', ...style }}>
    {title ? <Card title={title}>{children}</Card> : children}
  </div>
)
