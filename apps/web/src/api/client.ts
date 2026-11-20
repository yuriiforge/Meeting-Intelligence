import type {
  IngestResult,
  MeetingDetail,
  MeetingSummary,
  ParseIssue,
  SearchParams,
  SearchResult,
} from './types';

/** An HTTP error with the API's own message, ready to show to the user. */
export class ApiError extends Error {
  readonly status: number;
  readonly issues: ParseIssue[];

  constructor(message: string, status: number, issues: ParseIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) {
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
    issues?: ParseIssue[];
  } | null;
  const message = Array.isArray(body?.message)
    ? body.message.join(', ')
    : (body?.message ?? `Request failed (${response.status})`);
  return new ApiError(message, response.status, body?.issues ?? []);
}

export const api = {
  listMeetings: () => request<MeetingSummary[]>('/meetings'),

  getMeeting: (id: string) => request<MeetingDetail>(`/meetings/${id}`),

  uploadMeeting: (file: File, title?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    return request<IngestResult>('/meetings', { method: 'POST', body: form });
  },

  reindexMeeting: (id: string) =>
    request<MeetingSummary>(`/meetings/${id}/index`, { method: 'POST' }),

  search: (params: SearchParams, signal?: AbortSignal) => {
    const query = new URLSearchParams({ q: params.q, limit: '10' });
    if (params.meetingId) query.set('meetingId', params.meetingId);
    if (params.speaker) query.set('speaker', params.speaker);
    if (params.mode) query.set('mode', params.mode);
    return request<SearchResult>(`/search?${query}`, { signal });
  },
};
