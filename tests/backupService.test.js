import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

const TASKS_KEY = "dayflow.tasks.v1";
const SHOPPING_KEY = "dayflow.shopping.v1";
const PREFERENCES_KEY = "dayflow.preferences.v1";

const state = {
  values: new Map(),
  writeAttempts: 0,
  failAtWrite: null,
  failRead: false,
};

const memoryStorage = {
  getItem(key) {
    if (state.failRead) {
      throw new Error("Simulated storage read failure");
    }

    return state.values.has(key) ? state.values.get(key) : null;
  },

  setItem(key, value) {
    state.writeAttempts += 1;

    if (state.failAtWrite === state.writeAttempts) {
      state.failAtWrite = null;
      throw new Error("Simulated storage write failure");
    }

    state.values.set(key, String(value));
  },

  removeItem(key) {
    state.values.delete(key);
  },

  clear() {
    state.values.clear();
  },
};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: memoryStorage,
});

globalThis.document = {
  documentElement: {
    dataset: {},
    style: {},
  },
};

globalThis.window = new EventTarget();

const dispatchedEvents = [];

for (const eventName of [
  "dayflow:preferences-changed",
  "dayflow:data-restored",
]) {
  window.addEventListener(eventName, () => {
    dispatchedEvents.push(eventName);
  });
}

const {
  BackupError,
  createBackupData,
  validateBackupText,
  restoreBackupText,
  validateSelectiveBackupText,
  restoreSelectiveBackupText,
} = await import("../js/services/backupService.js");

beforeEach(() => {
  state.values.clear();
  state.writeAttempts = 0;
  state.failAtWrite = null;
  state.failRead = false;
  dispatchedEvents.length = 0;
  document.documentElement.dataset = {};
  document.documentElement.style = {};
});

function makeTask(id, title, dueDate = "") {
  return {
    id,
    title,
    category: "Personal",
    dueDate,
    priority: "medium",
    completed: false,
    createdAt: "2026-10-20T10:00:00.000Z",
  };
}

function makeList(id, itemId, name = "Groceries") {
  return {
    id,
    name,
    createdAt: "2026-10-20T10:00:00.000Z",
    items: itemId
      ? [{
          id: itemId,
          name: "Apples",
          quantity: 2,
          unit: "kg",
          purchased: false,
          createdAt: "2026-10-20T10:05:00.000Z",
        }]
      : [],
  };
}

function makeFullBackup() {
  return {
    app: "DayFlow",
    version: 1,
    exportedAt: "2026-10-20T10:30:00.000Z",
    data: {
      tasks: [makeTask("backup-task", "Restored task", "2026-10-24")],
      shoppingLists: [makeList("backup-list", "backup-item")],
      preferences: {
        theme: "dark",
        workspaceName: "Backup workspace",
      },
    },
  };
}

function seedOriginalData() {
  state.values.set(
    TASKS_KEY,
    JSON.stringify([makeTask("old-task", "Keep original task")]),
  );

  state.values.set(
    SHOPPING_KEY,
    JSON.stringify([makeList("old-list", "old-item", "Original list")]),
  );

  state.values.set(
    PREFERENCES_KEY,
    JSON.stringify({
      theme: "light",
      workspaceName: "Original workspace",
    }),
  );
}

test("createBackupData collects and validates all current data", () => {
  seedOriginalData();

  const backup = createBackupData();

  assert.equal(backup.app, "DayFlow");
  assert.equal(backup.version, 1);
  assert.ok(!Number.isNaN(Date.parse(backup.exportedAt)));
  assert.equal(backup.data.tasks[0].id, "old-task");
  assert.equal(backup.data.shoppingLists[0].items[0].id, "old-item");
  assert.equal(backup.data.preferences.workspaceName, "Original workspace");
});

test("createBackupData uses defaults for missing storage keys", () => {
  const backup = createBackupData();

  assert.deepEqual(backup.data.tasks, []);
  assert.deepEqual(backup.data.shoppingLists, []);
  assert.equal(backup.data.preferences.theme, "light");
  assert.equal(
    backup.data.preferences.workspaceName,
    "Guest workspace",
  );
});

test("full backup validation accepts a supported backup", () => {
  const validated = validateBackupText(JSON.stringify(makeFullBackup()));

  assert.equal(validated.tasks.length, 1);
  assert.equal(validated.shoppingLists.length, 1);
  assert.equal(validated.preferences.theme, "dark");
});

test("invalid JSON and unsupported backup formats are rejected", () => {
  assert.throws(
    () => validateBackupText("{invalid-json"),
    BackupError,
  );

  assert.throws(
    () => validateBackupText(JSON.stringify({
      ...makeFullBackup(),
      version: 999,
    })),
    BackupError,
  );

  assert.throws(
    () => validateBackupText(JSON.stringify({
      ...makeFullBackup(),
      app: "OtherApp",
    })),
    BackupError,
  );
});

test("invalid backup data is rejected without changing saved data", () => {
  seedOriginalData();

  const before = new Map(state.values);

  const invalidBackup = makeFullBackup();
  invalidBackup.data.tasks[0].dueDate = "2026-02-30";

  assert.throws(
    () => restoreBackupText(JSON.stringify(invalidBackup)),
    BackupError,
  );

  assert.deepEqual(state.values, before);
});

test("full restore replaces all supported data and updates the theme", () => {
  seedOriginalData();

  const result = restoreBackupText(JSON.stringify(makeFullBackup()));

  assert.equal(result.taskCount, 1);
  assert.equal(result.listCount, 1);
  assert.equal(result.itemCount, 1);

  assert.equal(
    JSON.parse(state.values.get(TASKS_KEY))[0].id,
    "backup-task",
  );

  assert.equal(
    JSON.parse(state.values.get(SHOPPING_KEY))[0].id,
    "backup-list",
  );

  assert.equal(
    JSON.parse(state.values.get(PREFERENCES_KEY)).workspaceName,
    "Backup workspace",
  );

  assert.equal(document.documentElement.dataset.theme, "dark");

  assert.ok(
    dispatchedEvents.includes("dayflow:preferences-changed"),
  );

  assert.ok(
    dispatchedEvents.includes("dayflow:data-restored"),
  );
});

test("Tasks-only restore preserves shopping lists and preferences", () => {
  seedOriginalData();

  const originalShopping = state.values.get(SHOPPING_KEY);
  const originalPreferences = state.values.get(PREFERENCES_KEY);

  const backup = {
    app: "DayFlow",
    version: 1,
    backupType: "tasks",
    exportedAt: "2026-10-20T10:30:00.000Z",
    data: {
      tasks: [makeTask("new-task", "Tasks-only restored")],
    },
  };

  const result = restoreSelectiveBackupText(
    JSON.stringify(backup),
    "tasks",
  );

  assert.equal(result.taskCount, 1);
  assert.equal(JSON.parse(state.values.get(TASKS_KEY))[0].id, "new-task");
  assert.equal(state.values.get(SHOPPING_KEY), originalShopping);
  assert.equal(state.values.get(PREFERENCES_KEY), originalPreferences);
});

test("Calendar-only restore replaces dated tasks and preserves undated tasks", () => {
  seedOriginalData();

  const originalTasks = [
    makeTask("undated-task", "Keep undated task"),
    makeTask("old-dated-task", "Replace dated task", "2026-10-21"),
  ];

  state.values.set(TASKS_KEY, JSON.stringify(originalTasks));

  const backup = {
    app: "DayFlow",
    version: 1,
    backupType: "calendar",
    exportedAt: "2026-10-20T10:30:00.000Z",
    data: {
      tasks: [
        makeTask("new-dated-task", "Restored calendar task", "2026-10-25"),
      ],
    },
  };

  const result = restoreSelectiveBackupText(
    JSON.stringify(backup),
    "calendar",
  );

  const savedTasks = JSON.parse(state.values.get(TASKS_KEY));

  assert.equal(result.taskCount, 1);
  assert.equal(result.preservedUndatedTaskCount, 1);
  assert.deepEqual(
    savedTasks.map((task) => task.id).sort(),
    ["new-dated-task", "undated-task"],
  );
});

test("Shopping-only restore preserves tasks and preferences", () => {
  seedOriginalData();

  const originalTasks = state.values.get(TASKS_KEY);
  const originalPreferences = state.values.get(PREFERENCES_KEY);

  const backup = {
    app: "DayFlow",
    version: 1,
    backupType: "shopping",
    exportedAt: "2026-10-20T10:30:00.000Z",
    data: {
      shoppingLists: [makeList("new-list", "new-item", "Restored list")],
    },
  };

  const result = restoreSelectiveBackupText(
    JSON.stringify(backup),
    "shopping",
  );

  assert.equal(result.listCount, 1);
  assert.equal(result.itemCount, 1);
  assert.equal(state.values.get(TASKS_KEY), originalTasks);
  assert.equal(state.values.get(PREFERENCES_KEY), originalPreferences);
});

test("selective restore rejects a mismatched backup type", () => {
  seedOriginalData();

  const before = new Map(state.values);

  const backup = {
    app: "DayFlow",
    version: 1,
    backupType: "shopping",
    exportedAt: "2026-10-20T10:30:00.000Z",
    data: { shoppingLists: [] },
  };

  assert.throws(
    () => validateSelectiveBackupText(
      JSON.stringify(backup),
      "tasks",
    ),
    BackupError,
  );

  assert.deepEqual(state.values, before);
});

test("failed full restore rolls back previously written storage values", () => {
  seedOriginalData();

  const before = new Map(state.values);

  // Allow the first restore write, then fail the second.
  // Subsequent writes are allowed so rollback can be tested.
  state.failAtWrite = 2;

  assert.throws(
    () => restoreBackupText(JSON.stringify(makeFullBackup())),
    BackupError,
  );

  assert.deepEqual(state.values, before);
  assert.equal(dispatchedEvents.length, 0);
});
