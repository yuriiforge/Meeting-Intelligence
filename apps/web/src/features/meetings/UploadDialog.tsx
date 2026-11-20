import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../api/client';
import { useUploadMeeting } from '../../api/hooks';
import type { IngestResult } from '../../api/types';
import { SAMPLE_COUNT, sampleFiles } from './sampleTranscripts';

type FileResult =
  | { name: string; state: 'uploading' }
  | { name: string; state: 'done'; meeting: IngestResult }
  | { name: string; state: 'error'; message: string };

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UploadDialog({ open, onClose }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<FileResult[]>([]);
  const upload = useUploadMeeting();
  const busy = results.some((r) => r.state === 'uploading');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  /** Uploads one at a time so results appear in order and errors stay per file. */
  async function uploadAll(files: File[]) {
    setResults((prev) => [
      ...prev,
      ...files.map((f) => ({ name: f.name, state: 'uploading' as const })),
    ]);
    for (const file of files) {
      const outcome: FileResult = await upload
        .mutateAsync({ file })
        .then((meeting) => ({
          name: file.name,
          state: 'done' as const,
          meeting,
        }))
        .catch((error: unknown) => ({
          name: file.name,
          state: 'error' as const,
          message: describeError(error),
        }));
      setResults((prev) =>
        prev.map((r) =>
          r.name === file.name && r.state === 'uploading' ? outcome : r,
        ),
      );
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    if (files.length > 0) void uploadAll(files);
  }

  function close() {
    if (busy) return;
    setResults([]);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold">
            Add meetings
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="rounded-md p-1 text-muted hover:bg-raised disabled:opacity-40"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
              dragging
                ? 'border-accent bg-accent-soft'
                : 'border-line hover:border-accent/60 hover:bg-raised'
            }`}
          >
            <Upload className="size-6 text-accent" aria-hidden />
            <span className="text-sm font-medium">
              Drop transcripts here, or click to choose
            </span>
            <span className="text-xs text-muted">
              .txt or .md, up to 1 MB, lines like{' '}
              <code className="font-mono">[00:12:34] Alice: …</code>
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            multiple
            hidden
            data-testid="file-input"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              if (files.length > 0) void uploadAll(files);
            }}
          />

          {SAMPLE_COUNT > 0 && (
            <button
              type="button"
              onClick={() => void uploadAll(sampleFiles())}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-accent-ink hover:bg-accent-soft disabled:opacity-50"
            >
              <Sparkles className="size-4" aria-hidden />
              Load {SAMPLE_COUNT} sample meetings
            </button>
          )}

          {results.length > 0 && (
            <ul className="space-y-2" aria-label="Upload results">
              {results.map((result, index) => (
                <ResultRow
                  key={`${result.name}-${index}`}
                  result={result}
                  onOpen={close}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  result,
  onOpen,
}: {
  result: FileResult;
  onOpen: () => void;
}) {
  return (
    <li className="rounded-lg border border-line px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {result.state === 'uploading' && (
          <Loader2 className="size-4 animate-spin text-muted" aria-hidden />
        )}
        {result.state === 'done' && (
          <CheckCircle2 className="size-4 text-ok" aria-hidden />
        )}
        {result.state === 'error' && (
          <XCircle className="size-4 text-danger" aria-hidden />
        )}
        <FileText className="size-4 text-faint" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{result.name}</span>
        {result.state === 'done' && (
          <Link
            to={`/meetings/${result.meeting.id}`}
            onClick={onOpen}
            className="text-xs font-medium text-accent hover:underline"
          >
            Open
          </Link>
        )}
      </div>
      {result.state === 'done' && (
        <p className="mt-1 pl-12 text-xs text-muted">
          {result.meeting.utteranceCount} turns,{' '}
          {result.meeting.speakers.length} speakers. Indexing in the background.
        </p>
      )}
      {result.state === 'done' && result.meeting.warnings.length > 0 && (
        <details className="mt-1 pl-12 text-xs text-warn">
          <summary className="cursor-pointer">
            <AlertTriangle className="mr-1 inline size-3" aria-hidden />
            {result.meeting.warnings.length} line(s) skipped
          </summary>
          <ul className="mt-1 list-disc pl-4">
            {result.meeting.warnings.map((w) => (
              <li key={`${w.line}-${w.message}`}>
                Line {w.line}: {w.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      {result.state === 'error' && (
        <p className="mt-1 pl-12 text-xs text-danger">{result.message}</p>
      )}
    </li>
  );
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    const first = error.issues[0];
    return first
      ? `${error.message} (line ${first.line}: ${first.message})`
      : error.message;
  }
  return 'Upload failed. Is the API running?';
}
