
# DayFlow Data Model

## Purpose

This document describes the current browser-stored data shapes and the compatibility rules for future changes.

DayFlow currently stores tasks, shopping lists, and workspace preferences in `localStorage`. The application does not currently provide account-based synchronization or cloud storage.

## 1. Tasks

**Storage key:** `dayflow.tasks.v1`

The task collection is a JSON array.

```js
{
  id: "unique-task-id",
  title: "Prepare weekly report",
  category: "Work",
  dueDate: "2026-10-23",
  priority: "medium",
  completed: false,
  createdAt: "2026-10-20T10:00:00.000Z"
}
```

### Fields

- `id` — non-empty task identifier. IDs must be unique within the task collection.
- `title` — non-empty task title.
- `category` — category text.
- `dueDate` — valid `YYYY-MM-DD` date string, or an empty string when no date is assigned.
- `priority` — priority text. The current task UI uses `low`, `medium`, and `high`.
- `completed` — boolean completion status.
- `createdAt` — non-empty creation timestamp string.

The service exports:

- `getTasks()`
- `addTask(taskData)`
- `updateTask(taskId, updates)`
- `deleteTask(taskId)`

The service validates the full collection when reading and writing it. Supported updates are limited to `title`, `category`, `dueDate`, `priority`, and `completed`.

Dashboard, Tasks, and Calendar share the same task records. Calendar tasks are not stored in a separate collection.

## 2. Shopping Lists and Items

**Storage key:** `dayflow.shopping.v1`

The stored value is a JSON array of shopping lists.

### Shopping-list record

```js
{
  id: "unique-list-id",
  name: "Weekly groceries",
  createdAt: "2026-10-20T10:00:00.000Z",
  items: []
}
```

Fields:

- `id` — non-empty list identifier, unique across shopping-list and item IDs.
- `name` — non-empty list name.
- `createdAt` — non-empty creation timestamp string.
- `items` — array of shopping-item records.

### Shopping-item record

```js
{
  id: "unique-item-id",
  name: "Apples",
  quantity: 2,
  unit: "kg",
  purchased: false,
  createdAt: "2026-10-20T10:05:00.000Z"
}
```

Fields:

- `id` — non-empty item identifier, unique across shopping-list and item IDs.
- `name` — non-empty item name.
- `quantity` — non-negative finite number or compatible non-negative numeric string. The field is optional for backward compatibility.
- `unit` — text when provided. The field is optional for backward compatibility.
- `purchased` — boolean indicating whether the item has been purchased.
- `createdAt` — non-empty creation timestamp string.

The service exports:

- `getShoppingLists()`
- `createShoppingList(name)`
- `renameShoppingList(listId, name)`
- `deleteShoppingList(listId)`
- `addShoppingItem(listId, itemData)`
- `updateShoppingItem(listId, itemId, updates)`
- `deleteShoppingItem(listId, itemId)`

Supported item updates are limited to `name`, `quantity`, `unit`, and `purchased`.

## 3. Preferences

**Storage key:** `dayflow.preferences.v1`

The preferences object currently contains:

```js
{
  theme: "light",
  workspaceName: "Guest workspace"
}
```

Fields:

- `theme` — either `light` or `dark`.
- `workspaceName` — non-empty workspace display name, limited to 60 characters when changed through the preference service.

Defaults:

- Theme: `light`
- Workspace name: `Guest workspace`

The theme service exports:

- `getPreferences()`
- `applyTheme(theme)`
- `setTheme(theme)`
- `setWorkspaceName(name)`
- `initTheme()`

Preference changes are announced using the `dayflow:preferences-changed` event. The service also listens for changes to the preference storage key made in another tab.

## 4. Backup Format

Full backups use a versioned JSON envelope.

```js
{
  app: "DayFlow",
  version: 1,
  exportedAt: "2026-10-20T10:30:00.000Z",
  data: {
    tasks: [],
    shoppingLists: [],
    preferences: {
      theme: "light",
      workspaceName: "Guest workspace"
    }
  }
}
```

- `app` identifies the application.
- `version` identifies the backup format version.
- `exportedAt` records when the backup was exported.
- `data` contains the task collection, shopping lists and items, and preferences.

The backup service supports:

- Full backup export and restore.
- Tasks-only backup export and restore.
- Calendar-only backup export and restore.
- Shopping-only backup export and restore.

Selective restores intentionally affect only their supported data scope. Calendar backups contain dated tasks, while calendar-only restoration preserves existing tasks without due dates.

The backup service validates backup content before restoration and includes rollback handling for unsuccessful storage writes. Always keep an additional backup before testing destructive recovery scenarios.

## 5. Storage and Compatibility Rules

1. Preserve the existing storage keys unless a documented migration is necessary.
2. Preserve compatible record shapes when adding features.
3. Define defaults for new optional fields so existing records remain usable.
4. Validate stored and imported data before relying on it.
5. Reject invalid collections without intentionally overwriting the original stored value.
6. Validate the entire relevant backup before changing stored data.
7. Require explicit confirmation before replacing current data.
8. Test failed writes and rollback behavior where practical.
9. Document any changes to stored records and backup formats.
10. Never treat a successful export alone as proof that a restore will succeed; test the complete recovery path.

## 6. Planned Extensions

These are future ideas and are not part of the current persisted data model:

- Recurring task rules.
- Subtasks and task notes.
- Tags, scheduled start times, and estimated durations.
- Reminder and notification preferences.
- Shared household lists and cloud-synchronized workspaces.

Before adding these fields, define their behavior, validation rules, compatibility defaults, and backup/restore behavior.

## 7. Testing Requirements

Future automated tests should cover:

- Empty, valid, malformed, and invalid stored collections.
- Duplicate identifiers and invalid task dates.
- Shopping items with optional or legacy quantity/unit fields.
- Preference defaults and invalid values.
- Full and selective backup validation.
- Restores that preserve data outside the selected scope.
- Failed storage writes and rollback behavior.
- Compatibility with backups created before a schema change.

Manual testing remains useful, but it does not replace repeatable automated tests.