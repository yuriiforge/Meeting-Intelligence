import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from './client';
import type { MeetingStatus, SearchParams } from './types';

const IN_PROGRESS: MeetingStatus[] = ['PENDING', 'PROCESSING'];
const POLL_MS = 1500;

export const meetingKeys = {
  all: ['meetings'] as const,
  detail: (id: string) => ['meetings', id] as const,
};

/** Polls while any meeting is still being indexed, then stops. */
export function useMeetings() {
  return useQuery({
    queryKey: meetingKeys.all,
    queryFn: api.listMeetings,
    refetchInterval: (query) =>
      query.state.data?.some((m) => IN_PROGRESS.includes(m.status))
        ? POLL_MS
        : false,
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: meetingKeys.detail(id),
    queryFn: () => api.getMeeting(id),
    refetchInterval: (query) =>
      query.state.data && IN_PROGRESS.includes(query.state.data.status)
        ? POLL_MS
        : false,
  });
}

export function useUploadMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, title }: { file: File; title?: string }) =>
      api.uploadMeeting(file, title),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: meetingKeys.all }),
  });
}

export function useReindexMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.reindexMeeting,
    onSuccess: (meeting) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: meetingKeys.all }),
        queryClient.invalidateQueries({
          queryKey: meetingKeys.detail(meeting.id),
        }),
      ]),
  });
}

export function useSearch(params: SearchParams) {
  return useQuery({
    queryKey: ['search', params],
    queryFn: ({ signal }) => api.search(params, signal),
    enabled: params.q.trim().length > 0,
    // Keep showing the previous results while a refined query loads.
    placeholderData: keepPreviousData,
  });
}
