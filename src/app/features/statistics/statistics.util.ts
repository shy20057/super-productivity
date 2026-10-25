import { Metric } from '../metric/metric.model';
import { getFocusSessionEntries } from '../metric/focus-session.util';
import { FocusSessionRecord, FocusTaskAllocation } from '../metric/focus-session.model';
import { statisticsTaskKey } from './statistics-colors';
import {
  StatisticsGroup,
  StatisticsPoint,
  StatisticsRange,
  StatisticsSummary,
  StatisticsView,
} from './statistics.model';

export const parseStatisticsDate = (day: string): Date => {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12);
};

export const statisticsDateKey = (date: Date): string =>
  [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

export const addStatisticsDays = (day: string, amount: number): string => {
  const date = parseStatisticsDate(day);
  date.setDate(date.getDate() + amount);
  return statisticsDateKey(date);
};

export const getStatisticsRange = (
  view: StatisticsView,
  anchor: string,
  today: string,
  firstDayOfWeek: number,
  firstRecordedDay: string = today,
): StatisticsRange => {
  const date = parseStatisticsDate(anchor);
  let first = anchor;
  let last = anchor;
  if (view === 'week') {
    first = addStatisticsDays(anchor, -((date.getDay() - firstDayOfWeek + 7) % 7));
    last = addStatisticsDays(first, 6);
  } else if (view === 'month') {
    first = anchor.slice(0, 7) + '-01';
    last = statisticsDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12));
  } else if (view === 'year') {
    first = anchor.slice(0, 4) + '-01-01';
    last = anchor.slice(0, 4) + '-12-31';
  } else if (view === 'all') {
    first = firstRecordedDay;
    last = today;
  }
  return { first, last, today, view };
};

const addGroup = (
  groups: Map<string, StatisticsGroup>,
  id: string,
  title: string | undefined,
  kind: StatisticsGroup['kind'],
  duration: number,
  seen: Set<string>,
): void => {
  const group = groups.get(id) ?? { id, title, kind, duration: 0, count: 0 };
  group.duration += duration;
  if (!seen.has(id)) group.count++;
  seen.add(id);
  groups.set(id, group);
};

const sortGroups = (groups: Map<string, StatisticsGroup>): StatisticsGroup[] =>
  [...groups.values()].sort((a, b) => b.duration - a.duration);

export const aggregateFocusStatistics = (
  metrics: readonly Metric[],
  range: StatisticsRange,
  projectId?: string,
): StatisticsSummary => {
  const sessions: FocusSessionRecord[] = [];
  const tasks = new Map<string, StatisticsGroup>();
  const projects = new Map<string, StatisticsGroup>();
  const daily = new Map<string, StatisticsPoint>();
  const monthly = new Map<string, StatisticsPoint>();
  const taskIds = new Set<string>();
  const lengthBins = [0, 0, 0, 0, 0];
  const endSlots = Array.from({ length: 7 }, () => Array<number>(12).fill(0));
  const weekdayTotals = Array<number>(7).fill(0);
  const weekdayDays = Array.from({ length: 7 }, () => new Set<string>());
  let legacyDuration = 0;
  let hasOverlappingTasks = false;
  // Only the displayed year/month/week needs a dense calendar, not all history.
  if (range.view !== 'all') {
    for (let day = range.first; day <= range.last; day = addStatisticsDays(day, 1)) {
      daily.set(day, {
        key: day,
        duration: 0,
        count: 0,
        future: day > range.today,
        projects: {},
        tasks: {},
      });
    }
  }
  const source = metrics.filter(
    (metric) =>
      metric.id >= range.first && metric.id <= range.last && metric.id <= range.today,
  );
  for (const metric of source) {
    for (const record of getFocusSessionEntries(metric)) {
      if (record.duration <= 0) continue;
      let allocations: FocusTaskAllocation[] = record.details?.allocations ?? [];
      if (projectId) {
        allocations = allocations.filter((item) => item.projectId === projectId);
        if (!allocations.length) continue;
      }
      const duration = projectId
        ? allocations.reduce((sum, item) => sum + item.duration, 0)
        : record.duration;
      if (duration <= 0) continue;
      const selected: FocusSessionRecord = {
        ...record,
        duration,
        ...(record.details ? { details: { ...record.details, allocations } } : {}),
      };
      sessions.push(selected);
      const point = daily.get(metric.id) ?? {
        key: metric.id,
        duration: 0,
        count: 0,
        future: false,
        projects: {},
        tasks: {},
      };
      point.duration += duration;
      point.count++;
      daily.set(metric.id, point);
      const seenTasks = new Set<string>();
      const seenProjects = new Set<string>();
      if (!record.details) {
        legacyDuration += duration;
        addGroup(tasks, 'legacy', undefined, 'legacy', duration, seenTasks);
        addGroup(projects, 'legacy', undefined, 'legacy', duration, seenProjects);
        point.projects['legacy'] = (point.projects['legacy'] ?? 0) + duration;
        point.tasks['legacy'] = (point.tasks['legacy'] ?? 0) + duration;
      } else {
        for (const allocation of allocations) {
          if (allocation.duration <= 0) continue;
          const taskId = allocation.taskId ?? 'unassigned';
          const taskKey = statisticsTaskKey(allocation.taskId);
          point.tasks[taskKey] = (point.tasks[taskKey] ?? 0) + allocation.duration;
          const projectKey = allocation.projectId ?? 'unassigned';
          if (allocation.taskId) taskIds.add(allocation.taskId);
          addGroup(
            tasks,
            taskId,
            allocation.taskTitle,
            allocation.taskId ? 'known' : 'unassigned',
            allocation.duration,
            seenTasks,
          );
          addGroup(
            projects,
            projectKey,
            allocation.projectTitle,
            allocation.projectId ? 'known' : 'unassigned',
            allocation.duration,
            seenProjects,
          );
          point.projects[projectKey] =
            (point.projects[projectKey] ?? 0) + allocation.duration;
        }
        if (seenTasks.size > 1) hasOverlappingTasks = true;
        if (record.details.endedAt !== undefined) {
          const end = new Date(record.details.endedAt);
          endSlots[(parseStatisticsDate(metric.id).getDay() + 6) % 7][
            Math.floor(end.getHours() / 2)
          ] += duration;
        }
      }
      const mins = record.duration / 60000;
      lengthBins[mins < 15 ? 0 : mins < 30 ? 1 : mins < 45 ? 2 : mins < 60 ? 3 : 4]++;
      const weekday = (parseStatisticsDate(metric.id).getDay() + 6) % 7;
      weekdayTotals[weekday] += duration;
      weekdayDays[weekday].add(metric.id);
    }
  }
  for (const point of daily.values()) {
    const key = point.key.slice(0, 7);
    const month = monthly.get(key) ?? {
      key,
      duration: 0,
      count: 0,
      future: false,
      projects: {},
      tasks: {},
    };
    month.duration += point.duration;
    month.count += point.count;
    for (const [id, value] of Object.entries(point.tasks)) {
      month.tasks[id] = (month.tasks[id] ?? 0) + value;
    }
    for (const [id, value] of Object.entries(point.projects)) {
      month.projects[id] = (month.projects[id] ?? 0) + value;
    }
    month.future = key > range.today.slice(0, 7);
    monthly.set(key, month);
  }
  return {
    duration: sessions.reduce((total, record) => total + record.duration, 0),
    count: sessions.length,
    taskCount: taskIds.size,
    activeDays: [...daily.values()].filter((day) => day.duration > 0).length,
    longest: sessions.reduce((longest, record) => Math.max(longest, record.duration), 0),
    legacyDuration,
    hasOverlappingTasks,
    sessions: sessions.sort((a, b) => b.day.localeCompare(a.day) || b.index - a.index),
    daily: [...daily.values()].sort((a, b) => a.key.localeCompare(b.key)),
    monthly: [...monthly.values()].sort((a, b) => a.key.localeCompare(b.key)),
    tasks: sortGroups(tasks),
    projects: sortGroups(projects),
    lengthBins,
    endSlots,
    weekdayAverages: weekdayTotals.map((total, i) => total / (weekdayDays[i].size || 1)),
  };
};
