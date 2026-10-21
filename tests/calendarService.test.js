import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  addTask,
  getTasks,
} from "../js/services/taskService.js";

import {
  dateKey,
  parseCalendarDate,
  getCalendarTasks,
  getCalendarTasksForDate,
  updateCalendarTaskCompletion,
} from "../js/services/calendarService.js";

const TASKS_KEY = "dayflow.tasks.v1";

const values = new Map();

const memoryStorage = {
  getItem(key) {
    return values.has(key) ? values.get(key) : null;
  },

  setItem(key, value) {
    values.set(key, String(value));
  },

  removeItem(key) {
    values.delete(key);
  },

  clear() {
    values.clear();
  },
};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: memoryStorage,
});

beforeEach(() => {
  values.clear();
});

test("dateKey formats a local calendar date as YYYY-MM-DD", () => {
  assert.equal(dateKey(new Date(2026, 9, 21)), "2026-10-21");
});

test("dateKey rejects invalid Date values", () => {
  assert.throws(() => dateKey(new Date("invalid")), TypeError);
  assert.throws(() => dateKey("2026-10-21"), TypeError);
});

test("parseCalendarDate accepts canonical valid dates", () => {
  const parsed = parseCalendarDate("2028-02-29");

  assert.ok(parsed instanceof Date);
  assert.equal(dateKey(parsed), "2028-02-29");
  assert.equal(parsed.getHours(), 0);
  assert.equal(parsed.getMinutes(), 0);
});

test("parseCalendarDate returns null for invalid or noncanonical dates", () => {
  assert.equal(parseCalendarDate("2026-02-29"), null);
  assert.equal(parseCalendarDate("2026-13-01"), null);
  assert.equal(parseCalendarDate("2026-04-31"), null);
  assert.equal(parseCalendarDate("26-04-01"), null);
  assert.equal(parseCalendarDate("2026/04/01"), null);
  assert.equal(parseCalendarDate(null), null);
});

test("calendar date filtering returns only tasks for the selected date", () => {
  const first = addTask({
    title: "Prepare report",
    dueDate: "2026-10-21",
  });

  addTask({
    title: "Attend meeting",
    dueDate: "2026-10-22",
  });

  addTask({
    title: "No scheduled date",
  });

  const results = getCalendarTasksForDate(
    new Date(2026, 9, 21),
    getTasks(),
  );

  assert.deepEqual(results.map((task) => task.id), [first.id]);
});

test("calendar date filtering requires an array of tasks", () => {
  assert.throws(
    () => getCalendarTasksForDate(new Date(2026, 9, 21), null),
    TypeError,
  );
});

test("getCalendarTasks uses the shared task collection", () => {
  addTask({
    title: "Calendar task",
    dueDate: "2026-10-21",
  });

  assert.equal(getCalendarTasks().length, 1);
  assert.equal(getTasks().length, 1);
});

test("calendar completion updates the shared task record", () => {
  const task = addTask({
    title: "Finish assignment",
    dueDate: "2026-10-21",
  });

  const updated = updateCalendarTaskCompletion(task.id, true);

  assert.equal(updated.completed, true);
  assert.equal(getTasks()[0].completed, true);
});

test("calendar completion rejects a non-boolean status", () => {
  const task = addTask({ title: "Valid task" });

  assert.throws(
    () => updateCalendarTaskCompletion(task.id, "yes"),
    TypeError,
  );

  assert.equal(getTasks()[0].completed, false);
});

test("calendar completion returns null for an unknown task", () => {
  assert.equal(
    updateCalendarTaskCompletion("missing-task", true),
    null,
  );
});
