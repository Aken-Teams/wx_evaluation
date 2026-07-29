import { Button, Result } from 'antd';
import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** 元件錯誤邊界：任一頁面崩潰時顯示友善提示，不再整頁白屏（舊系統痛點）。 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('UI 错误:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title="页面发生错误"
          subTitle={this.state.error.message}
          extra={
            <Button
              type="primary"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
            >
              重新载入
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
