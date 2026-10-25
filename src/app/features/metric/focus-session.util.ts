import { Metric } from './metric.model';
import { FocusSessionEntry, FocusSessionRecord } from './focus-session.model';

// An exact content marker: old clients can rewrite numeric durations without
// knowing about metadata. Never associate tasks using stale array positions.
export const getFocusSessionsSignature = (durations: readonly number[]): string =>
  durations.join(',');

export const getFocusSessionEntries = (metric: Metric): FocusSessionRecord[] => {
  const durations = metric.focusSessions ?? [];
  const matches =
    metric.focusSessionDetailsSignature === getFocusSessionsSignature(durations);
  return durations.map((duration, index) => {
    const details = matches ? metric.focusSessionDetails?.[index] : undefined;
    const isValid =
      details?.duration === duration &&
      details.allocations.reduce((total, item) => total + item.duration, 0) === duration;
    return {
      day: metric.id,
      index,
      duration,
      ...(isValid ? { details: details! } : {}),
    };
  });
};

export const appendFocusSession = (
  metric: Metric,
  duration: number,
  entry?: FocusSessionEntry,
): Metric => {
  const records = getFocusSessionEntries(metric);
  if (entry && records.some((record) => record.details?.id === entry.id)) return metric;
  const focusSessions = [...(metric.focusSessions ?? []), duration];
  return {
    ...metric,
    focusSessions,
    focusSessionDetails: [
      ...records.map((record) => record.details ?? null),
      entry ?? null,
    ],
    focusSessionDetailsSignature: getFocusSessionsSignature(focusSessions),
  };
};
