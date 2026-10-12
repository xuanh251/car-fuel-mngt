import type { ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: '#147d67',
    colorPrimaryHover: '#0d6653',
    colorText: '#192327',
    colorTextSecondary: '#77848a',
    colorBgLayout: '#f5f7f8',
    colorBgContainer: '#ffffff',
    colorBorder: '#e6ebed',
    colorBorderSecondary: '#e6ebed',
    colorSplit: '#e6ebed',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 16,
    borderRadius: 10,
    controlHeight: 40,
  },
  components: {
    Typography: {
      titleMarginBottom: 16,
      titleMarginTop: 0,
    },
  },
};
