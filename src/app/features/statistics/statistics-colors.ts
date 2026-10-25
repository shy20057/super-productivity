export const statisticsTaskKey = (taskId?: string, legacy = false): string =>
  legacy ? 'legacy' : taskId ? `task:${taskId}` : 'unassigned';

/** Pick well-separated categorical hues, with variations for longer histories. */
export const statisticsTaskColor = (
  slot: number,
  hues: readonly number[],
  saturation: number,
  lightness: number,
): string => {
  const cycle = Math.floor(slot / hues.length);
  const offset = cycle * 13;
  const hue = (hues[slot % hues.length] + offset) % 360;
  const shadeOffset = (cycle % 2) * 10;
  const shade = lightness - shadeOffset;
  return `hsl(${hue}, ${saturation}%, ${shade}%)`;
};
