import React, { useState } from 'react';
import { Button, Drawer, Grid, Layout, Menu, Typography, theme } from 'antd';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const SIDEBAR_WIDTH = 248;

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const { token } = theme.useToken();
  const [menuOpen, setMenuOpen] = useState(false);
  const isDesktop = !!screens.md;

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  // Car pages (add, edit, refuelings) all belong to the Cars tab.
  const selectedKey = location.pathname.startsWith('/report') ? '/report' : '/cars';

  // Shared by the fixed desktop sidebar and the mobile drawer.
  const sidebarContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '0 8px 34px' }}>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 37,
            height: 37,
            borderRadius: token.borderRadiusLG,
            background: token.colorPrimary,
            color: token.colorTextLightSolid,
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            fontSize: 19,
          }}
        >
          F
        </div>
        <div>
          <strong
            style={{ display: 'block', fontSize: 18, lineHeight: 1.1, letterSpacing: -0.5, color: token.colorText }}
          >
            Car Fuel
          </strong>
          <span
            style={{
              display: 'block',
              marginTop: 4,
              color: token.colorTextSecondary,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.3,
            }}
          >
            MANAGEMENT
          </span>
        </div>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        onClick={() => setMenuOpen(false)}
        style={{ borderInlineEnd: 'none' }}
        items={[
          { key: '/cars', label: <Link to="/cars">Cars</Link> },
          { key: '/report', label: <Link to="/report">Report</Link> },
        ]}
      />
      <div
        style={{
          marginTop: 'auto',
          paddingTop: 17,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          display: 'grid',
          gap: 12,
        }}
      >
        {user && (
          <Typography.Text
            type="secondary"
            title={user.email}
            style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {user.email}
          </Typography.Text>
        )}
        <Button block onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh', marginInlineStart: isDesktop ? SIDEBAR_WIDTH : 0 }}>
      {isDesktop ? (
        <aside
          style={{
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            width: SIDEBAR_WIDTH,
            zIndex: 3,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            padding: '26px 18px 20px',
            background: token.colorBgContainer,
            borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {sidebarContent}
        </aside>
      ) : (
        <>
          <Layout.Header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              height: 56,
              lineHeight: 'normal',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: token.colorBgContainer,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Button aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
              Menu
            </Button>
            <Typography.Text strong>Car Fuel</Typography.Text>
          </Layout.Header>
          <Drawer
            placement="left"
            width={SIDEBAR_WIDTH}
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            styles={{ body: { display: 'flex', flexDirection: 'column', padding: 18 } }}
          >
            {sidebarContent}
          </Drawer>
        </>
      )}
      <Layout.Content style={{ padding: 16, minWidth: 0 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </div>
      </Layout.Content>
    </Layout>
  );
};
