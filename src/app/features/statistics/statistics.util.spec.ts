import { aggregateFocusStatistics, getStatisticsRange } from './statistics.util';
import { appendFocusSession } from '../metric/focus-session.util';

describe('focus statistics aggregation', () => {
  it('credits a complete round to its recorded ending day', () => {
    const metric = appendFocusSession({ id: '2026-10-24' }, 120000, {
      id: 's',
      duration: 120000,
      startedAt: new Date(2026, 9, 23, 23, 59).getTime(),
      endedAt: new Date(2026, 9, 24, 0, 1).getTime(),
      allocations: [{ taskId: 't', duration: 120000 }],
    });
    const range = getStatisticsRange('week', '2026-10-24', '2026-10-24', 1);
    const result = aggregateFocusStatistics([metric], range);
    expect(result.daily.find((day) => day.key === '2026-10-23')!.duration).toBe(0);
    expect(result.daily.find((day) => day.key === '2026-10-24')!.duration).toBe(120000);
    expect(result.daily.reduce((sum, day) => sum + day.duration, 0)).toBe(
      result.duration,
    );
  });
  it('counts one multi-task round once and conserves project allocations', () => {
    const metric = appendFocusSession({ id: '2026-10-24' }, 30000, {
      id: 's',
      duration: 30000,
      allocations: [
        { taskId: 'a', projectId: 'p1', duration: 10000 },
        { taskId: 'b', projectId: 'p2', duration: 20000 },
      ],
    });
    const range = getStatisticsRange('day', metric.id, metric.id, 1);
    const all = aggregateFocusStatistics([metric], range);
    expect(all.count).toBe(1);
    expect(all.taskCount).toBe(2);
    expect(all.hasOverlappingTasks).toBeTrue();
    expect(all.daily[0].tasks).toEqual(
      Object.fromEntries([
        ['task:a', 10000],
        ['task:b', 20000],
      ]),
    );
    expect(all.monthly[0].tasks).toEqual(all.daily[0].tasks);
    const filtered = aggregateFocusStatistics([metric], range, 'p1');
    expect(filtered.duration).toBe(10000);
    expect(filtered.count).toBe(1);
    expect(filtered.daily[0].tasks).toEqual(Object.fromEntries([['task:a', 10000]]));
  });
  it('includes legacy durations but does not invent known tasks', () => {
    const range = getStatisticsRange('month', '2024-02-29', '2024-02-29', 1);
    const result = aggregateFocusStatistics(
      [{ id: '2024-02-29', focusSessions: [60000] }],
      range,
    );
    expect(result.daily.length).toBe(29);
    expect(result.taskCount).toBe(0);
    expect(result.legacyDuration).toBe(60000);
    expect(result.tasks[0].kind).toBe('legacy');
  });
});
