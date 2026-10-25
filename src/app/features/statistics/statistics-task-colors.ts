import { computed, ElementRef, inject, Signal } from '@angular/core';
import { GlobalThemeService } from '../../core/theme/global-theme.service';
import { CustomThemeService } from '../../core/theme/custom-theme.service';
import { statisticsTaskColor } from './statistics-colors';
import { StatisticsService } from './statistics.service';

/** Resolve theme tokens at the rendering host for both canvas and SVG/HTML. */
export const injectStatisticsTaskColors = (): Signal<(key: string) => string> => {
  const element = inject<ElementRef<HTMLElement>>(ElementRef);
  const theme = inject(GlobalThemeService);
  const customTheme = inject(CustomThemeService);
  const statistics = inject(StatisticsService);
  return computed(() => {
    const isDark = theme.isDarkTheme();
    customTheme.appliedThemeVersion();
    const style = getComputedStyle(element.nativeElement);
    const palette = style
      .getPropertyValue('--statistics-task-palette')
      .split(',')
      .map((color) => color.trim())
      .filter(Boolean);
    const hues = style.getPropertyValue('--statistics-task-hues').split(',').map(Number);
    const saturation = Number(style.getPropertyValue('--statistics-task-saturation'));
    const lightness = Number(
      style.getPropertyValue(
        isDark ? '--statistics-task-lightness-dark' : '--statistics-task-lightness',
      ),
    );
    const slots = statistics.taskColorSlots();
    const muted = style.getPropertyValue('--text-color-muted').trim();
    return (key: string): string =>
      !slots.has(key)
        ? muted
        : (palette[slots.get(key)!] ??
          statisticsTaskColor(slots.get(key)!, hues, saturation, lightness));
  });
};
