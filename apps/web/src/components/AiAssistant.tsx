import { SendOutlined } from '@ant-design/icons';
import { Bot } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Avatar, Button, Drawer, Empty, FloatButton, Input, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { aiApi, type ChatMsg } from '../api';

/** 全站浮動 AI 助手：隨處可問，也可由 window 事件 'ai:ask' 帶問題開啟。 */
export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const statusQuery = useQuery({ queryKey: ['ai-status'], queryFn: aiApi.status });

  const send = useMutation({
    mutationFn: (msgs: ChatMsg[]) => aiApi.chat(msgs),
    onSuccess: (res) => setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]),
    onError: () => setMessages((prev) => [...prev, { role: 'assistant', content: 'AI 请求失败，请稍后再试。' }]),
  });

  const doSend = (text: string) => {
    const t = text.trim();
    if (!t || send.isPending) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content: t }];
    setMessages(next);
    setInput('');
    send.mutate(next);
  };

  // 由其他页面（如供应商档案）触发提问
  useEffect(() => {
    const handler = (e: Event) => {
      const q = (e as CustomEvent<string>).detail;
      setOpen(true);
      if (q) setTimeout(() => doSend(q), 100);
    };
    window.addEventListener('ai:ask', handler as EventListener);
    return () => window.removeEventListener('ai:ask', handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, send.isPending]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, send.isPending]);

  return (
    <>
      <FloatButton icon={<Bot size={20} />} type="primary" tooltip="AI 助手" onClick={() => setOpen(true)} />
      <Drawer
        title={
          <Space>
            <Bot size={18} color="#2563eb" style={{ verticalAlign: '-3px' }} /> AI 助手
            {statusQuery.data && <Tag color={statusQuery.data.configured ? 'success' : 'default'}>{statusQuery.data.configured ? '已连接' : '未配置'}</Tag>}
          </Space>
        }
        open={open}
        onClose={() => setOpen(false)}
        width={420}
        styles={{ body: { display: 'flex', flexDirection: 'column', padding: 0 } }}
      >
        {statusQuery.data && !statusQuery.data.configured && (
          <Alert type="warning" showIcon style={{ margin: 12 }} message="AI 未配置" description="设定 apps/api/.env 的 OLLAMA_* 后重启即可启用。" />
        )}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {messages.length === 0 ? (
            <Empty image={<Bot size={44} color="#c3ccd9" />} description="询问供应商评分、排名、风险" style={{ marginTop: 40 }} />
          ) : (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
                  <Avatar size="small" icon={<Bot size={14} />} style={{ backgroundColor: m.role === 'user' ? '#2563eb' : '#16a34a', flexShrink: 0 }} />
                  <div style={{ maxWidth: '78%', padding: '7px 11px', borderRadius: 10, whiteSpace: 'pre-wrap', background: m.role === 'user' ? '#1a56db' : '#f1f5f9', color: m.role === 'user' ? '#fff' : '#1e293b', fontSize: 13 }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {send.isPending && <Spin size="small" style={{ marginLeft: 8 }} />}
            </Space>
          )}
        </div>
        <div style={{ borderTop: '1px solid #eef0f3', padding: 10 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input value={input} placeholder="输入问题…" onChange={(e) => setInput(e.target.value)} onPressEnter={() => doSend(input)} disabled={send.isPending} />
            <Button type="primary" icon={<SendOutlined />} loading={send.isPending} onClick={() => doSend(input)} />
          </Space.Compact>
        </div>
      </Drawer>
    </>
  );
}

/** 供其他页面触发 AI 提问 */
export const askAi = (question: string) => window.dispatchEvent(new CustomEvent('ai:ask', { detail: question }));
