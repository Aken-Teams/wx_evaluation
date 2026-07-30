import { useMutation } from '@tanstack/react-query';
import { App as AntApp, Form, Input, Modal } from 'antd';
import { usersApi } from '../api';
import { apiErrorMessage } from '../lib/api';

/** 自助修改密码：需输入旧密码才能设定新密码。 */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<{ oldPassword: string; newPassword: string; confirm: string }>();

  const mut = useMutation({
    mutationFn: (v: { oldPassword: string; newPassword: string }) => usersApi.changePassword(v.oldPassword, v.newPassword),
    onSuccess: () => {
      message.success('密码已修改');
      onClose();
    },
    onError: (e) => message.error(apiErrorMessage(e)),
  });

  return (
    <Modal
      open={open}
      title="修改密码"
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={mut.isPending}
      okText="确定"
      cancelText="取消"
      destroyOnClose
      afterClose={() => form.resetFields()}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(v) => mut.mutate({ oldPassword: v.oldPassword, newPassword: v.newPassword })}
        style={{ marginTop: 12 }}
      >
        <Form.Item name="oldPassword" label="旧密码" rules={[{ required: true, message: '请输入旧密码' }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6, message: '至少 6 码' }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label="确认新密码"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请再次输入新密码' },
            ({ getFieldValue }) => ({
              validator: (_, v) => (!v || v === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('两次密码不一致'))),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
