import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';

/** Renders with a fresh query client (no retries) and an in-memory router. */
export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** A fetch stub that answers each call with the next queued JSON response. */
export function mockFetch(...responses: { status?: number; body: unknown }[]) {
  const queue = [...responses];
  return vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    const next = queue.shift() ?? {
      status: 500,
      body: { message: 'unexpected call' },
    };
    return Promise.resolve(
      new Response(JSON.stringify(next.body), {
        status: next.status ?? 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
}
