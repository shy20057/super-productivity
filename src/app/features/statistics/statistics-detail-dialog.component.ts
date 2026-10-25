import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatDialogClose } from '@angular/material/dialog';
import { MatButton } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { StatisticsTimelineComponent } from './statistics-timeline.component';
import { FocusSessionRecord } from '../metric/focus-session.model';
import { T } from '../../t.const';

export interface StatisticsDialogData {
  title: string;
  kind: 'records' | 'rules' | 'legacy';
  records?: FocusSessionRecord[];
}

@Component({
  selector: 'statistics-detail-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    TranslatePipe,
    StatisticsTimelineComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      @if (data.kind === 'records') {
        <statistics-timeline [records]="records()" />
        @if ((data.records?.length ?? 0) > 50) {
          <div>
            <button
              mat-button
              type="button"
              [disabled]="page() === 0"
              (click)="page.set(page() - 1)"
            >
              {{ T.F.STATISTICS.PREVIOUS | translate }}
            </button>
            <span>{{ page() + 1 }}</span>
            <button
              mat-button
              type="button"
              [disabled]="(page() + 1) * 50 >= (data.records?.length ?? 0)"
              (click)="page.set(page() + 1)"
            >
              {{ T.F.STATISTICS.NEXT | translate }}
            </button>
          </div>
        }
      } @else if (data.kind === 'rules') {
        <p>{{ T.F.STATISTICS.RULES_DESCRIPTION | translate }}</p>
        <p>{{ T.F.STATISTICS.ATTRIBUTION_DESCRIPTION | translate }}</p>
        <p>{{ T.F.STATISTICS.PROJECT_DESCRIPTION | translate }}</p>
      } @else {
        <p>{{ T.F.STATISTICS.LEGACY_DESCRIPTION | translate }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        mat-dialog-close
      >
        {{ T.G.CLOSE | translate }}
      </button>
    </mat-dialog-actions>
  `,
})
export class StatisticsDetailDialogComponent {
  readonly data = inject<StatisticsDialogData>(MAT_DIALOG_DATA);
  readonly T = T;
  readonly page = signal(0);
  readonly records = computed(
    () => this.data.records?.slice(this.page() * 50, (this.page() + 1) * 50) ?? [],
  );
}
