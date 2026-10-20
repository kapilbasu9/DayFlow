# DayFlow Data Model

This document describes the current persisted record shapes observed in the project. Treat these shapes as the compatibility baseline for future changes.

## Tasks

**Storage key:** `dayflow.tasks.v1`

The current task creation flow stores records with these fields:

```js
{
  id,
  title,
  category,
  dueDate,
  priority,
  completed,
  createdAt
}
```

- `id` — task identifier.
- `title` — task title.
- `category` — optional category text.
- `dueDate` — date string or empty value when no date is set.
- `priority` — current UI options are `low`, `medium`, and `high`.
- `completed` — completion state.
- `createdAt` — creation timestamp.

The task service exports `getTasks()`, `addTask(task)`, `updateTask(taskId, updates)`, and `deleteTask(taskId)`. Dashboard, Tasks, and Calendar use this shared service.

## Shopping lists

**Storage key:** `dayflow.shopping.v1`

Each list has the following shape:

```js
{
  id,
  name,
  createdAt,
  items: []
}
```

Each item currently has this shape:

```js
{
  id,
  name,
  quantity,
  unit,
  purchased,
  createdAt
}
```

The shopping service exports list operations (`getShoppingLists`, `createShoppingList`, `renameShoppingList`, `deleteShoppingList`) and item operations (`addShoppingItem`, `updateShoppingItem`, `deleteShoppingItem`).

## Preferences

**Storage key:** `dayflow.preferences.v1`

```js
{
  theme: "light", // or "dark"
  workspaceName: "Guest workspace"
}
```

The theme service provides `getPreferences`, `applyTheme`, `setTheme`, `setWorkspaceName`, and `initTheme`. The workspace name is trimmed and limited to 60 characters by the service.

## Schema evolution rules

1. Preserve current storage keys unless there is a compelling reason to change them.
2. Add new fields with safe defaults so existing records remain usable.
3. Validate records before relying on fields or rendering them.
4. If a breaking transformation is required, version the data format and migrate old records explicitly.
5. Never overwrite an unreadable or invalid stored value with an empty array as an automatic recovery strategy.
6. Add tests for old records, partially missing fields, invalid records, and failed storage writes.

## Planned fields (not yet implemented)

Possible task additions include notes/description, tags, subtasks, recurrence rules, scheduled start time, and estimated duration. Do not add these fields until the desired behavior and migration defaults are defined.
