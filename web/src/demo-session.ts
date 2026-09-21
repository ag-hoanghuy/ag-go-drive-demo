const DEMO_SESSION_STORAGE_KEY = 'ag-go-drive-demo-session-id';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getDemoSessionId(): string {
  const currentSessionId = window.localStorage.getItem(
    DEMO_SESSION_STORAGE_KEY,
  );

  if (currentSessionId && UUID_PATTERN.test(currentSessionId)) {
    return currentSessionId;
  }

  const sessionId = window.crypto.randomUUID();
  window.localStorage.setItem(DEMO_SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

