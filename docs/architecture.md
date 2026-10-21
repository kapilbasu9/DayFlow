
# DayFlow Architecture

## Overview

DayFlow is a client-side personal productivity application built with HTML, CSS, and Vanilla JavaScript ES modules.

The application currently uses browser `localStorage` for persistence. It has no backend, account system, cloud synchronization, or payment integration.

The architecture should evolve incrementally. Keep shared business logic in services, keep page-specific interactions in modules, and preserve existing stored-data compatibility when making changes.

## Application Pages

- `index.html` — public landing page.
- `pages/dashboard.html` — task overview, daily activity, and quick actions.
- `pages/tasks.html` — task creation, editing, completion, deletion, filtering, and search.
- `pages/calendar.html` — monthly calendar, date selection, daily agenda, and task completion.
- `pages/shopping.html` — shopping-list and shopping-item management.
- `pages/settings.html` — theme, workspace name, local-data counts, data clearing, and backup/restore.

## JavaScript Modules

### Application-level modules

- `js/app.js` — landing-page navigation, mobile menu behavior, and current-year display.
- `js/appPreferences.js` — initializes the theme and displays the workspace name and avatar across application pages.

### Page modules

- `js/modules/dashboard.js` — renders the Dashboard and handles task-related actions.
- `js/modules/tasks.js` — handles the task form, editing, filtering, searching, and rendering.
- `js/modules/calendar.js` — handles calendar navigation, date selection, agenda rendering, and task completion.
- `js/modules/shopping.js` — manages shopping lists, items, item editing, purchase status, and page refreshes.
- `js/modules/settings.js` — manages preferences, local-data counts, data clearing, backup downloads, and restore operations.

Page modules should use the relevant services rather than duplicate persistence and validation logic.

## Services

### `js/services/taskService.js`

Owns task persistence and CRUD operations.

Exports:

- `getTasks()`
- `addTask(taskData)`
- `updateTask(taskId, updates)`
- `deleteTask(taskId)`
- `TaskStorageError`

The service validates stored task data, rejects invalid records and duplicate IDs, validates supported updates, and reports storage failures.

### `js/services/calendarService.js`

Provides calendar-specific operations using the shared task service.

Exports:

- `getCalendarTasks()`
- `dateKey(date)`
- `parseCalendarDate(dateString)`
- `getCalendarTasksForDate(date, tasks)`
- `updateCalendarTaskCompletion(taskId, completed)`

Calendar data is derived from shared task records. It does not use a separate calendar-task storage collection.

### `js/services/shoppingService.js`

Owns shopping-list and item persistence, validation, and CRUD operations.

Exports:

- `getShoppingLists()`
- `createShoppingList(name)`
- `renameShoppingList(listId, name)`
- `deleteShoppingList(listId)`
- `addShoppingItem(listId, itemData)`
- `updateShoppingItem(listId, itemId, updates)`
- `deleteShoppingItem(listId, itemId)`
- `ShoppingStorageError`

List and item IDs are validated for uniqueness across the shopping data collection.

### `js/services/themeService.js`

Owns preference persistence and theme behavior.

Exports:

- `getPreferences()`
- `applyTheme(theme)`
- `setTheme(theme)`
- `setWorkspaceName(name)`
- `initTheme()`

The service validates preference values and emits `dayflow:preferences-changed` after successful preference changes. It also reacts to relevant browser `storage` events to synchronize preference displays across tabs.

### `js/services/backupService.js`

Owns backup creation, download, validation, and restoration.

It supports full backups and selective Tasks, Calendar, and Shopping backups. Restore operations validate backup content before replacing stored data and include recovery logic for unsuccessful writes.

Exports:

- `createBackupData()`
- `downloadBackup()`
- `validateBackupText(text)`
- `restoreBackupText(text)`
- `downloadTasksBackup()`
- `downloadCalendarBackup()`
- `downloadShoppingBackup()`
- `validateSelectiveBackupText(text, expectedType)`
- `restoreSelectiveBackupText(text, expectedType)`
- `BackupError`

Keep backup validation and restoration rules centralized in this service rather than reimplementing them in page modules.


## Utilities and Components

The current application does not use separate shared utility or header, sidebar, and footer component modules.

Page-specific behavior remains within the existing page modules. Introduce shared utilities or components only when there is a clear, repeated responsibility to centralize.

Before extracting shared logic, verify that existing pages continue to behave consistently and that relative module imports remain valid.


## Storage Keys

DayFlow currently persists data under these keys:

- `dayflow.tasks.v1` — task records.
- `dayflow.shopping.v1` — shopping lists and their items.
- `dayflow.preferences.v1` — theme and workspace preferences.

These keys form part of the current stored-data compatibility contract. Do not rename them or change record structures casually.

When stored-data schemas change, define defaults and compatibility behavior, then test existing records and restore behavior.

## Data Flow

1. A page module calls the relevant service.
2. The service validates and reads the relevant stored data.
3. A successful operation writes the updated data.
4. The page module renders the current data and reports operation results.
5. Dashboard, Tasks, and Calendar use the same task service, so task changes remain consistent when the relevant page is refreshed or re-rendered.
6. Shopping data is stored independently of task data.
7. Preference changes are propagated using `dayflow:preferences-changed`.
8. Successful restore operations notify the current page through `dayflow:data-restored`, allowing page modules to refresh.
9. Data-clearing behavior uses `dayflow:data-cleared` to notify modules in the current tab.
10. Browser `storage` events handle applicable changes made by another tab in the same origin.

## Data Safety Rules

- Services own persistence and validation; avoid duplicating storage logic in page modules.
- Treat missing storage keys as valid empty/default states where appropriate.
- Do not silently replace unreadable or malformed stored data with empty collections.
- Validate imported backup content before changing any stored data.
- Require explicit confirmation before replacing existing data with a backup.
- Report failed writes instead of displaying a success message.
- Use text-based DOM APIs for user-provided values where possible.
- Preserve existing task, shopping, and preference data shapes unless a documented schema change is necessary.
- Keep recovery backups available before testing destructive data operations.
- Do not claim recovery is complete if rollback itself fails.

## Current Capabilities

The application currently includes:

- Task CRUD and supported task filtering/search.
- Monthly calendar navigation and a date-specific task agenda.
- Shopping-list and shopping-item CRUD.
- Light/dark theme and workspace-name preferences.
- Local-data counts and clearing.
- Full and selective backup/restore.
- Responsive page layouts and navigation.
- Cross-tab synchronization for supported storage changes.

## Known Limitations and Future Work

The following are not currently implemented as complete features:

- Automated test suite.
- Recurring tasks and task reminders.
- Subtasks and richer task notes.
- Account-based synchronization and shared family workspaces.
- Backend services and cloud storage.
- Payment or subscription functionality.

These capabilities should be introduced incrementally, with testing and documented data-model changes where required.

## Quality Assurance

Manual testing has covered navigation, CRUD operations, preference persistence, calendar behavior, backup/restore, responsive layouts, and selected cross-tab behaviors.

Manual checks are useful but do not replace repeatable automated tests. The testing phase should establish automated coverage for service validation, CRUD behavior, storage failures, date handling, and backup/restore safety before major features are added.