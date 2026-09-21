import { useEffect, useState } from 'react';
import {
  Alert,
  Card,
  Col,
  Flex,
  Layout,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { apiClient } from './api/client';
import { DriveImportCard } from './DriveImportCard';
import { GoogleDriveCard } from './GoogleDriveCard';

type BackendStatus = 'checking' | 'connected' | 'disconnected';
type StorageState = 'checking' | 'configured' | 'unconfigured' | 'error';

interface StorageStatusResponse {
  configured: boolean;
  bucket: string | null;
}

const backendStatusLabel: Record<BackendStatus, string> = {
  checking: 'Checking',
  connected: 'Connected',
  disconnected: 'Disconnected',
};

function App() {
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>('checking');
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);
  const [storageState, setStorageState] =
    useState<StorageState>('checking');
  const [storageBucket, setStorageBucket] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const checkBackend = async (): Promise<void> => {
      try {
        await apiClient.get<{ status: 'ok' }>('/health', {
          signal: controller.signal,
        });
        setBackendStatus('connected');
      } catch {
        if (!controller.signal.aborted) {
          setBackendStatus('disconnected');
        }
      }
    };

    void checkBackend();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadStorageStatus = async (): Promise<void> => {
      setStorageState('checking');

      try {
        const response = await apiClient.get<StorageStatusResponse>(
          '/storage/status',
          { signal: controller.signal },
        );
        setStorageBucket(response.data.bucket);
        setStorageState(
          response.data.configured ? 'configured' : 'unconfigured',
        );
      } catch {
        if (!controller.signal.aborted) {
          setStorageBucket(null);
          setStorageState('error');
        }
      }
    };

    void loadStorageStatus();
    return () => controller.abort();
  }, []);

  return (
    <Layout className="app-shell">
      <main className="content">
        <Flex className="page-heading" justify="space-between" align="center" wrap>
          <div>
            <Typography.Title level={1}>Google Drive Import Demo</Typography.Title>
            <Typography.Text type="secondary">
              Nhập file và folder từ Google Drive sang Cloudflare R2
            </Typography.Text>
          </div>
          <Tag
            color={
              backendStatus === 'connected'
                ? 'success'
                : backendStatus === 'disconnected'
                  ? 'error'
                  : 'processing'
            }
          >
            Backend: {backendStatusLabel[backendStatus]}
          </Tag>
        </Flex>

        <Row gutter={[20, 20]}>
          <Col xs={24} md={12}>
            <GoogleDriveCard
              apiClient={apiClient}
              onConnectionChange={setGoogleDriveConnected}
            />
          </Col>

          <Col xs={24} md={12}>
            <DriveImportCard
              apiClient={apiClient}
              driveConnected={googleDriveConnected}
              storageConfigured={storageState === 'configured'}
            />
          </Col>

          <Col xs={24}>
            <Card title="Storage">
              {storageState === 'checking' && (
                <Space>
                  <Spin size="small" />
                  <Typography.Text>Đang kiểm tra Cloudflare R2...</Typography.Text>
                </Space>
              )}
              {storageState === 'configured' && (
                <Space direction="vertical">
                  <Tag color="success">Cloudflare R2: Connected</Tag>
                  {storageBucket && (
                    <Typography.Text type="secondary">
                      Bucket: {storageBucket}
                    </Typography.Text>
                  )}
                </Space>
              )}
              {storageState === 'unconfigured' && (
                <Typography.Text>Cloudflare R2 chưa cấu hình</Typography.Text>
              )}
              {storageState === 'error' && (
                <Alert
                  type="error"
                  showIcon
                  message="Không thể kiểm tra Cloudflare R2"
                />
              )}
            </Card>
          </Col>
        </Row>
      </main>
    </Layout>
  );
}

export default App;
