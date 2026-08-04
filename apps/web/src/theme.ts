import type { ThemeConfig } from 'antd';

/**
 * 专业企业级设计系统（取代默认 antd 扁平外观）。
 * 沉稳蓝主色、柔和中性色、克制圆角与阴影，适合数据密集的商务后台。
 */
export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#2563eb',
    colorInfo: '#2563eb',
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    colorTextBase: '#0f172a',
    colorText: '#1e293b',
    colorTextSecondary: '#64748b',
    colorBorder: '#e5e9f0',
    colorBorderSecondary: '#eef1f6',
    colorBgLayout: '#f4f6fb',
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    fontSize: 14,
    controlHeight: 36,
    lineWidth: 1,
    wireframe: false,
    fontFamily:
      "-apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 60,
      headerPadding: '0 24px',
      siderBg: '#0f1729',
      bodyBg: '#f4f6fb',
    },
    Menu: {
      darkItemBg: '#0f1729',
      darkSubMenuItemBg: '#0a0f1e',
      darkItemSelectedBg: '#2563eb',
      darkItemHoverBg: 'rgba(255,255,255,0.06)',
      darkItemColor: 'rgba(255,255,255,0.72)',
      darkItemSelectedColor: '#ffffff',
      itemBorderRadius: 8,
      itemMarginInline: 10,
      itemHeight: 42,
    },
    Card: {
      borderRadiusLG: 12,
      paddingLG: 20,
      colorBorderSecondary: '#eef1f6',
    },
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#475569',
      headerSplitColor: 'transparent',
      rowHoverBg: '#f6f9ff',
      cellPaddingBlock: 12,
      borderColor: '#eef1f6',
      headerBorderRadius: 0,
    },
    Button: {
      controlHeight: 36,
      fontWeight: 500,
      primaryShadow: '0 2px 6px rgba(37,99,235,0.25)',
      defaultShadow: 'none',
    },
    Tabs: {
      inkBarColor: '#2563eb',
      itemSelectedColor: '#2563eb',
      itemHoverColor: '#2563eb',
      titleFontSize: 15,
    },
    Statistic: {
      contentFontSize: 28,
    },
    Select: { controlHeight: 36, borderRadius: 8 },
    Input: { controlHeight: 36, borderRadius: 8 },
    Modal: { borderRadiusLG: 14 },
    Alert: { borderRadiusLG: 10 },
    Segmented: { borderRadius: 8, itemSelectedBg: '#ffffff' },
  },
};

/** 等级对应颜色（A~E） */
export const gradeColor: Record<string, string> = {
  A: '#16a34a',
  B: '#2563eb',
  C: '#d97706',
  D: '#ea580c',
  E: '#dc2626',
};
