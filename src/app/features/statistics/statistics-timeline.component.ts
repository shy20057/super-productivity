import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { FocusSessionRecord } from '../metric/focus-session.model';
import { MsToStringPipe } from '../../ui/duration/ms-to-string.pipe';
import { T } from '../../t.const';
import { statisticsTaskKey } from './statistics-colors';
import { injectStatisticsTaskColors } from './statistics-task-colors';

@Component({
  selector: 'statistics-timeline',
  imports: [DatePipe, TranslatePipe, MsToStringPipe],
  templateUrl: './statistics-timeline.component.html',
  styleUrl: './statistics-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsTimelineComponent {
  private readonly _taskColors = injectStatisticsTaskColors();
  readonly T = T;
  readonly records = input.required<FocusSessionRecord[]>();
  readonly showAxis = input(false);
  readonly selected = output<FocusSessionRecord>();
  readonly entries = computed(() =>
    this.records().map((record) => {
      const details = record.details;
      const tasks = details?.allocations.map((item) => item.taskTitle).filter(Boolean);
      const known = details?.startedAt !== undefined && details.endedAt !== undefined;
      const pause = known
        ? Math.max(0, details!.endedAt! - details!.startedAt! - details!.duration)
        : 0;
      const color = this._taskColors();
      const segments = (details?.allocations ?? [{ duration: record.duration }])
        .filter((allocation) => allocation.duration > 0)
        .map((allocation) => ({
          color: color(statisticsTaskKey(allocation.taskId, !details)),
          title: allocation.taskTitle ?? allocation.taskId,
          duration: allocation.duration,
        }));
      let offset = 0;
      const stops = segments.map((segment) => {
        const start = offset;
        offset += (segment.duration / record.duration) * 100;
        return `${segment.color} ${start}% ${offset}%`;
      });
      return {
        ...record,
        title: tasks?.join(' / '),
        known,
        pause,
        segments,
        background:
          segments.length === 1
            ? segments[0].color
            : `linear-gradient(to right, ${stops.join(', ')})`,
      };
    }),
  );
  readonly axis = computed(() => {
    const known = this.entries().filter((entry) => entry.known);
    if (!known.length) return null;
    const start =
      Math.floor(Math.min(...known.map((entry) => entry.details!.startedAt!)) / 3600000) *
      3600000;
    const end = Math.max(
      start + 3600000,
      Math.ceil(Math.max(...known.map((entry) => entry.details!.endedAt!)) / 3600000) *
        3600000,
    );
    return {
      ticks: Array.from({ length: 6 }, (_, i) => {
        const offset = ((end - start) * i) / 5;
        return start + offset;
      }),
      bars: known.map((entry) => ({
        ...entry,
        left: ((entry.details!.startedAt! - start) / (end - start)) * 100,
        width:
          ((entry.details!.endedAt! - entry.details!.startedAt!) / (end - start)) * 100,
      })),
    };
  });
}
