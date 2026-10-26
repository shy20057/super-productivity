# Statistics page UI refinement

**Goal:** Improve hierarchy, filter layout, summary cards and empty-state clarity in the existing statistics page, using UI/UX Pro Max and the app's theme tokens.

**Scope:** Presentation only. Preserve statistics aggregation, chart series/colors, routing/query filters, calendar drill-down, privacy and data persistence. Preserve the already-fixed independent period datepicker input/origin. No new dependencies or global Material overrides.

**Design:** A quiet workspace with a strong page title, one date-range control, grouped project/help controls, readable metric labels and large tabular values. Use the existing primary color as a restrained accent, regular spacing and shared card surfaces. The empty state becomes a bounded panel with one clear existing task action. No decorative chart data, animations, new marketing copy or extra dashboard features.

**Skill evidence:** UI/UX Pro Max searches matched font scale and actionable empty states (`ux: empty state typography hierarchy`) and Angular component-local `:host` styling (`angular: component style encapsulation`). General routing/Tailwind search results were rejected as irrelevant to this existing Angular component and repository styling rules.

## Tasks

- [x] Simplify the page header/filters without losing date selection; improve metric labels and primary action structure using existing translations.
- [x] Rework component-local styling for readable typography, restrained emphasis, responsive reflow and light/dark theme tokens.
- [x] Run batched checkFile and compile. User approved isolated local visual checks only: check populated/empty views, narrow screens, dark mode, reduced motion and keyboard/date/project controls without reading or changing real task data.
- [x] Deliver a local preview. No Sites source push or publication before explicit user confirmation that all local edits are complete.

## Verification

- Batched TypeScript/SCSS checkFile passed: `.tmp/logs/checkFile.1793016938926-47988.log`.
- Angular development bundle compiled successfully; frontend restarted at `http://127.0.0.1:4200/` and HTTP 200 confirmed. The production build attempt encountered a Sass worker thread startup failure; production packaging is not claimed as verified in this task.
- Three isolated visual checks passed: `.tmp/logs/e2e-file.1793017296757-35428.log`. Fresh Playwright browser contexts used only synthetic focus records. Covered desktop empty/populated/month views, actual date selection, keyboard opening of the calendar, project dropdown, 375px width, landscape, dark mode, 150% zoom and reduced motion. Checked statistics content for horizontal overflow and inspected screenshots.
- Preview screenshots: `.tmp/statistics-ui-desktop-populated.png`, `.tmp/statistics-ui-mobile-chart.png`, `.tmp/statistics-ui-month.png`, `.tmp/statistics-ui-dark.png`.
- No Sites push/deployment or changes to actual user task data.
