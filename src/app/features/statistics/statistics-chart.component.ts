import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { ChartData, ChartOptions, ChartType } from 'chart.js';
import { LazyChartComponent } from '../metric/lazy-chart/lazy-chart.component';
import { GlobalThemeService } from '../../core/theme/global-theme.service';
import { CustomThemeService } from '../../core/theme/custom-theme.service';
import { TranslatePipe } from '@ngx-translate/core';
import { T } from '../../t.const';
import { injectStatisticsTaskColors } from './statistics-task-colors';

export interface StatisticsChartSeries {
  label: string;
  values: number[];
  colorKey?: string;
  colorKeys?: string[];
}

@Component({
  selector: 'statistics-chart',
  imports: [LazyChartComponent, TranslatePipe],
  templateUrl: './statistics-chart.component.html',
  styleUrl: './statistics-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsChartComponent {
  private readonly _element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _theme = inject(GlobalThemeService);
  private readonly _customTheme = inject(CustomThemeService);
  private readonly _taskColors = injectStatisticsTaskColors();
  readonly T = T;
  readonly title = input.required<string>();
  readonly labels = input.required<string[]>();
  readonly series = input.required<StatisticsChartSeries[]>();
  readonly keys = input<string[]>([]);
  readonly type = input<ChartType>('bar');
  readonly stacked = input(false);
  readonly horizontal = input(false);
  readonly unit = input<'hours' | 'rounds'>('hours');
  readonly inlineLegend = input(false);
  readonly detailList = input(false);
  readonly selected = output<string>();

  // Chart.js canvas cannot resolve CSS var() colors; read the host's theme
  // tokens at this rendering boundary instead of hardcoding canvas colors.
  private readonly _palette = computed(() => {
    this._theme.isDarkTheme();
    this._customTheme.appliedThemeVersion();
    const style = getComputedStyle(this._element.nativeElement);
    const palette = style
      .getPropertyValue('--statistics-task-palette')
      .split(',')
      .map((color) => color.trim())
      .filter(Boolean);
    if (palette.length) return palette;
    return [
      '--palette-primary-500',
      '--palette-accent-500',
      '--color-success',
      '--color-warning',
      '--palette-primary-300',
      '--text-color-muted',
    ].map((token) => style.getPropertyValue(token).trim());
  });
  readonly datasets = computed<ChartData['datasets']>(() => {
    const palette = this._palette();
    const taskColor = this._taskColors();
    const ring = this.type() === 'doughnut';
    return this.series().map((series, index) => ({
      label: series.label,
      data: series.values,
      backgroundColor: series.colorKeys
        ? series.colorKeys.map(taskColor)
        : series.colorKey
          ? taskColor(series.colorKey)
          : ring || this.inlineLegend()
            ? series.values.map((_, i) => palette[i % palette.length])
            : palette[index % palette.length],
      borderColor: series.colorKey
        ? taskColor(series.colorKey)
        : palette[index % palette.length],
      borderWidth: this.type() === 'line' ? 2 : 0,
      ...(this.type() === 'line' ? { pointRadius: 2, tension: 0.15 } : {}),
    }));
  });
  readonly options = computed<ChartOptions>(() => {
    this._theme.isDarkTheme();
    this._customTheme.appliedThemeVersion();
    const style = getComputedStyle(this._element.nativeElement);
    const text =
      style.getPropertyValue('--statistics-chart-text-color').trim() ||
      style.getPropertyValue('--text-color-muted').trim();
    const grid =
      style.getPropertyValue('--statistics-chart-grid-color').trim() ||
      style.getPropertyValue('--separator-color').trim();
    const categoryGrid =
      style.getPropertyValue('--statistics-chart-category-grid').trim() !== '0';
    const ring = this.type() === 'doughnut';
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      indexAxis: this.horizontal() ? 'y' : 'x',
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) =>
              `${ring ? context.label : context.dataset.label}: ${this._formatValue(Number(context.raw))}`,
          },
        },
        legend: {
          display: !this.inlineLegend() && (ring || this.series().length > 1),
          position: 'bottom',
          labels: { color: text, boxWidth: 10, padding: 16 },
        },
      },
      ...(ring
        ? {}
        : {
            scales: {
              x: {
                stacked: this.stacked(),
                ticks: { color: text, maxRotation: 0, autoSkip: true },
                grid: {
                  color: grid,
                  drawOnChartArea: categoryGrid || this.horizontal(),
                },
                beginAtZero: true,
              },
              y: {
                stacked: this.stacked(),
                ticks: { color: text, precision: this.unit() === 'rounds' ? 0 : 1 },
                grid: {
                  color: grid,
                  drawOnChartArea: categoryGrid || !this.horizontal(),
                },
                beginAtZero: true,
              },
            },
          }),
      onClick: (_event, elements) => {
        if (this.inlineLegend()) return;
        const key = this.keys()[elements[0]?.index];
        if (key) this.selected.emit(key);
      },
    };
  });
  readonly accessibleRows = computed(() => {
    const taskColor = this._taskColors();
    return this.labels().map((label, index) => {
      const value = this.series().reduce(
        (total, series) => total + (series.values[index] ?? 0),
        0,
      );
      return {
        label,
        key: this.keys()[index],
        value,
        color: this.series()[0]?.colorKeys?.[index]
          ? taskColor(this.series()[0].colorKeys![index])
          : undefined,
        valueLabel: this._formatValue(value),
      };
    });
  });

  readonly taskLegend = computed(() => {
    const color = this._taskColors();
    return this.series()
      .filter((series) => series.colorKey)
      .map((series) => ({
        label: series.label,
        color: color(series.colorKey!),
        valueLabel: this._formatValue(
          this.type() === 'line'
            ? (series.values.at(-1) ?? 0)
            : series.values.reduce((sum, value) => sum + value, 0),
        ),
      }));
  });

  private _formatValue(value: number): string {
    if (this.unit() === 'rounds') return String(value);
    const seconds = Math.floor(Math.round(value * 3600000) / 1000);
    const minutes = Math.floor(seconds / 60);
    const duration = `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}min`;
    return this.detailList()
      ? duration + String(seconds % 60).padStart(2, '0') + 's'
      : duration;
  }
}
