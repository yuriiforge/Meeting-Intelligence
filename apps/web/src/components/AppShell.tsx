import { AudioLines, Menu, Plus, Search, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router';
import { useMeetings } from '../api/hooks';
import { UploadDialog } from '../features/meetings/UploadDialog';
import { formatMeetingDate } from '../lib/format';
import { StatusBadge } from './StatusBadge';

export function AppShell() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-svh">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-surface transition-transform md:sticky md:top-0 md:h-svh md:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <NavLink
            to="/"
            className="flex items-center gap-2 font-semibold"
            onClick={() => setMenuOpen(false)}
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-on-accent">
              <AudioLines className="size-4" aria-hidden />
            </span>
            Meeting Intelligence
          </NavLink>
          <button
            type="button"
            className="rounded-md p-1 text-muted md:hidden"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-2 px-4 py-3">
          <SidebarSearch onSearch={() => setMenuOpen(false)} />
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden />
            Add meetings
          </button>
        </div>

        <MeetingNav onNavigate={() => setMenuOpen(false)} />
      </aside>

      {menuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-md p-1 text-muted"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <span className="font-semibold">Meeting Intelligence</span>
        </header>
        <main className="flex-1">
          <Outlet context={{ openUpload: () => setUploadOpen(true) }} />
        </main>
      </div>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}

/** Context passed to pages through <Outlet>. */
export interface ShellContext {
  openUpload: () => void;
}

function SidebarSearch({ onSearch }: { onSearch: () => void }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/search?${new URLSearchParams({ q })}`);
    onSearch();
  }

  return (
    <form role="search" onSubmit={submit} className="relative">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint"
        aria-hidden
      />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search all meetings…"
        aria-label="Search all meetings"
        className="w-full rounded-lg border border-line bg-canvas py-2 pl-8 pr-3 text-sm outline-none placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </form>
  );
}

function MeetingNav({ onNavigate }: { onNavigate: () => void }) {
  const { data: meetings, isPending, isError } = useMeetings();

  return (
    <nav
      aria-label="Meetings"
      className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
    >
      <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-faint">
        Meetings
      </p>
      {isPending && <p className="px-2 py-1 text-sm text-muted">Loading…</p>}
      {isError && (
        <p className="px-2 py-1 text-sm text-danger">
          Could not reach the API.
        </p>
      )}
      {meetings?.length === 0 && (
        <p className="px-2 py-1 text-sm text-muted">No meetings yet.</p>
      )}
      <ul className="space-y-0.5">
        {meetings?.map((m) => (
          <li key={m.id}>
            <NavLink
              to={`/meetings/${m.id}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-start gap-2 rounded-lg px-2 py-2 text-sm ${
                  isActive
                    ? 'bg-accent-soft text-accent-ink'
                    : 'hover:bg-raised'
                }`
              }
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.title}</span>
                <span className="block text-xs text-muted">
                  {formatMeetingDate(m.occurredAt) ?? 'No date'}
                </span>
              </span>
              {m.status !== 'READY' && (
                <StatusBadge status={m.status} compact />
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
