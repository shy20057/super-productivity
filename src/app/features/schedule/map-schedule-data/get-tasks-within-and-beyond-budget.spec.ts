import { TaskWithoutReminder } from '../../tasks/task.model';
import { getTasksWithinAndBeyondBudget } from './get-tasks-within-and-beyond-budget';

const minutes = (n: number): number => n * 60 * 1000;

const makeTask = (
  id: string,
  isDone: boolean,
  timeEstimate: number,
): TaskWithoutReminder =>
  ({
    id,
    isDone,
    subTaskIds: [],
    timeSpent: 0,
    timeEstimate,
  }) as any;

describe('getTasksWithinAndBeyondBudget()', () => {
  it('should not charge a done task against the budget', () => {
    const done = makeTask('done', true, minutes(60));
    const undone = makeTask('undone', false, minutes(60));

    const { within, beyond } = getTasksWithinAndBeyondBudget([done, undone], minutes(60));

    // the done task is worked off already, so the remaining hour still fits
    expect(within.map((t) => t.id)).toEqual(['done', 'undone']);
    expect(beyond).toEqual([]);
  });

  it('should put an undone task beyond the budget', () => {
    const undone = makeTask('undone', false, minutes(60));

    const { within, beyond } = getTasksWithinAndBeyondBudget([undone], minutes(30));

    expect(within).toEqual([]);
    expect(beyond.map((t) => t.id)).toEqual(['undone']);
  });
});
