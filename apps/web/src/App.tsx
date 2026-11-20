import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { ApiError } from './api/client';
import { AppShell } from './components/AppShell';
import { AskPage } from './features/chat/AskPage';
import { HomePage } from './features/meetings/HomePage';
import { MeetingPage } from './features/meetings/MeetingPage';
import { SearchPage } from './features/search/SearchPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry network hiccups and 5xx once; a 4xx won't change on retry.
      retry: (failureCount, error) =>
        failureCount < 1 && !(error instanceof ApiError && error.status < 500),
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'meetings/:id', element: <MeetingPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'ask', element: <AskPage /> },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
