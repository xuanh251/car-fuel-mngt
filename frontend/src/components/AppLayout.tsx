import React from 'react';
import { Button, Grid, Layout, Menu, Typography, theme } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Car pages (add, edit, refuelings) all belong to the Cars tab.
  const selectedKey = location.pathname.startsWith('/report') ? '/report' : '/cars';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header
        style={{
          height: 'auto',
          lineHeight: 'normal',
          padding: '0 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Menu
          mode="horizontal"
          selectedKeys={[selectedKey]}
          style={{ flex: 1, minWidth: 0, borderBottom: 'none' }}
          items={[
            { key: '/cars', label: <Link to="/cars">Cars</Link> },
            { key: '/report', label: <Link to="/report">Report</Link> },
          ]}
        />
        {screens.md && user && <Typography.Text type="secondary">{user.email}</Typography.Text>}
        <Button onClick={handleLogout}>Log out</Button>
      </Layout.Header>
      <Layout.Content style={{ padding: 16 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </div>
      </Layout.Content>
    </Layout>
  );
};
