import { useEffect, useState } from 'react';

type ApiStatus = 'checking' | 'ok' | 'unreachable';

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then((res) => setApiStatus(res.ok ? 'ok' : 'unreachable'))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          console.error('Health check failed', err);
          setApiStatus('unreachable');
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="app">
      <h1>Meeting Intelligence</h1>
      <p>
        API status: <strong data-status={apiStatus}>{apiStatus}</strong>
      </p>
    </main>
  );
}

export default App;
