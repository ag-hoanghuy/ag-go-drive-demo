import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AxiosInstance } from 'axios';
import {
  Alert,
  Breadcrumb,
  Button,
  List,
  Modal,
  Space,
  Spin,
  Typography,
} from 'antd';
import type { DriveItem } from './drive.types';

interface DriveBrowserModalProps {
  apiClient: AxiosInstance;
  open: boolean;
  onCancel: () => void;
  onSelect: (item: DriveItem) => void;
}

interface DrivePathEntry {
  id?: string;
  name: string;
}

const ROOT_PATH: DrivePathEntry = { name: 'My Drive' };

function formatFileSize(size: number | null): string | null {
  if (size === null) {
    return null;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function DriveBrowserModal({
  apiClient,
  open,
  onCancel,
  onSelect,
}: DriveBrowserModalProps) {
  const [path, setPath] = useState<DrivePathEntry[]>([ROOT_PATH]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<DriveItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(false);
  const currentFolderId = path.at(-1)?.id;

  const loadItems = useCallback(
    async (parentId: string | undefined, signal: AbortSignal): Promise<void> => {
      setLoading(true);
      setError(false);

      try {
        const response = await apiClient.get<DriveItem[]>('/google-drive/items', {
          params: parentId ? { parentId } : undefined,
          signal,
        });
        setItems(response.data);
      } catch {
        if (!signal.aborted) {
          setItems([]);
          setError(true);
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [apiClient],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    setSelectedItem(null);
    void loadItems(currentFolderId, controller.signal);
    return () => controller.abort();
  }, [currentFolderId, loadItems, open]);

  const breadcrumbItems = useMemo(
    () =>
      path.map((entry, index) => ({
        title:
          index === path.length - 1 ? (
            entry.name
          ) : (
            <Button
              className="breadcrumb-button"
              type="link"
              onClick={() => setPath((current) => current.slice(0, index + 1))}
            >
              {entry.name}
            </Button>
          ),
      })),
    [path],
  );

  const enterFolder = (item: DriveItem): void => {
    setPath((current) => [...current, { id: item.id, name: item.name }]);
  };

  const confirmSelection = async (): Promise<void> => {
    if (!selectedItem) {
      return;
    }

    setConfirming(true);
    setError(false);

    try {
      const response = await apiClient.get<DriveItem>(
        `/google-drive/items/${encodeURIComponent(selectedItem.id)}`,
      );
      onSelect(response.data);
    } catch {
      setError(true);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal
      title="Chọn từ Google Drive"
      open={open}
      width={760}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Hủy
        </Button>,
        <Button
          key="select"
          type="primary"
          disabled={!selectedItem}
          loading={confirming}
          onClick={() => void confirmSelection()}
        >
          Chọn item
        </Button>,
      ]}
    >
      <Space direction="vertical" size="middle" className="full-width">
        <Space wrap>
          <Button
            disabled={path.length === 1}
            onClick={() => setPath((current) => current.slice(0, -1))}
          >
            ← Quay lại
          </Button>
          <Breadcrumb items={breadcrumbItems} />
        </Space>

        {error && (
          <Alert
            type="error"
            showIcon
            message="Không thể tải nội dung Google Drive"
          />
        )}

        {loading ? (
          <div className="drive-browser-loading">
            <Spin />
          </div>
        ) : (
          <List
            className="drive-browser-list"
            bordered
            locale={{ emptyText: 'Folder trống' }}
            dataSource={items}
            renderItem={(item) => {
              const size = item.isFolder ? null : formatFileSize(item.size);
              const modifiedTime = item.modifiedTime
                ? new Date(item.modifiedTime).toLocaleString('vi-VN')
                : null;

              return (
                <List.Item
                  className={selectedItem?.id === item.id ? 'selected-item' : ''}
                  actions={[
                    <Button
                      key="select"
                      type={selectedItem?.id === item.id ? 'primary' : 'default'}
                      onClick={() => setSelectedItem(item)}
                    >
                      {selectedItem?.id === item.id ? 'Đã chọn' : 'Chọn'}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      item.iconLink ? (
                        <img className="drive-item-icon" src={item.iconLink} alt="" />
                      ) : (
                        <span className="drive-item-fallback-icon">
                          {item.isFolder ? '📁' : '📄'}
                        </span>
                      )
                    }
                    title={
                      item.isFolder ? (
                        <Button type="link" onClick={() => enterFolder(item)}>
                          {item.name}
                        </Button>
                      ) : (
                        <Typography.Text>{item.name}</Typography.Text>
                      )
                    }
                    description={[
                      item.isFolder ? 'Folder' : item.mimeType,
                      size,
                      modifiedTime,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Space>
    </Modal>
  );
}

