import { useEffect, useMemo, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Flex,
  Layout,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { apiClient, createAuthenticatedApiClient } from './api/client';
import { DriveImportCard } from './DriveImportCard';
import { GoogleDriveCard } from './GoogleDriveCard';

type BackendStatus = 'checking' | 'connected' | 'disconnected';
type BackendAuthStatus = 'idle' | 'checking' | 'connected' | 'error';
type StorageState = 'idle' | 'checking' | 'configured' | 'unconfigured' | 'error';

interface AuthProfile {
  sub: string;
  email: string | null;
  name: string | null;
}

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
  const {
    error: auth0Error,
    getAccessTokenSilently,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    user,
  } = useAuth0();
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>('checking');
  const [backendAuthStatus, setBackendAuthStatus] =
    useState<BackendAuthStatus>('idle');
  const [backendProfile, setBackendProfile] = useState<AuthProfile | null>(null);
  const [googleDriveConnected, setGoogleDriveConnected] = useState(false);
  const [storageState, setStorageState] = useState<StorageState>('idle');
  const [storageBucket, setStorageBucket] = useState<string | null>(null);
  const authenticatedApiClient = useMemo(
    () =>
      createAuthenticatedApiClient(() => getAccessTokenSilently()),
    [getAccessTokenSilently],
  );

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

    if (!isAuthenticated) {
      setBackendAuthStatus('idle');
      setBackendProfile(null);
      return () => controller.abort();
    }

    const loadBackendProfile = async (): Promise<void> => {
      setBackendAuthStatus('checking');

      try {
        const response = await authenticatedApiClient.get<AuthProfile>(
          '/auth/me',
          { signal: controller.signal },
        );
        setBackendProfile(response.data);
        setBackendAuthStatus('connected');
      } catch {
        if (!controller.signal.aborted) {
          setBackendProfile(null);
          setBackendAuthStatus('error');
        }
      }
    };

    void loadBackendProfile();
    return () => controller.abort();
  }, [authenticatedApiClient, isAuthenticated]);

  useEffect(() => {
    const controller = new AbortController();

    if (!isAuthenticated) {
      setStorageState('idle');
      setStorageBucket(null);
      return () => controller.abort();
    }

    const loadStorageStatus = async (): Promise<void> => {
      setStorageState('checking');

      try {
        const response = await authenticatedApiClient.get<StorageStatusResponse>(
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
  }, [authenticatedApiClient, isAuthenticated]);

  const renderAuthentication = () => {
    if (isLoading) {
      return (
        <Space>
          <Spin size="small" />
          <Typography.Text>Đang tải thông tin đăng nhập...</Typography.Text>
        </Space>
      );
    }

    if (!isAuthenticated) {
      return (
        <Space direction="vertical" size="middle">
          <Typography.Text>Chưa đăng nhập</Typography.Text>
          <Button type="primary" onClick={() => void loginWithRedirect()}>
            Đăng nhập Auth0
          </Button>
        </Space>
      );
    }

    return (
      <Space direction="vertical" size="middle" className="full-width">
        <Descriptions column={1} size="small">
          {user?.name && (
            <Descriptions.Item label="Tên">{user.name}</Descriptions.Item>
          )}
          {user?.email && (
            <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
          )}
          <Descriptions.Item label="Sub">{user?.sub ?? '-'}</Descriptions.Item>
        </Descriptions>
        <Button
          onClick={() =>
            logout({ logoutParams: { returnTo: window.location.origin } })
          }
        >
          Đăng xuất
        </Button>
      </Space>
    );
  };

  return (
    <Layout className="app-shell">
      <main className="content">
        <Flex className="page-heading" justify="space-between" align="center" wrap>
          <div>
            <Typography.Title level={1}>Google Drive Import Demo</Typography.Title>
            <Typography.Text type="secondary">
              Nền tảng nhập dữ liệu từ Google Drive sang Cloudflare R2
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

        {auth0Error && (
          <Alert
            className="page-alert"
            type="error"
            showIcon
            message="Đăng nhập Auth0 thất bại"
            description={auth0Error.message}
          />
        )}

        <Row gutter={[20, 20]}>
          <Col xs={24} md={12}>
            <Card title="Authentication">{renderAuthentication()}</Card>
          </Col>

          <Col xs={24} md={12}>
            <Card title="Backend Authentication">
              {!isAuthenticated && (
                <Typography.Text type="secondary">
                  Đăng nhập để kiểm tra access token.
                </Typography.Text>
              )}
              {backendAuthStatus === 'checking' && (
                <Space>
                  <Spin size="small" />
                  <Typography.Text>Backend Auth: Checking</Typography.Text>
                </Space>
              )}
              {backendAuthStatus === 'error' && (
                <Alert
                  type="error"
                  showIcon
                  message="Backend Auth: Disconnected"
                  description="Access token bị thiếu, không hợp lệ hoặc backend chưa được cấu hình đúng."
                />
              )}
              {backendAuthStatus === 'connected' && backendProfile && (
                <Space direction="vertical" size="middle" className="full-width">
                  <Tag color="success">Backend Auth: Connected</Tag>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Tên">
                      {backendProfile.name ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      {backendProfile.email ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Sub">
                      {backendProfile.sub}
                    </Descriptions.Item>
                  </Descriptions>
                </Space>
              )}
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <GoogleDriveCard
              apiClient={authenticatedApiClient}
              isAuthenticated={isAuthenticated}
              onConnectionChange={setGoogleDriveConnected}
            />
          </Col>

          <Col xs={24} md={12}>
            <DriveImportCard
              apiClient={authenticatedApiClient}
              isAuthenticated={isAuthenticated}
              driveConnected={googleDriveConnected}
              storageConfigured={storageState === 'configured'}
            />
          </Col>

          <Col xs={24}>
            <Card title="Storage">
              {!isAuthenticated && (
                <Typography.Text type="secondary">
                  Đăng nhập để kiểm tra Cloudflare R2.
                </Typography.Text>
              )}
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
