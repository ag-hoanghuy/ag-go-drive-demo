import { useState } from 'react';
import type { AxiosInstance } from 'axios';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  List,
  Space,
  Typography,
} from 'antd';
import { DriveBrowserModal } from './DriveBrowserModal';
import type { DriveItem, GoogleDriveImportResult } from './drive.types';

interface DriveImportCardProps {
  apiClient: AxiosInstance;
  isAuthenticated: boolean;
  driveConnected: boolean;
  storageConfigured: boolean;
}

function formatFileSize(size: number | null): string {
  if (size === null) {
    return '-';
  }

  return new Intl.NumberFormat('vi-VN').format(size) + ' bytes';
}

export function DriveImportCard({
  apiClient,
  isAuthenticated,
  driveConnected,
  storageConfigured,
}: DriveImportCardProps) {
  const [browserOpen, setBrowserOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DriveItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<GoogleDriveImportResult | null>(null);
  const [requestError, setRequestError] = useState(false);

  const selectItem = (item: DriveItem): void => {
    setSelectedItem(item);
    setResult(null);
    setRequestError(false);
    setBrowserOpen(false);
  };

  const importItem = async (): Promise<void> => {
    if (!selectedItem) {
      return;
    }

    setImporting(true);
    setResult(null);
    setRequestError(false);

    try {
      const response = await apiClient.post<GoogleDriveImportResult>(
        '/import/google-drive',
        { itemId: selectedItem.id },
      );
      setResult(response.data);
    } catch {
      setRequestError(true);
    } finally {
      setImporting(false);
    }
  };

  const canBrowse = isAuthenticated && driveConnected;
  const canImport = canBrowse && storageConfigured && selectedItem !== null;

  return (
    <>
      <Card title="Import">
        <Space direction="vertical" size="middle" className="full-width">
          <Button disabled={!canBrowse} onClick={() => setBrowserOpen(true)}>
            Chọn từ Google Drive
          </Button>

          {!driveConnected && isAuthenticated && (
            <Typography.Text type="secondary">
              Hãy kết nối Google Drive trước khi chọn item.
            </Typography.Text>
          )}

          {selectedItem && (
            <Descriptions title="Đã chọn" column={1} size="small">
              <Descriptions.Item label="Tên">
                {selectedItem.name}
              </Descriptions.Item>
              <Descriptions.Item label="Loại">
                {selectedItem.isFolder ? 'Folder' : 'File'}
              </Descriptions.Item>
              {!selectedItem.isFolder && (
                <Descriptions.Item label="Dung lượng">
                  {formatFileSize(selectedItem.size)}
                </Descriptions.Item>
              )}
            </Descriptions>
          )}

          <Button
            type="primary"
            disabled={!canImport}
            loading={importing}
            onClick={() => void importItem()}
          >
            {importing ? 'Đang import...' : 'Import'}
          </Button>

          {!storageConfigured && isAuthenticated && (
            <Typography.Text type="secondary">
              Cloudflare R2 cần được cấu hình trước khi import.
            </Typography.Text>
          )}

          {requestError && (
            <Alert
              type="error"
              showIcon
              message="Import thất bại"
              description="Không thể hoàn tất yêu cầu import."
            />
          )}

          {result && (
            <Alert
              type={result.failed > 0 ? 'warning' : 'success'}
              showIcon
              message={
                result.totalFiles === 0 ? 'Folder không có file' : 'Import hoàn tất'
              }
              description={
                <Space direction="vertical" size="small">
                  <Typography.Text>Tổng file: {result.totalFiles}</Typography.Text>
                  <Typography.Text>Thành công: {result.uploaded}</Typography.Text>
                  <Typography.Text>Thất bại: {result.failed}</Typography.Text>
                  {result.errors.length > 0 && (
                    <List
                      size="small"
                      dataSource={result.errors}
                      renderItem={(error) => (
                        <List.Item>
                          <Typography.Text>
                            {error.name}: {error.reason}
                          </Typography.Text>
                        </List.Item>
                      )}
                    />
                  )}
                </Space>
              }
            />
          )}
        </Space>
      </Card>

      <DriveBrowserModal
        apiClient={apiClient}
        open={browserOpen}
        onCancel={() => setBrowserOpen(false)}
        onSelect={selectItem}
      />
    </>
  );
}

