import { screen } from '@testing-library/react';
import type { ChatSource } from '../../api/chat';
import { renderWithProviders } from '../../test/render';
import { Answer } from './Answer';

const source: ChatSource = {
  number: 1,
  chunkId: 'c1',
  meetingId: 'm1',
  meetingTitle: 'Launch review',
  occurredAt: '2026-11-17T00:00:00.000Z',
  speakers: ['Dana Wu'],
  startSeconds: 76,
  endSeconds: 163,
  startUtterance: 10,
  endUtterance: 14,
  content: '[00:01:16] Dana Wu: Now the date.',
};

describe('Answer', () => {
  it('renders citations as links to the exact transcript lines', () => {
    renderWithProviders(
      <Answer
        text="Moved to December 15th [1]."
        sources={[source]}
        streaming={false}
      />,
    );

    const chip = screen.getByRole('link', {
      name: 'Source 1: Launch review, 1:16',
    });
    expect(chip).toHaveAttribute('href', '/meetings/m1?from=10&to=14');
    expect(screen.getByText(/Moved to December 15th/)).toBeInTheDocument();
  });

  it('shows a citation without a matching source as unverified, not as a link', () => {
    renderWithProviders(
      <Answer text="Invented [7]." sources={[source]} streaming={false} />,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(
      screen.getByTitle("This citation doesn't match any source"),
    ).toHaveTextContent('7');
  });

  it('renders bullet lists', () => {
    renderWithProviders(
      <Answer
        text={'Decisions:\n- Launch Dec 15 [1]\n- No paid tier'}
        sources={[source]}
        streaming={false}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('never renders model output as HTML', () => {
    const { container } = renderWithProviders(
      <Answer
        text={'<img src=x onerror="alert(1)"> hello'}
        sources={[]}
        streaming={false}
      />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });
});
