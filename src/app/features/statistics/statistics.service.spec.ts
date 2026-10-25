import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { StatisticsService } from './statistics.service';
import { selectAllMetrics } from '../metric/store/metric.selectors';
import { selectAllProjects } from '../project/store/project.selectors';
import { appendFocusSession } from '../metric/focus-session.util';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';

describe('StatisticsService', () => {
  beforeEach(() => {
    const metric = appendFocusSession({ id: '2026-10-24' }, 60000, {
      id: 'round',
      duration: 60000,
      allocations: [
        {
          taskId: 'deleted-task',
          projectId: 'archived-project',
          projectTitle: 'Recorded project',
          duration: 60000,
        },
      ],
    });
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          selectors: [
            { selector: selectAllMetrics, value: [metric] },
            { selector: selectAllProjects, value: [] },
          ],
        }),
        {
          provide: DataInitStateService,
          useValue: { isAllDataLoadedInitially$: of(true) },
        },
      ],
    });
  });
  it('keeps historical projects available after the live project is removed', () => {
    const service = TestBed.inject(StatisticsService);
    expect(service.projects()).toEqual([
      { id: 'archived-project', title: 'Recorded project' },
    ]);
    expect(service.firstDay()).toBe('2026-10-24');
    expect(service.loaded()).toBeTrue();
  });

  it('assigns distinct task color slots from history rather than selector ordering', () => {
    const service = TestBed.inject(StatisticsService);
    const original = new Map(service.taskColorSlots());
    const newMetric = appendFocusSession({ id: '2026-10-25' }, 1000, {
      id: 'later-round',
      duration: 1000,
      allocations: [{ taskId: 'new-task', duration: 1000 }],
    });
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectAllMetrics, [newMetric, ...service.metrics()]);
    store.refreshState();
    expect(service.taskColorSlots().get('task:deleted-task')).toBe(
      original.get('task:deleted-task'),
    );
    expect(service.taskColorSlots().get('task:new-task')).not.toBe(
      original.get('task:deleted-task'),
    );
  });
});
