import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import { Alert, Flex, Typography } from 'antd';
import 'antd/dist/reset.css';
import './styles.css';
import App from './App';

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
const root = createRoot(document.getElementById('root')!);

if (!domain || !clientId || !audience) {
  root.render(
    <StrictMode>
      <Flex className="configuration-error" vertical gap="middle">
        <Typography.Title level={2}>Google Drive Import Demo</Typography.Title>
        <Alert
          type="warning"
          showIcon
          message="Auth0 chưa được cấu hình"
          description="Hãy điền VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID và VITE_AUTH0_AUDIENCE trong web/.env."
        />
      </Flex>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <Auth0Provider
        domain={domain}
        clientId={clientId}
        authorizationParams={{
          audience,
          redirect_uri: window.location.origin,
        }}
      >
        <App />
      </Auth0Provider>
    </StrictMode>,
  );
}
