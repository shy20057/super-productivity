import { FocusSessionRecord } from '../metric/focus-session.model';

export type StatisticsView = 'day' | 'week' | 'month' | 'year' | 'all';
export interface StatisticsRange {
  first: string;
  last: string;
  today: string;
  view: StatisticsView;
}
export interface StatisticsPoint {
  key: string;
  duration: number;
  count: number;
  future: boolean;
  projects: Record<string, number>;
  tasks: Record<string, number>;
}
export interface StatisticsGroup {
  id: string;
  title?: string;
  kind: 'known' | 'legacy' | 'unassigned';
  duration: number;
  count: number;
}
export interface StatisticsSummary {
  duration: number;
  count: number;
  taskCount: number;
  activeDays: number;
  longest: number;
  legacyDuration: number;
  hasOverlappingTasks: boolean;
  sessions: FocusSessionRecord[];
  daily: StatisticsPoint[];
  monthly: StatisticsPoint[];
  tasks: StatisticsGroup[];
  projects: StatisticsGroup[];
  lengthBins: number[];
  weekdayAverages: number[];
  endSlots: number[][];
}
