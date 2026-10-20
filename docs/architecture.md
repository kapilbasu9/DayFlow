# DayFlow Architecture

## Goals

DayFlow is a client-side productivity app built with vanilla HTML, CSS, and JavaScript ES modules. Keep the current architecture and evolve it incrementally. The current persistence mechanism is browser `localStorage`; no backend or cloud sync is configured.

## Main areas

### Pages

- `index.html` — public landing page.
- `pages/dashboard.html` — overview of tasks due today and quick actions.
- `pages/tasks.html` — task creation and management.
- `pages/calendar.html` — monthly calendar and selected-day agenda.
- `pages/shopping.html` — shopping lists and items.
- `pages/settings.html` — theme, workspace name, local-data counts, and data clearing.

### Page modules

- `js/app.js` — landing page behavior.
- `js/modules/dashboard.js` — Dashboard rendering and task completion actions.
- `js/modules/tasks.js` — task form, editing, filtering, search, and rendering.
- `js/modules/calendar.js` — month navigation, date selection, agenda, and task completion.
- `js/modules/shopping.js` — shopping-list and item interactions.
- `js/modules/settings.js` — preferences UI, local-data counts, and clear-data workflow.
- `js/appPreferences.js` — initializes theme and renders the workspace name/avatar across pages.

### Services

- `js/services/taskService.js` — task persistence and task CRUD operations.
- `js/services/shoppingService.js` — shopping-list and item persistence/CRUD.
- `js/services/themeService.js` — preference persistence, theme application, and cross-tab preference updates.
- `js/services/calendarService.js` currently exists but is empty and is not required by the current calendar module.

### Utilities and components

`js/utils/dateUtils.js`, `js/utils/domUtils.js`, and the component files in `js/components/` currently exist but are empty. Do not create parallel helpers until there is a concrete repeated responsibility to centralize.

## Data flow

1. A page module reads or changes data through the relevant service.
2. The service reads and writes its own `localStorage` key.
3. The page module re-renders from the service's returned/current data.
4. Dashboard, Tasks, and Calendar share the task service, so task status and due-date changes should appear consistently when a page renders or is revisited.
5. Shopping data is independent of task data.
6. Theme/workspace preferences are stored separately and initialized by `appPreferences.js` on each page.

## Storage keys

- `dayflow.tasks.v1`
- `dayflow.shopping.v1`
- `dayflow.preferences.v1`

These keys are part of the current persisted-data contract. Do not rename or change their shapes casually. A schema change should include compatibility handling and tests.

## Safe change rules

- Keep data access in services rather than duplicating `localStorage` logic in page modules.
- Validate data read from storage because browser storage can be malformed or manually edited.
- Do not silently treat corrupted data as an empty dataset and then overwrite it. Preserve the raw value where possible and provide a recoverable error path.
- For import/restore, validate the entire backup before changing any current storage key, and require explicit user confirmation before replacing current data.
- Make storage writes fail visibly to the caller; do not display success if persistence failed.
- Keep DOM output safe by using text APIs for user-provided values rather than injecting them as HTML.
- Test existing CRUD behavior after each change.

## Planned extension points

The following are future ideas, not implemented features: backup/restore service, storage/record validation helpers, data migration, recurring tasks, subtasks, tags, My Day, focus sessions, habits, notes, and statistics. Add these incrementally only when needed.
