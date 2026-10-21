
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  addTask,
  deleteTask,
  getTasks,
  TaskStorageError,
  updateTask,
} from "../js/services/taskService.js";

const TASKS_KEY = "dayflow.tasks.v1";

const storageState = {
  values: new Map(),
  failRead: false,
  failWrite: false,
};

const memoryStorage = {
  getItem(key) {
    if (storageState.failRead) {
      throw new Error("Simulated storage read failure");
    }

    return storageState.values.has(key)
      ? storageState.values.get(key)
      : null;
  },

  setItem(key, value) {
    if (storageState.failWrite) {
      throw new Error("Simulated storage write failure");
    }

    storageState.values.set(key, String(value));
  },

  removeItem(key) {
    storageState.values.delete(key);
  },

  clear() {
    storageState.values.clear();
  },
};

// Use an isolated in-memory substitute for browser localStorage.
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: memoryStorage,
});

beforeEach(() => {
  storageState.values.clear();
  storageState.failRead = false;
  storageState.failWrite = false;
});

test("adding a task applies defaults and persists it", () => {
  const task = addTask({ title: "Prepare weekly report" });

  assert.equal(task.title, "Prepare weekly report");
  assert.equal(task.category, "Personal");
  assert.equal(task.dueDate, "");
  assert.equal(task.priority, "Medium");
  assert.equal(task.completed, false);
  assert.ok(task.id);
  assert.ok(!Number.isNaN(Date.parse(task.createdAt)));

  const saved = JSON.parse(storageState.values.get(TASKS_KEY));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, task.id);
});

test("getTasks sorts dated tasks before undated tasks", () => {
  addTask({
    title: "Later task",
    dueDate: "2026-10-25",
  });

  addTask({
    title: "Undated task",
  });

  addTask({
    title: "Earlier task",
    dueDate: "2026-10-21",
  });

  assert.deepEqual(
    getTasks().map((task) => task.title),
    ["Earlier task", "Later task", "Undated task"],
  );
});

test("updating a task persists supported changes", () => {
  const task = addTask({ title: "Original title" });

  const updated = updateTask(task.id, {
    title: "Updated title",
    priority: "High",
    completed: true,
  });

  assert.equal(updated.title, "Updated title");
  assert.equal(updated.priority, "High");
  assert.equal(updated.completed, true);

  const saved = getTasks();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].title, "Updated title");
  assert.equal(saved[0].completed, true);
});

test("updating an unknown task returns null", () => {
  assert.equal(
    updateTask("missing-task-id", { completed: true }),
    null,
  );
});

test("deleting a task removes it and reports whether it existed", () => {
  const task = addTask({ title: "Temporary task" });

  assert.equal(deleteTask(task.id), true);
  assert.equal(getTasks().length, 0);
  assert.equal(deleteTask(task.id), false);
});

test("invalid titles, dates, and update fields are rejected", () => {
  assert.throws(
    () => addTask({ title: "   " }),
    TaskStorageError,
  );

  assert.throws(
    () => addTask({
      title: "Invalid date",
      dueDate: "2026-02-30",
    }),
    TaskStorageError,
  );

  const task = addTask({ title: "Valid task" });

  assert.throws(
    () => updateTask(task.id, { id: "changed-id" }),
    TaskStorageError,
  );

  assert.throws(
    () => updateTask(task.id, { title: "   " }),
    TaskStorageError,
  );

  assert.equal(getTasks()[0].id, task.id);
});

test("corrupted saved JSON is rejected without being overwritten", () => {
  const corruptedValue = "{invalid-json";
  storageState.values.set(TASKS_KEY, corruptedValue);

  assert.throws(
    () => getTasks(),
    TaskStorageError,
  );

  assert.throws(
    () => addTask({ title: "Must not overwrite corruption" }),
    TaskStorageError,
  );

  assert.equal(
    storageState.values.get(TASKS_KEY),
    corruptedValue,
  );
});

test("duplicate stored task IDs are rejected", () => {
  const duplicateTask = {
    id: "duplicate-id",
    title: "Duplicate",
    category: "Personal",
    dueDate: "",
    priority: "Medium",
    completed: false,
    createdAt: "2026-10-20T10:00:00.000Z",
  };

  storageState.values.set(
    TASKS_KEY,
    JSON.stringify([duplicateTask, duplicateTask]),
  );

  assert.throws(
    () => getTasks(),
    TaskStorageError,
  );
});

test("storage read failures are reported", () => {
  storageState.failRead = true;

  assert.throws(
    () => getTasks(),
    TaskStorageError,
  );
});

test("storage write failures are reported without saving success", () => {
  storageState.failWrite = true;

  assert.throws(
    () => addTask({ title: "Cannot be saved" }),
    TaskStorageError,
  );

  assert.equal(storageState.values.has(TASKS_KEY), false);
});