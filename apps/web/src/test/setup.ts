import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom doesn't implement scrolling.
Element.prototype.scrollIntoView = vi.fn();
