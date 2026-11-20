import { render, screen, within } from '@testing-library/react';
import type { Utterance } from '../../api/types';
import { Transcript } from './Transcript';

const utterances: Utterance[] = [
  { sequence: 0, speaker: 'Priya Shah', startSeconds: 4, text: 'Welcome.' },
  {
    sequence: 1,
    speaker: 'Priya Shah',
    startSeconds: 9,
    text: 'Agenda first.',
  },
  {
    sequence: 2,
    speaker: 'Marcus Chen',
    startSeconds: 20,
    text: 'Sounds good.',
  },
  { sequence: 3, speaker: 'Priya Shah', startSeconds: 75, text: 'Next topic.' },
];

const turns = () =>
  within(screen.getByRole('list', { name: 'Transcript' })).getAllByRole(
    'listitem',
  );

describe('Transcript', () => {
  it('renders every turn with its timestamp', () => {
    render(<Transcript utterances={utterances} />);

    expect(turns()).toHaveLength(4);
    expect(screen.getByText('Sounds good.')).toBeInTheDocument();
    expect(screen.getByText('1:15')).toBeInTheDocument();
  });

  it('shows the speaker name once for consecutive turns by the same person', () => {
    render(<Transcript utterances={utterances} />);

    // Priya speaks turns 0-1, then again at 3: her name appears twice, not three times.
    expect(screen.getAllByText('Priya Shah')).toHaveLength(2);
  });

  it('highlights the given range and scrolls to its first line', () => {
    render(
      <Transcript utterances={utterances} highlight={{ from: 1, to: 2 }} />,
    );

    const highlighted = turns().filter((li) => li.dataset.highlighted);
    expect(highlighted.map((li) => li.id)).toEqual(['turn-1', 'turn-2']);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('highlights nothing without a range', () => {
    render(<Transcript utterances={utterances} />);

    expect(turns().some((li) => li.dataset.highlighted)).toBe(false);
  });
});
