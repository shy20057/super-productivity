import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import {
  addMetric,
  deleteMetric,
  updateMetric,
  upsertMetric,
  logFocusSession,
} from './metric.actions';
import { Metric, MetricState } from '../metric.model';
import { loadAllData } from '../../../root-store/meta/load-all-data.action';
import { createReducer, on } from '@ngrx/store';
import { DEFAULT_METRIC_FOR_DAY } from '../metric.const';
import { appendFocusSession } from '../focus-session.util';

export const METRIC_FEATURE_NAME = 'metric';
export const metricAdapter: EntityAdapter<Metric> = createEntityAdapter<Metric>();

export const initialMetricState: MetricState = metricAdapter.getInitialState({
  // additional entity state properties
});

export const metricReducer = createReducer<MetricState>(
  initialMetricState,

  on(loadAllData, (state, { appDataComplete }) =>
    appDataComplete.metric?.ids ? appDataComplete.metric : state,
  ),

  on(addMetric, (state, { metric }) => metricAdapter.addOne(metric, state)),

  on(updateMetric, (state, { metric }) => {
    const existing = state.entities[metric.id as string];
    if (existing) {
      return metricAdapter.updateOne(metric, state);
    }
    // If entity doesn't exist, create it with defaults + changes
    return metricAdapter.upsertOne(
      {
        id: metric.id as string,
        ...DEFAULT_METRIC_FOR_DAY,
        ...metric.changes,
      },
      state,
    );
  }),

  on(upsertMetric, (state, { metric }) => metricAdapter.upsertOne(metric, state)),

  on(deleteMetric, (state, { id }) => metricAdapter.removeOne(id, state)),

  on(logFocusSession, (state, { day, duration, entry }) => {
    if (duration <= 0) {
      return state;
    }

    const existing = state.entities[day];
    const metric = existing ?? { id: day, ...DEFAULT_METRIC_FOR_DAY };
    const updated = appendFocusSession(metric, duration, entry);
    return updated === existing ? state : metricAdapter.upsertOne(updated, state);
  }),
);
