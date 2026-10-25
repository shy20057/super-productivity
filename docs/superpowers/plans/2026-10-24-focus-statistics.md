# Focus Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build real task-attributed ended-focus-round statistics with day/week/month/year/all views.

**Architecture:** Extend existing METRIC duration logging with optional, verifiable session metadata. A local draft tracks task allocations using the existing timer. Shared pure aggregation feeds one lazy statistics route and reusable chart/timeline/calendar components.

**Tech Stack:** Angular standalone components, NgRx, Signals, Chart.js, existing Material inputs/dialogs, CSS theme variables.

**Spec:** ../specs/2026-10-24-focus-statistics-design.md (approved 2026-10-24).

## Global Constraints

- User explicitly declined test execution; write meaningful specs but do not run tests.
- User permits formatting, lint and build checks. Use quiet wrapper for lint.
- Reuse existing timer and completion operation; never complete a task automatically.
- End-day attribution through DateService; old data has no invented task or timestamps.
- No root dependencies, containers, public APIs, schema-version bump or agent-control edits.
- Preserve unrelated untracked src/assets/i18n/zh-wip.json.
- New persisted fields optional with runtime defaults. Metadata never counts as additional duration.
- Development stays on a codex feature branch; no push, merge or release.

## Review Focus

1. Old clients rewriting numeric arrays must invalidate task attribution rather than mislabel sessions.
2. Same round switching tasks must conserve elapsed duration and count once globally.
3. Pauses, cancellation and recovery must not create records or include inactive time.
4. Logical-day/year/DST boundaries must not shift historical attribution during replay.
5. Deleting/renaming tasks must not erase history; metadata remains a snapshot.

## Task 1: Compatible session metadata and editing

**Files:** features/metric/focus-session.model.ts, focus-session.util.ts and .spec.ts;
metric.model.ts; store/metric.actions.ts, metric.reducer.ts and reducer specs;
metric.service.ts; dialog-focus-session-edit component.

**Interfaces:** FocusSessionEntry, FocusTaskAllocation; getFocusSessionEntries(metric),
getFocusSessionsSignature(durations), appendFocusSession(metric, duration, entry?),
editFocusSessionEntries(metric, edits). Legacy durations remain authoritative.

- [x] Write focused specs for legacy fallback, mismatched signatures and duplicate
      session ids. Review manual editing/removal statically; runtime regression is deferred.
- [x] Implement optional metadata plus source-array signature. Missing/stale metadata
      produces unknown entries; duration is never counted twice.
- [x] Extend existing LogFocusSession payload with an optional entry and atomically
      append duration and verified metadata on one METRIC entity.
- [x] Update manual edit dialog to retain identities of unchanged records; edits whose
      allocation no longer matches become unclassified.
- [x] Test execution deferred per user's instruction.

## Task 2: Capture ended focus rounds

**Files:** features/focus-mode/focus-session-tracker.service.ts and .spec.ts;
focus-mode-storage.service.ts; core/persistence/storage-keys.const.ts;
focus-mode/store/focus-mode.effects.ts.

**Interfaces:** tracker.observe(timer, mode, task, projectTitle, now?),
tracker.finish(duration, isManual, now?) -> FocusSessionEntry | undefined,
tracker.cancel(). Locally recoverable draft; no in-progress synced writes.

- [x] Write focused specs for task switching, paused gaps, cancellation, recovery
      without a local draft and Flowtime completion semantics.
- [x] Observe local timer and task transitions. Attribute elapsed deltas to prior
      selected task; snapshot labels; reconcile final elapsed into the same round.
- [x] On existing completeFocusSession event, pass one entry to logFocusSession.
      Skip completion without a draft to prevent duplicate logs. Recovered rounds
      with a draft retain unknown allocations instead of inventing attribution.
- [x] Persist only the local draft, reuse storage conventions and avoid constructor
      subscriptions; remote actions cannot generate records.
- [x] Test execution deferred; retain all current timer semantics.

## Task 3: Pure aggregations

**Files:** features/statistics/statistics.model.ts, statistics.util.ts and .spec.ts,
statistics.service.ts.

**Interfaces:** getStatisticsRange(view, anchor, today, firstDayOfWeek),
aggregateFocusStatistics(metrics, range, projectId?) -> StatisticsSummary;
statistics service exposes reactive metrics, project options and loading state.

- [x] Write focused specs for end-day attribution, legacy data and same-round
      multi-task/project counts and duration conservation. Additional calendar-boundary
      and distribution regressions remain part of deferred test verification.
- [x] Produce daily/monthly totals, project/task distributions, timeline records,
      length histogram, weekday averages, end-time matrix and cumulative monthly trend.
- [x] Filter by allocation duration; count each qualifying session once; do not sum
      task participation counts as distinct rounds.
- [x] Use local date arithmetic, injected logical today and existing locale week start.
- [x] Test execution deferred.

## Task 4: Five real views and accessible charts

**Files:** features/statistics/statistics-page.component.ts/.html/.scss;
statistics-chart.component.ts/.html/.scss; statistics-timeline.component.ts/.html/.scss;
statistics-calendar.component.ts/.html/.scss; statistics-detail-dialog.component.ts.

**Interfaces:** chart accepts typed series and emits selected date/month; timeline
accepts recorded session entries; calendar accepts daily totals and emits date.

- [x] Build shared controls and summary with URL-backed view/date/project selection.
- [x] Implement daily timeline/distribution/details; weekly stacked days,
      task allocations/length distribution/recent rounds; monthly primary calendar/weekday;
      yearly calendar heatmap/monthly bars/end-time matrix; all-time cumulative/monthly
      trend/project and task composition.
- [x] Reuse lazy Chart.js, Angular bindings and Material dialog focus handling.
      Task participation uses bars when overlapping, never misleading pie proportions.
- [x] Add empty/loading states, legacy explanations, exact data tables, keyboard
      graph navigation and mobile stacking. Use only theme variables.
- [x] Use real store data only; do not transplant demo data or placeholder totals.

## Task 5: Navigation, translation and documentation

**Files:** app.routes.ts; core-ui/magic-side-nav/magic-nav-config.service.ts;
assets/i18n/en.json; generated t.const.ts; relevant wiki reference.

- [x] Add statistics menu entry and a directly lazy-loaded /statistics route.
- [x] Add all copy to en.json and regenerate T through tools/extract-i18n-single.js.
      Keep the user's zh-wip file untouched; Chinese label availability is handled
      through the existing translation workflow rather than hardcoded UI strings.
- [x] Document end-day ownership, focus vs task completion, project filters,
      unknown legacy data and manual edit behavior.

## Task 6: Checks and fresh review

- [x] Run one quiet checkFile call for all modified TS/SCSS, inspect every failure.
- [x] Run development app build (no test or preCheck script), inspect output.
- [x] Review diffs and optional persisted fields; use a fresh reviewer instructed
      not to run tests. Fix material findings and repeat checks only as needed.
- [x] Inspect the locally running application with real empty/available data,
      distinguishing manual UI inspection from test-suite execution.
- [x] Report changed behavior, check results, unrun tests and remaining limits.
      No commit/push/merge unless separately requested.
