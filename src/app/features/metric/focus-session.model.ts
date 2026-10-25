/** Immutable attribution captured when a local focus round ends. Durations are ms. */
export interface FocusTaskAllocation {
  taskId?: string;
  taskTitle?: string;
  projectId?: string;
  projectTitle?: string;
  duration: number;
}

export interface FocusSessionEntry {
  id: string;
  duration: number;
  startedAt?: number;
  endedAt?: number;
  mode?: string;
  isManual?: boolean;
  allocations: FocusTaskAllocation[];
}

export interface FocusSessionRecord {
  day: string;
  index: number;
  duration: number;
  details?: FocusSessionEntry;
}
