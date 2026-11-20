import { screen } from '@testing-library/react';
import type { SearchHit } from '../../api/types';
import { renderWithProviders } from '../../test/render';
import { SearchHitCard } from './SearchHitCard';

const hit: SearchHit = {
  chunkId: 'c1',
  meetingId: 'm1',
  meetingTitle: 'Engineering sync',
  occurredAt: '2026-11-10T00:00:00.000Z',
  sequence: 1,
  content:
    '[00:01:46] Marcus Chen: The payments SDK stops working on December 1st.\n' +
    '[00:02:01] Jin Park: The upgrade touches checkout.',
  speakers: ['Marcus Chen', 'Jin Park'],
  startSeconds: 106,
  endSeconds: 131,
  startUtterance: 9,
  endUtterance: 10,
  score: 0.03,
  ranks: { semantic: 2, keyword: 1 },
};

describe('SearchHitCard', () => {
  it('links to the exact transcript lines', () => {
    renderWithProviders(<SearchHitCard hit={hit} query="sdk" />);

    expect(
      screen.getByRole('link', { name: /Open in transcript/ }),
    ).toHaveAttribute('href', '/meetings/m1?from=9&to=10');
  });

  it('shows each speaker turn and the time range', () => {
    renderWithProviders(<SearchHitCard hit={hit} query="sdk" />);

    expect(screen.getByText('Marcus Chen:')).toBeInTheDocument();
    expect(screen.getByText('Jin Park:')).toBeInTheDocument();
    expect(screen.getByText(/1:46–2:11/)).toBeInTheDocument();
  });

  it('shows which retrievers found the chunk', () => {
    renderWithProviders(<SearchHitCard hit={hit} query="sdk" />);

    expect(screen.getByText('semantic #2')).toBeInTheDocument();
    expect(screen.getByText('keyword #1')).toBeInTheDocument();
  });

  it('highlights the query terms', () => {
    const { container } = renderWithProviders(
      <SearchHitCard hit={hit} query="payments sdk" />,
    );

    expect(
      [...container.querySelectorAll('mark')].map((m) => m.textContent),
    ).toEqual(['payments', 'SDK']);
  });
});
