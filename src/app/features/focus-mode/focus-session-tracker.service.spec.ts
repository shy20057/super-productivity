import { TestBed } from '@angular/core/testing';
import { FocusSessionTrackerService } from './focus-session-tracker.service';
import { FocusModeMode, TimerState } from './focus-mode.model';
import { DEFAULT_TASK, Task } from '../tasks/task.model';
import { LS } from '../../core/persistence/storage-keys.const';

describe('FocusSessionTrackerService', () => {
  let service: FocusSessionTrackerService;
  const task = (id: string): Task => ({ ...DEFAULT_TASK, id, title: id, projectId: 'p' });
  const timer = (elapsed: number, isRunning = false): TimerState => ({
    purpose: 'work',
    startedAt: 1000,
    elapsed,
    isRunning,
    duration: 60000,
  });
  beforeEach(() => {
    localStorage.removeItem(LS.FOCUS_STATISTICS_DRAFT);
    TestBed.configureTestingModule({});
    service = TestBed.inject(FocusSessionTrackerService);
  });
  afterEach(() => service.cancel());
  it('conserves time when a round switches tasks', () => {
    service.observe(timer(0), FocusModeMode.Countdown, task('a'), 'Project', 1000);
    service.observe(timer(10000), FocusModeMode.Countdown, task('b'), 'Project', 11000);
    const entry = service.finish(30000, false, 31000)!;
    expect(entry.allocations.map((a) => [a.taskId, a.duration])).toEqual([
      ['a', 10000],
      ['b', 20000],
    ]);
    expect(entry.duration).toBe(30000);
  });
  it('does not count a paused wall-clock gap', () => {
    service.observe(timer(10000), FocusModeMode.Countdown, task('a'), 'Project', 11000);
    service.observe(timer(10000), FocusModeMode.Countdown, task('a'), 'Project', 91000);
    expect(service.finish(10000, true, 91000)!.allocations[0].duration).toBe(10000);
  });
  it('does not produce a record after cancellation', () => {
    service.observe(timer(10000), FocusModeMode.Countdown, task('a'), 'Project', 11000);
    service.cancel();
    expect(service.finish(10000, true, 12000)).toBeUndefined();
  });

  it('retains the round task when tracking stops before session completion', () => {
    service.observe(timer(0), FocusModeMode.Countdown, task('a'), 'Project', 1000, true);
    service.observe(timer(10000), FocusModeMode.Countdown, undefined, undefined, 11000);
    expect(service.getTaskId()).toBe('a');
    service.finish(10000, true, 11000);
    expect(service.getTaskId()).toBeUndefined();
  });

  it('keeps task attribution and elapsed time when recreated after a reload', () => {
    service.observe(timer(0), FocusModeMode.Countdown, task('a'), 'Project', 1000, true);
    service.observe(timer(10000), FocusModeMode.Countdown, task('a'), 'Project', 11000);

    const restored = new FocusSessionTrackerService();
    restored.observe(timer(20000), FocusModeMode.Countdown, task('a'), 'Project', 21000);
    const entry = restored.finish(30000, true, 31000)!;

    expect(entry.startedAt).toBe(1000);
    expect(entry.allocations).toEqual([
      jasmine.objectContaining({ taskId: 'a', taskTitle: 'a', duration: 30000 }),
    ]);
  });

  it('does not invent task attribution when recovering without a draft', () => {
    service.observe(timer(10000), FocusModeMode.Countdown, task('a'), 'Project', 11000);
    const entry = service.finish(10000, true, 11000)!;
    expect(entry.allocations).toEqual([{ duration: 10000 }]);
  });

  it('records Flowtime completion as manual even when auto-break uses a false flag', () => {
    service.observe(timer(0), FocusModeMode.Flowtime, task('a'), 'Project', 1000, true);
    expect(service.finish(10000, false, 11000)!.isManual).toBeTrue();
  });
});
