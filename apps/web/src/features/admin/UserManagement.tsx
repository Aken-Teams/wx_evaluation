import { KeyOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { usersApi } from '../../api';
import { apiErrorMessage } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { ROLE_OPTIONS, type UserRow } from '../../types';

const roleLabel = (r: string) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;

export function UserManagement() {
  const { message, modal } = AntApp.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);

  const listQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const createMut = useMutation({
    mutationFn: (v: { username: string; password: string; role: string }) => usersApi.create(v),
    onSuccess: () => {
      message.success('已新增账号');
      setOpen(false);
      invalidate();
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { role?: string; enabled?: boolean } }) =>
      usersApi.update(id, data),
    onSuccess: () => invalidate(),
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const resetMut = useMutation({
    mutationFn: (id: number) => usersApi.resetPassword(id),
    onSuccess: (r) =>
      modal.success({
        title: '密码已重置',
        content: (
          <div>
            临时密码（请复制交给使用者，并要求尽快修改）：
            <Typography.Paragraph copyable strong style={{ fontSize: 16, marginTop: 8 }}>
              {r.tempPassword}
            </Typography.Paragraph>
          </div>
        ),
      }),
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  const columns: ColumnsType<UserRow> = [
    { title: '账号', dataIndex: 'username', width: 180 },
    {
      title: '角色',
      dataIndex: 'role',
      width: 200,
      render: (role: string, u) => (
        <Select
          size="small"
          value={role}
          options={ROLE_OPTIONS}
          style={{ width: 160 }}
          onChange={(v) => updateMut.mutate({ id: u.id, data: { role: v } })}
        />
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      align: 'center',
      render: (enabled: boolean, u) => (
        <Switch
          checked={enabled}
          size="small"
          onChange={(v) => updateMut.mutate({ id: u.id, data: { enabled: v } })}
        />
      ),
    },
    {
      title: '建立时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 140,
      render: (_, u) => (
        <Popconfirm title={`重置 ${u.username} 的密码？`} onConfirm={() => resetMut.mutate(u.id)} okText="重置" cancelText="取消">
          <Button size="small" icon={<KeyOutlined />}>
            重置密码
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeader
        icon={<TeamOutlined />}
        title="帐号管理"
        subtitle={`共 ${listQuery.data?.length ?? 0} 个帐号 · 可切换角色 / 启用 / 重置密码`}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setOpen(true);
            }}
          >
            新增帐号
          </Button>
        }
      />

      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<UserRow>
          rowKey="id"
          columns={columns}
          dataSource={listQuery.data ?? []}
          loading={listQuery.isLoading}
          size="small"
          pagination={false}
        />
      </Card>

      <Modal
        open={open}
        title="新增帐号"
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMut.isPending}
        okText="建立"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMut.mutate(v)} style={{ marginTop: 12 }}>
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 6, message: '至少 6 码' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={ROLE_OPTIONS} placeholder="选择角色" />
          </Form.Item>
          <Tag color="blue">提示：建立后可在列表切换角色 / 启用状态</Tag>
        </Form>
      </Modal>
    </Space>
  );
}
