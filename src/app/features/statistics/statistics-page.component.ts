import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter } from '@angular/material/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map, startWith } from 'rxjs/operators';
import { timer } from 'rxjs';
import { StatisticsService } from './statistics.service';
import { StatisticsGroup, StatisticsPoint, StatisticsView } from './statistics.model';
import {
  aggregateFocusStatistics,
  getStatisticsRange,
  parseStatisticsDate,
  statisticsDateKey,
} from './statistics.util';
import {
  StatisticsChartComponent,
  StatisticsChartSeries,
} from './statistics-chart.component';
import { StatisticsCalendarComponent } from './statistics-calendar.component';
import { StatisticsTimelineComponent } from './statistics-timeline.component';
import {
  StatisticsDetailDialogComponent,
  StatisticsDialogData,
} from './statistics-detail-dialog.component';
import { FocusSessionRecord } from '../metric/focus-session.model';
import { DateService } from '../../core/date/date.service';
import { DateTimeFormatService } from '../../core/date-time-format/date-time-format.service';
import { MsToStringPipe } from '../../ui/duration/ms-to-string.pipe';
import { T } from '../../t.const';
import { statisticsTaskKey } from './statistics-colors';

interface ChartModel {
  labels: string[];
  series: StatisticsChartSeries[];
  keys: string[];
}

const VIEWS: StatisticsView[] = ['day', 'week', 'month', 'year', 'all'];

@Component({
  selector: 'statistics-page',
  imports: [
    TranslatePipe,
    MsToStringPipe,
    MatButton,
    MatIconButton,
    MatIcon,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    StatisticsChartComponent,
    StatisticsCalendarComponent,
    StatisticsTimelineComponent,
  ],
  templateUrl: './statistics-page.component.html',
  styleUrl: './statistics-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsPageComponent {
  readonly T = T;
  readonly service = inject(StatisticsService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _date = inject(DateService);
  private readonly _adapter = inject(DateAdapter);
  private readonly _translate = inject(TranslateService);
  private readonly _dialog = inject(MatDialog);
  readonly locale = inject(DateTimeFormatService).currentLocale;
  private readonly _language = toSignal(
    this._translate.onLangChange.pipe(startWith(null)),
  );
  private readonly _dateLocale = toSignal(
    this._adapter.localeChanges.pipe(startWith(null)),
  );
  private readonly _query = toSignal(this._route.queryParamMap, {
    initialValue: this._route.snapshot.queryParamMap,
  });
  readonly today = toSignal(timer(0, 60000).pipe(map(() => this._date.todayStr())), {
    initialValue: this._date.todayStr(),
  });
  readonly view = computed<StatisticsView>(() => {
    const view = this._query().get('view') as StatisticsView;
    return VIEWS.includes(view) ? view : 'week';
  });
  readonly anchor = computed(() => {
    const value = this._query().get('date');
    return value &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      statisticsDateKey(parseStatisticsDate(value)) === value &&
      value <= this.today()
      ? value
      : this.today();
  });
  readonly projectId = computed(() => this._query().get('project') || undefined);
  readonly anchorDate = computed(() => parseStatisticsDate(this.anchor()));
  readonly todayDate = computed(() => parseStatisticsDate(this.today()));
  readonly pickerStartView = computed(() =>
    this.view() === 'year' ? 'multi-year' : this.view() === 'month' ? 'year' : 'month',
  );
  readonly firstDayOfWeek = computed(() => {
    this._dateLocale();
    return this._adapter.getFirstDayOfWeek();
  });
  readonly range = computed(() =>
    getStatisticsRange(
      this.view(),
      this.anchor(),
      this.today(),
      this.firstDayOfWeek(),
      this.service.firstDay() ?? this.today(),
    ),
  );
  readonly summary = computed(() =>
    aggregateFocusStatistics(this.service.metrics(), this.range(), this.projectId()),
  );
  readonly viewOptions = computed(() => {
    this._language();
    return VIEWS.map((id, i) => ({
      id,
      label: [
        T.F.STATISTICS.DAY,
        T.F.STATISTICS.WEEK,
        T.F.STATISTICS.MONTH,
        T.F.STATISTICS.YEAR,
        T.F.STATISTICS.ALL,
      ][i],
    }));
  });
  readonly headingRange = computed(() => {
    const range = this.range();
    const options: Intl.DateTimeFormatOptions =
      this.view() === 'year'
        ? { year: 'numeric' }
        : this.view() === 'month'
          ? { year: 'numeric', month: 'long' }
          : { year: 'numeric', month: 'short', day: 'numeric' };
    const formatter = new Intl.DateTimeFormat(this.locale(), options);
    const first = formatter.format(parseStatisticsDate(range.first));
    return ['day', 'month', 'year'].includes(this.view())
      ? first
      : first + ' — ' + formatter.format(parseStatisticsDate(range.last));
  });
  readonly futureDisabled = computed(
    () => this.view() === 'all' || this.range().last >= this.today(),
  );
  readonly recent = computed(() => this.summary().sessions.slice(0, 20));

  readonly trend = computed<ChartModel>(() => {
    this._language();
    const isMonth = this.view() === 'all';
    const points = this._trendPoints();
    return {
      labels: points.map((point) =>
        point.key.length === 4
          ? point.key
          : new Intl.DateTimeFormat(
              this.locale(),
              isMonth
                ? { month: 'short', year: '2-digit' }
                : { month: 'short', day: 'numeric' },
            ).format(
              parseStatisticsDate(point.key.length === 7 ? point.key + '-01' : point.key),
            ),
      ),
      keys: points.map((point) => (point.future ? '' : point.key)),
      series: this._taskSeries(points),
    };
  });
  readonly cumulative = computed<ChartModel>(() => {
    this._language();
    const points = this._trendPoints();
    return {
      labels: points.map((point) => point.key),
      keys: points.map((point) => point.key),
      series: this._taskSeries(points, true),
    };
  });
  readonly taskChart = computed(() => this._groupChart(this.summary().tasks));
  setView(view: StatisticsView): void {
    this._navigate({ view });
  }
  setDate(date: string): void {
    this._navigate({ date });
  }
  selectCalendarDate(date: Date | null): void {
    if (date && !Number.isNaN(date.getTime())) this.setDate(statisticsDateKey(date));
  }
  selectCalendarMonth(date: Date, picker: MatDatepicker<Date>): void {
    if (this.view() !== 'month') return;
    this.selectCalendarDate(date);
    picker.close();
  }
  selectCalendarYear(date: Date, picker: MatDatepicker<Date>): void {
    if (this.view() !== 'year') return;
    this.selectCalendarDate(date);
    picker.close();
  }
  setProject(project: string): void {
    this._navigate({ project: project || null });
  }
  resetPeriod(): void {
    this._navigate({ date: this.today() });
  }
  shiftPeriod(amount: number): void {
    const view = this.view();
    const date = parseStatisticsDate(this.anchor());
    if (view === 'day' || view === 'week') {
      const days = amount * (view === 'week' ? 7 : 1);
      date.setDate(date.getDate() + days);
    } else if (view === 'month') {
      date.setDate(1);
      date.setMonth(date.getMonth() + amount);
    } else if (view === 'year') {
      date.setDate(1);
      date.setFullYear(date.getFullYear() + amount);
    } else return;
    this.setDate(
      statisticsDateKey(date) > this.today() ? this.today() : statisticsDateKey(date),
    );
  }
  drill(key: string): void {
    if (key.length === 4) this._navigate({ view: 'year', date: key + '-01-01' });
    else
      this._navigate({
        view: key.length === 7 ? 'month' : 'day',
        date: key.length === 7 ? key + '-01' : key,
      });
  }
  openRecord(record: FocusSessionRecord): void {
    this._open({
      kind: 'records',
      title: this._translate.instant(T.F.STATISTICS.SESSION_DETAILS),
      records: [record],
    });
  }
  openAllRounds(): void {
    this._open({
      kind: 'records',
      title: this._translate.instant(T.F.STATISTICS.SESSION_DETAILS),
      records: this.summary().sessions,
    });
  }
  openInfo(kind: 'rules' | 'legacy'): void {
    this._open({
      kind,
      title: this._translate.instant(
        kind === 'rules' ? T.F.STATISTICS.RULES : T.F.STATISTICS.LEGACY,
      ),
    });
  }
  startFocus(): void {
    void this._router.navigate(['/tag', 'TODAY', 'tasks']);
  }

  private _open(data: StatisticsDialogData): void {
    this._dialog.open(StatisticsDetailDialogComponent, {
      data,
      width: '800px',
      maxWidth: '95vw',
    });
  }
  private _navigate(query: Record<string, string | null>): void {
    void this._router.navigate([], {
      relativeTo: this._route,
      queryParams: query,
      queryParamsHandling: 'merge',
    });
  }
  private _groupLabel(group: StatisticsGroup): string {
    this._language();
    return (
      group.title ??
      this._translate.instant(
        group.kind === 'legacy' ? T.F.STATISTICS.LEGACY : T.F.STATISTICS.UNASSIGNED,
      )
    );
  }
  private _groupChart(groups: StatisticsGroup[]): ChartModel {
    this._language();
    const labels = groups.map((group) => this._groupLabel(group));
    const values = groups.map((group) => group.duration / 3600000);
    const keys = groups.map((group) => group.id);
    return {
      labels,
      keys,
      series: [
        {
          label: this._translate.instant(T.F.STATISTICS.TOTAL_TIME),
          values,
          colorKeys: groups.map((group) =>
            statisticsTaskKey(
              group.kind === 'known' ? group.id : undefined,
              group.kind === 'legacy',
            ),
          ),
        },
      ],
    };
  }
  private _trendPoints(): StatisticsPoint[] {
    const summary = this.summary();
    if (this.view() !== 'all') return summary.daily;
    const monthly = summary.monthly;
    if (this.view() !== 'all' || monthly.length <= 36) return monthly;
    const years = new Map<string, StatisticsPoint>();
    for (const month of monthly) {
      const key = month.key.slice(0, 4);
      const year = years.get(key) ?? {
        key,
        duration: 0,
        count: 0,
        future: false,
        projects: {},
        tasks: {},
      };
      year.duration += month.duration;
      year.count += month.count;
      for (const [id, value] of Object.entries(month.tasks))
        year.tasks[id] = (year.tasks[id] ?? 0) + value;
      for (const [id, value] of Object.entries(month.projects))
        year.projects[id] = (year.projects[id] ?? 0) + value;
      years.set(key, year);
    }
    return [...years.values()];
  }

  private _taskSeries(
    points: StatisticsPoint[],
    cumulative = false,
  ): StatisticsChartSeries[] {
    return this.summary().tasks.map((task) => {
      const colorKey = statisticsTaskKey(
        task.kind === 'known' ? task.id : undefined,
        task.kind === 'legacy',
      );
      let total = 0;
      return {
        label: this._groupLabel(task),
        colorKey,
        values: points.map((point) => {
          const duration = point.tasks[colorKey] ?? 0;
          total = cumulative ? total + duration : duration;
          return total / 3600000;
        }),
      };
    });
  }
}
