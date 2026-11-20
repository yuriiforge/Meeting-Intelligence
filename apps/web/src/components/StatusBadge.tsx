import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { MeetingStatus } from '../api/types';

const STYLES: Record<
  MeetingStatus,
  { label: string; className: string; icon: 'spin' | 'ok' | 'fail' }
> = {
  PENDING: { label: 'Queued', className: 'text-muted', icon: 'spin' },
  PROCESSING: { label: 'Indexing', className: 'text-accent', icon: 'spin' },
  READY: { label: 'Ready', className: 'text-ok', icon: 'ok' },
  FAILED: { label: 'Failed', className: 'text-danger', icon: 'fail' },
};

interface Props {
  status: MeetingStatus;
  /** Icon only, with the label as tooltip (for dense lists). */
  compact?: boolean;
}

export function StatusBadge({ status, compact = false }: Props) {
  const { label, className, icon } = STYLES[status];
  const Icon =
    icon === 'spin' ? Loader2 : icon === 'ok' ? CheckCircle2 : AlertTriangle;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${className}`}
      title={label}
      role="status"
      aria-label={compact ? label : undefined}
    >
      <Icon
        className={`size-3.5 ${icon === 'spin' ? 'animate-spin' : ''}`}
        aria-hidden
      />
      {!compact && label}
    </span>
  );
}
