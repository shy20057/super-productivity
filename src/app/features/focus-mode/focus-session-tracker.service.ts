import { Injectable } from '@angular/core';
import { FocusModeMode, TimerState } from './focus-mode.model';
import { Task } from '../tasks/task.model';
import { FocusSessionEntry, FocusTaskAllocation } from '../metric/focus-session.model';
import { LS } from '../../core/persistence/storage-keys.const';
import { lsGetJSON, lsRemoveItem, lsSetJSON } from '../../util/ls-util';

interface FocusSessionDraft extends FocusSessionEntry {
  elapsed: number;
  currentTaskKey: string;
  lastTaskKey?: string;
}

/** Local-only attribution; persisted once as a METRIC when the round ends. */
@Injectable({ providedIn: 'root' })
export class FocusSessionTrackerService {
  private _draft = lsGetJSON<FocusSessionDraft>(LS.FOCUS_STATISTICS_DRAFT);
  private _lastSave = 0;

  observe(
    timer: TimerState,
    mode: FocusModeMode,
    task: Task | undefined,
    projectTitle?: string,
    now: number = Date.now(),
    isNewSession = false,
  ): void {
    if (timer.purpose !== 'work') return;
    const elapsed =
      timer.isRunning && timer.startedAt !== null
        ? Math.max(timer.elapsed, now - timer.startedAt)
        : timer.elapsed;
    const key = task?.id ?? '';
    if (!this._draft) {
      this._draft = {
        id: crypto.randomUUID(),
        duration: 0,
        elapsed: isNewSession ? 0 : elapsed,
        ...(isNewSession ? { startedAt: now - elapsed } : {}),
        mode,
        currentTaskKey: key,
        allocations: !isNewSession && elapsed > 0 ? [{ duration: elapsed }] : [],
      };
    }
    const draft = this._draft;
    const previousKey = draft.currentTaskKey;
    // The task selected before this transition owns the elapsed delta.
    let previous = draft.allocations.find((item) => (item.taskId ?? '') === previousKey);
    if (!previous) {
      previous = this._allocation(previousKey === key ? task : undefined, projectTitle);
      draft.allocations.push(previous);
    }
    previous.duration += Math.max(0, elapsed - draft.elapsed);
    draft.elapsed = elapsed;
    draft.currentTaskKey = key;
    if (key) draft.lastTaskKey = key;
    if (!draft.allocations.some((item) => (item.taskId ?? '') === key)) {
      draft.allocations.push(this._allocation(task, projectTitle));
    }
    // Save transitions immediately, and bound tick-driven local writes to 10s.
    if (key !== previousKey || !timer.isRunning || now - this._lastSave >= 10000) {
      lsSetJSON(LS.FOCUS_STATISTICS_DRAFT, draft);
      this._lastSave = now;
    }
  }

  getTaskId(): string | undefined {
    return this._draft?.currentTaskKey || this._draft?.lastTaskKey || undefined;
  }

  finish(
    duration: number,
    isManual: boolean,
    now: number = Date.now(),
  ): FocusSessionEntry | undefined {
    const draft = this._draft;
    if (!draft) return undefined;
    const allocations = draft.allocations.map((item) => ({ ...item }));
    const tail = allocations.find((item) => (item.taskId ?? '') === draft.currentTaskKey);
    const remainder = Math.max(0, duration - draft.elapsed);
    if (tail) tail.duration += remainder;
    else allocations.push({ duration: remainder });
    const total = allocations.reduce((value, item) => value + item.duration, 0);
    // The existing timer's completion duration remains authoritative.
    let allocated = 0;
    const positive = allocations.filter((item) => item.duration > 0);
    const normalized = positive.map((item, index) => {
      const value =
        index === positive.length - 1
          ? duration - allocated
          : Math.floor((item.duration * duration) / total);
      allocated += value;
      return { ...item, duration: value };
    });
    const entry: FocusSessionEntry = {
      id: draft.id,
      duration,
      startedAt: draft.startedAt,
      endedAt: now,
      mode: draft.mode,
      isManual: isManual || draft.mode === FocusModeMode.Flowtime,
      allocations: normalized.length ? normalized : [{ duration }],
    };
    this.cancel();
    return entry;
  }

  cancel(): void {
    this._draft = null;
    lsRemoveItem(LS.FOCUS_STATISTICS_DRAFT);
  }

  private _allocation(
    task: Task | undefined,
    projectTitle?: string,
  ): FocusTaskAllocation {
    return {
      duration: 0,
      ...(task
        ? {
            taskId: task.id,
            taskTitle: task.title,
            projectId: task.projectId,
            ...(projectTitle ? { projectTitle } : {}),
          }
        : {}),
    };
  }
}
