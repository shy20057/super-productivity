import { statisticsTaskColor, statisticsTaskKey } from './statistics-colors';

describe('statistics task colors', () => {
  it('does not reuse the exact palette when tasks exceed its size', () => {
    const hues = [215, 25, 150, 320, 55, 275, 185, 0];
    const first = statisticsTaskColor(0, hues, 85, 60);
    expect(statisticsTaskColor(1, hues, 85, 60)).not.toBe(first);
    expect(statisticsTaskColor(hues.length, hues, 85, 60)).not.toBe(first);
    expect(statisticsTaskColor(0, hues, 85, 60)).toBe(first);
  });

  it('keeps real task identities separate from unassigned and legacy groups', () => {
    expect(statisticsTaskKey('legacy')).toBe('task:legacy');
    expect(statisticsTaskKey(undefined, true)).toBe('legacy');
    expect(statisticsTaskKey()).toBe('unassigned');
  });
});
