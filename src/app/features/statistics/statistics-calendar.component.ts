import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { StatisticsPoint } from './statistics.model';
import { FocusSessionRecord, FocusTaskAllocation } from '../metric/focus-session.model';
import { parseStatisticsDate } from './statistics.util';
import { msToString, MsToStringPipe } from '../../ui/duration/ms-to-string.pipe';
import { T } from '../../t.const';
import { statisticsTaskKey } from './statistics-colors';
import { injectStatisticsTaskColors } from './statistics-task-colors';

const DAY_DURATION = 24 * 60 * 60 * 1000;

interface CalendarTask {
  id: string;
  title?: string;
  labelKey?: string;
  duration: number;
  color: string;
}

@Component({
  selector: 'statistics-calendar',
  imports: [TranslatePipe, MsToStringPipe, DecimalPipe],
  templateUrl: './statistics-calendar.component.html',
  styleUrl: './statistics-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsCalendarComponent {
  private readonly _taskColors = injectStatisticsTaskColors();
  private readonly _translate = inject(TranslateService);
  private readonly _language = toSignal(this._translate.onLangChange);
  readonly T = T;
  readonly days = input.required<StatisticsPoint[]>();
  readonly records = input<FocusSessionRecord[]>([]);
  readonly annual = input(false);
  readonly firstDayOfWeek = input(1);
  readonly locale = input('en');
  readonly today = input<string>();
  readonly selected = output<string>();
  private readonly _tasksByDay = computed(() => {
    const days = new Map<string, Map<string, CalendarTask>>();
    for (const record of this.records()) {
      const tasks = days.get(record.day) ?? new Map<string, CalendarTask>();
      days.set(record.day, tasks);
      const allocations: readonly FocusTaskAllocation[] = record.details?.allocations ?? [
        { duration: record.duration },
      ];
      for (const allocation of allocations) {
        if (allocation.duration <= 0) continue;
        const id = statisticsTaskKey(allocation.taskId, !record.details);
        const task = tasks.get(id) ?? {
          id,
          title: allocation.taskTitle ?? allocation.taskId,
          labelKey: !record.details
            ? T.F.STATISTICS.LEGACY
            : allocation.taskId
              ? undefined
              : T.F.STATISTICS.UNASSIGNED,
          duration: 0,
          color: '',
        };
        task.duration += allocation.duration;
        tasks.set(id, task);
      }
    }
    return days;
  });
  readonly taskLegend = computed(() => {
    const color = this._taskColors();
    const tasks = new Map<string, CalendarTask>();
    for (const day of this._tasksByDay().values()) {
      for (const task of day.values()) {
        const total = tasks.get(task.id) ?? { ...task, duration: 0 };
        total.duration += task.duration;
        tasks.set(task.id, total);
      }
    }
    // Derive colors from task identity so date and project filters keep them stable.
    return [...tasks.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((task) => ({ ...task, color: color(task.id) }));
  });
  readonly weekdays = computed(() => {
    const formatter = new Intl.DateTimeFormat(this.locale(), { weekday: 'short' });
    return Array.from({ length: 7 }, (_, index) =>
      formatter.format(new Date(2024, 0, 7 + ((this.firstDayOfWeek() + index) % 7), 12)),
    );
  });
  readonly maxDuration = computed(() =>
    this.days().reduce((max, day) => (day.future ? max : Math.max(max, day.duration)), 0),
  );
  readonly annualMonths = computed(() => {
    const days = this.days();
    if (!days.length) return [];
    const offset =
      (parseStatisticsDate(days[0].key).getDay() - this.firstDayOfWeek() + 7) % 7;
    const formatter = new Intl.DateTimeFormat(this.locale(), { month: 'short' });
    return days.flatMap((day, index) =>
      day.key.endsWith('-01')
        ? [
            {
              label: formatter.format(parseStatisticsDate(day.key)),
              column: Math.floor((offset + index) / 7) + 1,
            },
          ]
        : [],
    );
  });
  readonly annualWeekCount = computed(() =>
    Math.max(1, Math.ceil(this.cells().length / 7)),
  );
  readonly cells = computed(() => {
    this._language();
    const days = this.days();
    const offset = days.length
      ? (parseStatisticsDate(days[0].key).getDay() - this.firstDayOfWeek() + 7) % 7
      : 0;
    const max = Math.max(1, this.maxDuration());
    const legend = new Map(this.taskLegend().map((task) => [task.id, task]));
    return [
      ...Array.from({ length: offset }, () => null),
      ...days.map((day) => {
        let ringOffset = 0;
        const segments = [...(this._tasksByDay().get(day.key)?.values() ?? [])]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((task) => {
            // End-day attribution and imported records can exceed 24h. Keep
            // the true total, while fitting their relative shares in one ring.
            const share = (task.duration / Math.max(DAY_DURATION, day.duration)) * 100;
            const segment = {
              ...task,
              color: legend.get(task.id)!.color,
              dasharray: `${share} ${100 - share}`,
              dashoffset: -ringOffset,
            };
            ringOffset += share;
            return segment;
          });
        return {
          ...day,
          segments,
          tooltip: day.future
            ? day.key + ': ' + this._translate.instant(T.F.STATISTICS.FUTURE)
            : [
                day.key,
                this._translate.instant(T.F.STATISTICS.TOTAL_TIME) +
                  ': ' +
                  (day.duration
                    ? msToString(day.duration, true)
                    : '0 ' + this._translate.instant(T.F.STATISTICS.MINUTES)),
                this._translate.instant(T.F.STATISTICS.ROUNDS) + ': ' + day.count,
                ...segments.map(
                  (task) =>
                    (task.labelKey
                      ? this._translate.instant(task.labelKey)
                      : task.title) +
                    ': ' +
                    msToString(task.duration, true),
                ),
              ].join('\n'),
          percentage: (day.duration / DAY_DURATION) * 100,
          date: Number(day.key.slice(-2)),
          level:
            day.duration === 0 ? 0 : Math.max(1, Math.ceil((day.duration / max) * 4)),
        };
      }),
      ...Array.from(
        { length: this.annual() ? 0 : (7 - ((offset + days.length) % 7)) % 7 },
        () => null,
      ),
    ];
  });
}
