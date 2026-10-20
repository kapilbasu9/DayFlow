
import { applyTheme } from "./themeService.js";

const STORAGE_KEYS = {
  tasks: "dayflow.tasks.v1",
  shopping: "dayflow.shopping.v1",
  preferences: "dayflow.preferences.v1",
};

const BACKUP_APP = "DayFlow";
const BACKUP_VERSION = 1;

const DEFAULT_PREFERENCES = {
  theme: "light",
  workspaceName: "Guest workspace",
};

const SELECTIVE_BACKUP_TYPES = ["tasks", "calendar", "shopping"];

export class BackupError extends Error {
  constructor(message) {
    super(message);
    this.name = "BackupError";
  }
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function cloneData(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function readStoredJSON(key, fallback) {
  let raw;

  try {
    raw = localStorage.getItem(key);
  } catch {
    throw new BackupError(
      "DayFlow could not access browser storage. Check your browser settings.",
    );
  }

  if (raw === null) {
    return cloneData(fallback);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new BackupError(
      `Saved data for "${key}" is not valid JSON. Fix or recover it before creating a backup.`,
    );
  }
}

function isValidDateKey(value) {
  if (value === "") return true;

  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidTask(task) {
  return (
    isObject(task) &&
    typeof task.id === "string" &&
    task.id.trim() !== "" &&
    typeof task.title === "string" &&
    task.title.trim() !== "" &&
    typeof task.category === "string" &&
    typeof task.dueDate === "string" &&
    isValidDateKey(task.dueDate) &&
    typeof task.priority === "string" &&
    typeof task.completed === "boolean" &&
    typeof task.createdAt === "string" &&
    task.createdAt.trim() !== ""
  );
}

function validateTasks(tasks) {
  if (!Array.isArray(tasks)) {
    throw new BackupError(
      "The backup contains invalid task data. No data was restored.",
    );
  }

  const ids = new Set();

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];

    if (!isValidTask(task)) {
      throw new BackupError(
        `Task record ${index + 1} is invalid. No data was restored.`,
      );
    }

    if (ids.has(task.id)) {
      throw new BackupError(
        "The backup contains duplicate task IDs. No data was restored.",
      );
    }

    ids.add(task.id);
  }

  return tasks;
}

function isValidBackupQuantity(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0;
  }

  if (typeof value === "string") {
    // Empty quantities remain supported for older backups.
    if (value.trim() === "") return true;

    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue >= 0;
  }

  return false;
}

function validateShoppingLists(lists) {
  if (!Array.isArray(lists)) {
    throw new BackupError(
      "The backup contains invalid shopping-list data.",
    );
  }

  // IDs must be unique across lists and items, not just within each list.
  const allIds = new Set();

  for (const list of lists) {
    if (
      !isObject(list) ||
      typeof list.id !== "string" ||
      !list.id.trim() ||
      typeof list.name !== "string" ||
      !list.name.trim() ||
      typeof list.createdAt !== "string" ||
      !list.createdAt.trim() ||
      !Array.isArray(list.items)
    ) {
      throw new BackupError(
        "A shopping list in the backup is invalid.",
      );
    }

    if (allIds.has(list.id)) {
      throw new BackupError(
        "The backup contains duplicate shopping IDs.",
      );
    }

    allIds.add(list.id);

    for (const item of list.items) {
      if (
        !isObject(item) ||
        typeof item.id !== "string" ||
        !item.id.trim() ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        typeof item.purchased !== "boolean" ||
        typeof item.createdAt !== "string" ||
        !item.createdAt.trim()
      ) {
        throw new BackupError(
          `A shopping item in "${list.name}" is invalid.`,
        );
      }

      if (allIds.has(item.id)) {
        throw new BackupError(
          `The backup contains a duplicate shopping ID in "${list.name}".`,
        );
      }

      allIds.add(item.id);

      if (
        item.quantity !== undefined &&
        !isValidBackupQuantity(item.quantity)
      ) {
        throw new BackupError(
          `An item in "${list.name}" has an invalid quantity.`,
        );
      }

      // Empty unit strings are supported for optional form selections.
      if (
        item.unit !== undefined &&
        typeof item.unit !== "string"
      ) {
        throw new BackupError(
          `An item in "${list.name}" has an invalid unit.`,
        );
      }
    }
  }

  return lists;
}

function validatePreferences(preferences) {
  if (
    !isObject(preferences) ||
    !["light", "dark"].includes(preferences.theme) ||
    typeof preferences.workspaceName !== "string" ||
    !preferences.workspaceName.trim() ||
    preferences.workspaceName.trim().length > 60
  ) {
    throw new BackupError(
      "The backup contains invalid workspace preferences.",
    );
  }

  return {
    theme: preferences.theme,
    workspaceName: preferences.workspaceName.trim(),
  };
}

function validateBackup(backup) {
  if (
    !isObject(backup) ||
    backup.app !== BACKUP_APP ||
    backup.version !== BACKUP_VERSION ||
    !isObject(backup.data)
  ) {
    throw new BackupError(
      "This is not a supported DayFlow backup file.",
    );
  }

  const { tasks, shoppingLists, preferences } = backup.data;

  validateTasks(tasks);
  validateShoppingLists(shoppingLists);
  const cleanPreferences = validatePreferences(preferences);

  return {
    tasks,
    shoppingLists,
    preferences: cleanPreferences,
  };
}

function readCurrentPreferences() {
  const saved = readStoredJSON(
    STORAGE_KEYS.preferences,
    DEFAULT_PREFERENCES,
  );

  if (!isObject(saved)) {
    throw new BackupError(
      "Saved workspace preferences have an invalid structure. Recover them before creating a backup.",
    );
  }

  // Keep only the currently supported preference fields.
  const preferences = {
    theme: saved.theme === "dark" ? "dark" : "light",
    workspaceName:
      typeof saved.workspaceName === "string" &&
      saved.workspaceName.trim()
        ? saved.workspaceName.trim()
        : DEFAULT_PREFERENCES.workspaceName,
  };

  validatePreferences(preferences);
  return preferences;
}

/**
 * Read and validate all current data before exporting.
 */
export function createBackupData() {
  const tasks = readStoredJSON(STORAGE_KEYS.tasks, []);
  const shoppingLists = readStoredJSON(STORAGE_KEYS.shopping, []);
  const preferences = readCurrentPreferences();

  const backup = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      tasks,
      shoppingLists,
      preferences,
    },
  };

  validateBackup(backup);

  return backup;
}

/**
 * Download a versioned JSON backup.
 */
export function downloadBackup() {
  const backup = createBackupData();

  return downloadJSON(
    backup,
    `dayflow-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
}

function downloadJSON(data, filename) {
  let blobUrl;

  try {
    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" },
    );

    blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;

    document.body.append(link);
    link.click();
    link.remove();
  } catch {
    throw new BackupError(
      "DayFlow could not create the download. Please try again.",
    );
  } finally {
    if (blobUrl) {
      // Defer URL cleanup so the browser can begin processing the download.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }
  }

  return data;
}

/**
 * Parse and validate backup text without changing saved data.
 */
export function validateBackupText(text) {
  if (typeof text !== "string") {
    throw new BackupError("The selected backup file could not be read.");
  }

  let backup;

  try {
    backup = JSON.parse(text);
  } catch {
    throw new BackupError(
      "The selected file is not valid JSON. Your saved data was not changed.",
    );
  }

  return validateBackup(backup);
}

function getPreviousValues(keys) {
  const previous = {};

  try {
    for (const [name, key] of Object.entries(keys)) {
      previous[name] = localStorage.getItem(key);
    }
  } catch {
    throw new BackupError(
      "DayFlow could not access your existing data. Nothing was restored.",
    );
  }

  return previous;
}

function restorePreviousValues(keys, previousValues) {
  let rollbackSucceeded = true;

  for (const [name, key] of Object.entries(keys)) {
    try {
      const previousValue = previousValues[name];

      if (previousValue === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, previousValue);
      }
    } catch {
      rollbackSucceeded = false;
    }
  }

  return rollbackSucceeded;
}

function writeStorageValues(keys, values, previousValues) {
  try {
    for (const name of Object.keys(keys)) {
      localStorage.setItem(keys[name], values[name]);
    }
  } catch {
    const rollbackSucceeded = restorePreviousValues(
      keys,
      previousValues,
    );

    if (!rollbackSucceeded) {
      throw new BackupError(
        "Restore failed, and some previous data could not be recovered. Check browser storage immediately.",
      );
    }

    throw new BackupError(
      "Restore failed because browser storage could not save the backup. Your previous data was restored.",
    );
  }
}

function dispatchRestoreEvents(preferences = null) {
  try {
    if (preferences) {
      window.dispatchEvent(
        new CustomEvent("dayflow:preferences-changed", {
          detail: { ...preferences },
        }),
      );
    }
  } catch (error) {
    console.error(
      "Backup data was restored, but a preferences refresh event failed:",
      error,
    );
  }

  try {
    window.dispatchEvent(new CustomEvent("dayflow:data-restored"));
  } catch (error) {
    console.error(
      "Backup data was restored, but a data refresh event failed:",
      error,
    );
  }
}

function applyRestoredTheme(theme) {
  try {
    applyTheme(theme);
  } catch (error) {
    console.error(
      "Backup data was restored, but applying the theme failed:",
      error,
    );
  }
}

/**
 * Restore a validated full backup.
 * Attempts rollback if a storage write fails.
 */
export function restoreBackupText(text) {
  const data = validateBackupText(text);

  const previousValues = getPreviousValues(STORAGE_KEYS);

  const newValues = {
    tasks: JSON.stringify(data.tasks),
    shopping: JSON.stringify(data.shoppingLists),
    preferences: JSON.stringify(data.preferences),
  };

  writeStorageValues(STORAGE_KEYS, newValues, previousValues);

  // Storage restore has succeeded. UI side effects must not misreport
  // the data restore as failed.
  applyRestoredTheme(data.preferences.theme);
  dispatchRestoreEvents(data.preferences);

  return {
    taskCount: data.tasks.length,
    listCount: data.shoppingLists.length,
    itemCount: data.shoppingLists.reduce(
      (total, list) => total + list.items.length,
      0,
    ),
  };
}

function createSelectiveBackup(type, data) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    backupType: type,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/**
 * Export tasks only.
 */
export function downloadTasksBackup() {
  const tasks = readStoredJSON(STORAGE_KEYS.tasks, []);
  validateTasks(tasks);

  const backup = createSelectiveBackup("tasks", { tasks });

  return downloadJSON(
    backup,
    `dayflow-tasks-${new Date().toISOString().slice(0, 10)}.json`,
  );
}

/**
 * Export dated tasks for Calendar.
 * Calendar shares the task storage collection.
 */
export function downloadCalendarBackup() {
  const tasks = readStoredJSON(STORAGE_KEYS.tasks, []);
  validateTasks(tasks);

  const calendarTasks = tasks.filter(
    (task) => task.dueDate !== "",
  );

  const backup = createSelectiveBackup("calendar", {
    tasks: calendarTasks,
  });

  return downloadJSON(
    backup,
    `dayflow-calendar-${new Date().toISOString().slice(0, 10)}.json`,
  );
}

/**
 * Export shopping lists and their items.
 */
export function downloadShoppingBackup() {
  const shoppingLists = readStoredJSON(STORAGE_KEYS.shopping, []);
  validateShoppingLists(shoppingLists);

  const backup = createSelectiveBackup("shopping", {
    shoppingLists,
  });

  return downloadJSON(
    backup,
    `dayflow-shopping-${new Date().toISOString().slice(0, 10)}.json`,
  );
}

/**
 * Validate a selective backup without changing browser storage.
 */
export function validateSelectiveBackupText(text, expectedType) {
  if (!SELECTIVE_BACKUP_TYPES.includes(expectedType)) {
    throw new BackupError("Unsupported selective backup type.");
  }

  if (typeof text !== "string") {
    throw new BackupError("The selected backup file could not be read.");
  }

  let backup;

  try {
    backup = JSON.parse(text);
  } catch {
    throw new BackupError(
      "The selected file is not valid JSON. Your saved data was not changed.",
    );
  }

  if (
    !isObject(backup) ||
    backup.app !== BACKUP_APP ||
    backup.version !== BACKUP_VERSION ||
    backup.backupType !== expectedType ||
    !isObject(backup.data)
  ) {
    throw new BackupError(
      `Select a valid DayFlow ${expectedType}-only backup file.`,
    );
  }

  if (expectedType === "tasks" || expectedType === "calendar") {
    const tasks = validateTasks(backup.data.tasks);

    if (
      expectedType === "calendar" &&
      tasks.some((task) => task.dueDate === "")
    ) {
      throw new BackupError(
        "The calendar backup contains tasks without due dates.",
      );
    }

    return { tasks };
  }

  const shoppingLists = validateShoppingLists(
    backup.data.shoppingLists,
  );

  return { shoppingLists };
}

/**
 * Restore a selective backup.
 *
 * Tasks: replace all tasks.
 * Calendar: replace dated tasks and preserve undated tasks.
 * Shopping: replace shopping lists only.
 */
export function restoreSelectiveBackupText(text, expectedType) {
  const data = validateSelectiveBackupText(text, expectedType);

  const storageKey =
    expectedType === "shopping"
      ? STORAGE_KEYS.shopping
      : STORAGE_KEYS.tasks;

  const singleStorageKeys = { data: storageKey };
  const previousValues = getPreviousValues(singleStorageKeys);

  let nextValue;

  if (expectedType === "shopping") {
    nextValue = data.shoppingLists;
  } else if (expectedType === "tasks") {
    nextValue = data.tasks;
  } else {
    const currentTasks = readStoredJSON(STORAGE_KEYS.tasks, []);
    validateTasks(currentTasks);

    const undatedTasks = currentTasks.filter(
      (task) => task.dueDate === "",
    );

    const undatedIds = new Set(
      undatedTasks.map((task) => task.id),
    );

    if (data.tasks.some((task) => undatedIds.has(task.id))) {
      throw new BackupError(
        "The calendar backup conflicts with an existing undated task ID. No data was changed.",
      );
    }

    nextValue = [...undatedTasks, ...data.tasks];
    validateTasks(nextValue);
  }

  writeStorageValues(
    singleStorageKeys,
    { data: JSON.stringify(nextValue) },
    previousValues,
  );

  dispatchRestoreEvents();

  if (expectedType === "shopping") {
    return {
      type: "shopping",
      listCount: nextValue.length,
      itemCount: nextValue.reduce(
        (total, list) => total + list.items.length,
        0,
      ),
    };
  }

  return {
    type: expectedType,
    taskCount: data.tasks.length,
    preservedUndatedTaskCount:
      expectedType === "calendar"
        ? nextValue.length - data.tasks.length
        : 0,
  };
}