import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  getTaskCategories,
  organizeTasks,
} from "../js/services/taskOrganizationService.js";

let tasks;

beforeEach(() => {
  tasks = [
    {
      id: "1",
      title: "Prepare report",
      category: "Work",
      dueDate: "2026-10-26",
      priority: "high",
      completed: false,
      createdAt: "2026-10-20T10:00:00.000Z",
    },
    {
      id: "2",
      title: "Buy groceries",
      category: "Home",
      dueDate: "2026-10-24",
      priority: "medium",
      completed: false,
      createdAt: "2026-10-21T10:00:00.000Z",
    },
    {
      id: "3",
      title: "Read a book",
      category: "Personal",
      dueDate: "",
      priority: "low",
      completed: true,
      createdAt: "2026-10-22T10:00:00.000Z",
    },
    {
      id: "4",
      title: "Review budget",
      category: "Work",
      dueDate: "2026-10-25",
      priority: "medium",
      completed: true,
      createdAt: "2026-10-23T10:00:00.000Z",
    },
    {
      id: "5",
      title: "Call the family",
      category: "",
      dueDate: "",
      priority: "High",
      completed: false,
      createdAt: "2026-10-24T10:00:00.000Z",
    },
  ];
});

test("getTaskCategories returns unique categories alphabetically", () => {
  assert.deepEqual(
    getTaskCategories(tasks),
    ["General", "Home", "Personal", "Work"],
  );
});

test("getTaskCategories rejects a non-array input", () => {
  assert.throws(
    () => getTaskCategories(null),
    TypeError,
  );
});

test("status filter selects pending and completed tasks", () => {
  assert.deepEqual(
    organizeTasks(tasks, { status: "pending" }).map((task) => task.id).sort(),
    ["1", "2", "5"],
  );

  assert.deepEqual(
    organizeTasks(tasks, { status: "completed" }).map((task) => task.id).sort(),
    ["3", "4"],
  );
});

test("category filtering is case-insensitive", () => {
  assert.deepEqual(
    organizeTasks(tasks, { category: "work" }).map((task) => task.id).sort(),
    ["1", "4"],
  );
});

test("blank categories can be filtered as General", () => {
  assert.deepEqual(
    organizeTasks(tasks, { category: "GENERAL" }).map((task) => task.id),
    ["5"],
  );
});

test("priority filtering is case-insensitive", () => {
  assert.deepEqual(
    organizeTasks(tasks, { priority: "HIGH" }).map((task) => task.id).sort(),
    ["1", "5"],
  );
});

test("search matches title, category, and priority", () => {
  assert.deepEqual(
    organizeTasks(tasks, { query: "GROCERIES" }).map((task) => task.id),
    ["2"],
  );

  assert.deepEqual(
    organizeTasks(tasks, { query: "personal" }).map((task) => task.id),
    ["3"],
  );

  assert.deepEqual(
    organizeTasks(tasks, { query: "high" }).map((task) => task.id).sort(),
    ["1", "5"],
  );
});

test("multiple filters are applied together", () => {
  assert.deepEqual(
    organizeTasks(tasks, {
      status: "completed",
      category: "work",
      priority: "medium",
    }).map((task) => task.id),
    ["4"],
  );
});

test("due-date sorting places dated tasks first and undated tasks last", () => {
  assert.deepEqual(
    organizeTasks(tasks, { sortBy: "dueDate" }).map((task) => task.id),
    ["2", "4", "1", "3", "5"],
  );
});

test("priority sorting places high before medium before low", () => {
  assert.deepEqual(
    organizeTasks(tasks, { sortBy: "priority" }).map((task) => task.id),
    ["1", "5", "2", "4", "3"],
  );
});

test("title sorting is alphabetical without case sensitivity", () => {
  assert.deepEqual(
    organizeTasks(tasks, { sortBy: "title" }).map((task) => task.id),
    ["2", "5", "1", "3", "4"],
  );
});

test("createdAt sorting places the newest task first", () => {
  assert.deepEqual(
    organizeTasks(tasks, { sortBy: "createdAt" }).map((task) => task.id),
    ["5", "4", "3", "2", "1"],
  );
});

test("invalid task collections and options are rejected", () => {
  assert.throws(() => organizeTasks(null), TypeError);
  assert.throws(() => organizeTasks(tasks, null), TypeError);
  assert.throws(
    () => organizeTasks(tasks, { status: "archived" }),
    RangeError,
  );
  assert.throws(
    () => organizeTasks(tasks, { priority: "urgent" }),
    RangeError,
  );
  assert.throws(
    () => organizeTasks(tasks, { sortBy: "random" }),
    RangeError,
  );
  assert.throws(
    () => organizeTasks(tasks, { category: 123 }),
    TypeError,
  );
});

test("organization does not mutate the original tasks", () => {
  const original = structuredClone(tasks);

  organizeTasks(tasks, {
    status: "all",
    category: "work",
    sortBy: "title",
  });

  assert.deepEqual(tasks, original);
});

test("equal sort values preserve their original order", () => {
  const sameDateTasks = [
    { ...tasks[0], id: "a", dueDate: "2026-10-25" },
    { ...tasks[1], id: "b", dueDate: "2026-10-25" },
  ];

  assert.deepEqual(
    organizeTasks(sameDateTasks, { sortBy: "dueDate" }).map((task) => task.id),
    ["a", "b"],
  );
});
