import { useState } from 'react';
import { Button, Table, Tag, Modal, Form, Input, Select, Empty, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useDocuments, useCreateDocument } from '../../../hooks/useProjects';
import type { CreateDocumentInput } from '../../../types';

export default function DocumentsTab({ projectId }: { projectId: string }) {
  const { data: docs = [], isLoading: loading } = useDocuments(projectId);
  const createDoc = useCreateDocument(projectId);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = async (values: CreateDocumentInput) => {
    await createDoc.mutateAsync(values);
    message.success('文档创建成功');
    setModalOpen(false);
    form.resetFields();
  };

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalOpen(true)}>新建文档</Button>
      </div>
      {docs.length === 0 && !loading ? (
        <Empty description="暂无文档" />
      ) : (
        <Table
          dataSource={docs}
          rowKey="id"
          loading={loading}
          pagination={false}
          columns={[
            { title: '标题', dataIndex: 'title' },
            { title: '类型', dataIndex: 'type', render: (v: string) => <Tag>{v}</Tag> },
            { title: '更新时间', dataIndex: 'updatedAt', render: (v: string) => new Date(v).toLocaleString('zh-CN') },
          ]}
        />
      )}

      <Modal title="新建文档" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="创建">
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="Doc">
            <Select options={['Doc', 'Note', 'Changelog', 'Decision'].map(t => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea rows={6} placeholder="支持 Markdown" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
