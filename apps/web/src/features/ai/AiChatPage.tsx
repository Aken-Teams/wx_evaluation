import { RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Avatar, Button, Card, Empty, Input, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { aiApi, type ChatMsg } from '../../api';

const SUGGESTIONS = ['本季评分最高的供应商是哪几家？', '有哪些需要关注的风险供应商？', '整体供应商表现如何？'];

export function AiChatPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const statusQuery = useQuery({ queryKey: ['ai-status'], queryFn: aiApi.status });

  const send = useMutation({
    mutationFn: (msgs: ChatMsg[]) => aiApi.chat(msgs),
    onSuccess: (res) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    },
    onError: () => {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'AI 请求失败，请稍后再试。' }]);
    },
  });

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, send.isPending]);

  const doSend = (text: string) => {
    const t = text.trim();
    if (!t || send.isPending) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content: t }];
    setMessages(next);
    setInput('');
    send.mutate(next);
  };

  return (
    <Card
      variant="borderless"
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' } }}
      title={
        <Space>
          <RobotOutlined style={{ color: '#1a56db' }} />
          AI 问答助手
          {statusQuery.data && (
            <Tag color={statusQuery.data.configured ? 'success' : 'default'}>
              {statusQuery.data.configured ? '已连接' : '未配置'}
            </Tag>
          )}
        </Space>
      }
    >
      {statusQuery.data && !statusQuery.data.configured && (
        <Alert
          type="warning"
          showIcon
          style={{ margin: 16 }}
          message="AI 服务尚未配置"
          description="请在后端 apps/api/.env 设定 OLLAMA_API_URL / OLLAMA_API_KEY / OLLAMA_MODEL 后重启。未配置时仍可发送，助手会提示如何设定。"
        />
      )}

      {/* 讯息列表 */}
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {messages.length === 0 ? (
          <div style={{ marginTop: 60 }}>
            <Empty
              image={<RobotOutlined style={{ fontSize: 48, color: '#c3ccd9' }} />}
              description="向助手提问关于供应商评分、排名、风险的问题"
            />
            <Space wrap style={{ justifyContent: 'center', width: '100%', marginTop: 16 }}>
              {SUGGESTIONS.map((s) => (
                <Button key={s} size="small" onClick={() => doSend(s)}>
                  {s}
                </Button>
              ))}
            </Space>
          </div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                <Avatar
                  size="small"
                  icon={m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                  style={{ backgroundColor: m.role === 'user' ? '#1a56db' : '#0e9f6e', flexShrink: 0 }}
                />
                <div
                  style={{
                    maxWidth: '72%',
                    padding: '8px 12px',
                    borderRadius: 10,
                    whiteSpace: 'pre-wrap',
                    background: m.role === 'user' ? '#1a56db' : '#f1f5f9',
                    color: m.role === 'user' ? '#fff' : '#1e293b',
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {send.isPending && (
              <div style={{ display: 'flex', gap: 10 }}>
                <Avatar size="small" icon={<RobotOutlined />} style={{ backgroundColor: '#0e9f6e' }} />
                <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: 10 }}>
                  <Spin size="small" /> <Typography.Text type="secondary">思考中…</Typography.Text>
                </div>
              </div>
            )}
          </Space>
        )}
      </div>

      {/* 输入 */}
      <div style={{ borderTop: '1px solid #eef0f3', padding: 12 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={input}
            placeholder="输入问题，Enter 送出…"
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => doSend(input)}
            disabled={send.isPending}
          />
          <Button type="primary" icon={<SendOutlined />} onClick={() => doSend(input)} loading={send.isPending}>
            发送
          </Button>
        </Space.Compact>
      </div>
    </Card>
  );
}
