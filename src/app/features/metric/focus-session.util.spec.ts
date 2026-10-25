import {
  appendFocusSession,
  getFocusSessionEntries,
  getFocusSessionsSignature,
} from './focus-session.util';
import { FocusSessionEntry } from './focus-session.model';

describe('focus session metadata', () => {
  const entry: FocusSessionEntry = {
    id: 'round-1',
    duration: 60000,
    startedAt: 1000,
    endedAt: 61000,
    mode: 'Countdown',
    isManual: false,
    allocations: [{ taskId: 'task-1', taskTitle: 'Read', duration: 60000 }],
  };
  it('keeps old durations without inventing task attribution', () => {
    expect(getFocusSessionEntries({ id: '2026-10-24', focusSessions: [60000] })).toEqual([
      { day: '2026-10-24', index: 0, duration: 60000 },
    ]);
  });
  it('invalidates metadata when an older client rewrites the source array', () => {
    const metric = appendFocusSession({ id: '2026-10-24' }, 60000, entry);
    expect(
      getFocusSessionEntries({ ...metric, focusSessions: [120000] })[0].details,
    ).toBeUndefined();
  });
  it('appends duration and attribution together without counting an id twice', () => {
    const metric = appendFocusSession({ id: '2026-10-24' }, 60000, entry);
    expect(appendFocusSession(metric, 60000, entry)).toBe(metric);
    expect(metric.focusSessions).toEqual([60000]);
    expect(getFocusSessionEntries(metric)[0].details).toEqual(entry);
  });
  it('retains legacy entries when a known round is appended', () => {
    const metric = appendFocusSession(
      { id: '2026-10-24', focusSessions: [30000] },
      60000,
      entry,
    );
    expect(getFocusSessionEntries(metric).map((row) => !!row.details)).toEqual([
      false,
      true,
    ]);
    expect(metric.focusSessionDetailsSignature).toBe(
      getFocusSessionsSignature([30000, 60000]),
    );
  });
});
