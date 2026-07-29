import type { ThemeConfig } from 'antd';

/**
 * 專業商務風主題（取代舊系統的早期 Claude 紫）。
 * 沉穩藍為主色、克制的圓角與間距，適合資料密集的企業後台。
 */
export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1a56db',
    colorInfo: '#1a56db',
    colorSuccess: '#0e9f6e',
    colorWarning: '#e3a008',
    colorError: '#e02424',
    borderRadius: 6,
    fontSize: 14,
    colorBgLayout: '#f5f7fa',
    fontFamily:
      "-apple-system, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 56,
      siderBg: '#0f172a',
      bodyBg: '#f5f7fa',
    },
    Menu: {
      darkItemBg: '#0f172a',
      darkSubMenuItemBg: '#0f172a',
    },
    Table: {
      headerBg: '#f1f5f9',
      headerColor: '#334155',
      cellPaddingBlock: 10,
    },
  },
};

/** 等級對應顏色（A~E） */
export const gradeColor: Record<string, string> = {
  A: '#0e9f6e',
  B: '#1a56db',
  C: '#e3a008',
  D: '#ff8a4c',
  E: '#e02424',
};
