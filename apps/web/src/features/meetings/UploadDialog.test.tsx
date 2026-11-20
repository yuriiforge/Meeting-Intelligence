import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFetch, renderWithProviders } from '../../test/render';
import { UploadDialog } from './UploadDialog';

const transcript = (name: string) =>
  new File(['[00:00:01] Alice: hi'], name, { type: 'text/plain' });

const meeting = {
  id: 'm1',
  title: 'Weekly sync',
  status: 'PENDING',
  error: null,
  occurredAt: null,
  durationSeconds: 1,
  sourceFilename: 'weekly.txt',
  speakers: ['Alice'],
  utteranceCount: 1,
  chunkCount: 1,
  createdAt: '2026-11-20T00:00:00.000Z',
  warnings: [
    { line: 3, message: 'Not a speaker turn or header; line ignored' },
  ],
};

describe('UploadDialog', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(<UploadDialog open={false} onClose={() => {}} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('uploads a file and shows the result with parser warnings', async () => {
    const fetch = mockFetch({ status: 201, body: meeting });
    renderWithProviders(<UploadDialog open onClose={() => {}} />);

    await userEvent.upload(
      screen.getByTestId('file-input'),
      transcript('weekly.txt'),
    );

    expect(await screen.findByText(/1 turns, 1 speakers/)).toBeInTheDocument();
    expect(screen.getByText('1 line(s) skipped')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/meetings/m1',
    );
    expect(fetch).toHaveBeenCalledWith(
      '/api/meetings',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it("shows the API's reason when a file is rejected", async () => {
    mockFetch({
      status: 422,
      body: {
        message: 'No speaker turns found.',
        issues: [
          { line: 1, message: 'Not a speaker turn or header; line ignored' },
        ],
      },
    });
    renderWithProviders(<UploadDialog open onClose={() => {}} />);

    await userEvent.upload(
      screen.getByTestId('file-input'),
      transcript('notes.txt'),
    );

    expect(
      await screen.findByText(/No speaker turns found\. \(line 1:/),
    ).toBeInTheDocument();
  });

  it('offers the bundled sample meetings', () => {
    renderWithProviders(<UploadDialog open onClose={() => {}} />);

    expect(
      screen.getByRole('button', { name: /Load 4 sample meetings/ }),
    ).toBeEnabled();
  });
});
