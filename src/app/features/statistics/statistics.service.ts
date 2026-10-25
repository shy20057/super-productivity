import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { selectAllMetrics } from '../metric/store/metric.selectors';
import { selectAllProjects } from '../project/store/project.selectors';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { getFocusSessionEntries } from '../metric/focus-session.util';
import { statisticsTaskKey } from './statistics-colors';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly _store = inject(Store);
  readonly metrics = this._store.selectSignal(selectAllMetrics);
  // All history determines slots; date/project filters and task ranking never do.
  readonly taskColorSlots = computed(() => {
    const slots = new Map<string, number>();
    const metrics = [...this.metrics()].sort((a, b) => a.id.localeCompare(b.id));
    for (const metric of metrics) {
      for (const record of getFocusSessionEntries(metric)) {
        for (const allocation of record.details?.allocations ?? []) {
          if (!allocation.taskId || allocation.duration <= 0) continue;
          const key = statisticsTaskKey(allocation.taskId);
          if (!slots.has(key)) slots.set(key, slots.size);
        }
      }
    }
    return slots;
  });
  private readonly _projects = this._store.selectSignal(selectAllProjects);
  readonly loaded = toSignal(inject(DataInitStateService).isAllDataLoadedInitially$, {
    initialValue: false,
  });
  readonly firstDay = computed(
    () =>
      this.metrics()
        .filter((metric) => metric.focusSessions?.length)
        .map((metric) => metric.id)
        .sort()[0],
  );
  readonly projects = computed(() => {
    const options = new Map(
      this._projects().map((project) => [project.id, project.title]),
    );
    for (const metric of this.metrics()) {
      for (const record of getFocusSessionEntries(metric)) {
        for (const allocation of record.details?.allocations ?? []) {
          if (allocation.projectId && !options.has(allocation.projectId)) {
            options.set(
              allocation.projectId,
              allocation.projectTitle ?? allocation.projectId,
            );
          }
        }
      }
    }
    return [...options].map(([id, title]) => ({ id, title }));
  });
}
