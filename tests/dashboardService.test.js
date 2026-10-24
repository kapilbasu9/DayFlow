import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getDashboardSummary,
} from "../js/services/dashboardService.js";

const TODAY = new Date(2026, 9, 23, 12, 0, 0);

function makeTask(id, dueDate, completed = false) {
  return {
    id,
    title: id,
    category: "Personal",
    dueDate,
    priority: "medium",
    completed,
    createdAt: "2026-10-20T10:00:00.000Z",
  };
}

test("summary separates overdue, today's, future, and undated tasks", () => {
  const tasks = [
    makeTask("overdue-pending", "2026-10-22"),
    makeTask("overdue-completed", "2026-10-20", true),
    makeTask("today-done", "2026-10-23", true),
    makeTask("today-pending", "2026-10-23"),
    makeTask("future", "2026-10-24"),
    makeTask("undated", ""),
  ];

  const summary = getDashboardSummary(tasks, TODAY);

  assert.equal(summary.todayKey, "2026-10-23");
  assert.equal(summary.totalDueTodayCount, 2);
  assert.equal(summary.completedDueTodayCount, 1);
  assert.equal(summary.remainingDueTodayCount, 1);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.todayCompletionPercentage, 50);

  assert.deepEqual(
    summary.overdueTasks.map((task) => task.id),
    ["overdue-pending"],
  );

  assert.deepEqual(
    summary.todaysTasks.map((task) => task.id),
    ["today-done", "today-pending"],
  );

  assert.deepEqual(
    summary.myDayTasks.map((task) => task.id),
    ["overdue-pending", "today-done", "today-pending"],
  );
});

test("completed overdue tasks are not shown as overdue", () => {
  const summary = getDashboardSummary(
    [
      makeTask("done-yesterday", "2026-10-22", true),
      makeTask("still-overdue", "2026-10-22", false),
    ],
    TODAY,
  );

  assert.deepEqual(
    summary.overdueTasks.map((task) => task.id),
    ["still-overdue"],
  );
});

test("empty task collections return zero counts and progress", () => {
  const summary = getDashboardSummary([], TODAY);

  assert.equal(summary.totalDueTodayCount, 0);
  assert.equal(summary.completedDueTodayCount, 0);
  assert.equal(summary.remainingDueTodayCount, 0);
  assert.equal(summary.overdueCount, 0);
  assert.equal(summary.todayCompletionPercentage, 0);
  assert.deepEqual(summary.myDayTasks, []);
});

test("completion progress is rounded to the nearest whole percentage", () => {
  const tasks = [
    makeTask("done-1", "2026-10-23", true),
    makeTask("pending-1", "2026-10-23"),
    makeTask("pending-2", "2026-10-23"),
  ];

  const summary = getDashboardSummary(tasks, TODAY);

  assert.equal(summary.todayCompletionPercentage, 33);
  assert.equal(summary.remainingDueTodayCount, 2);
});

test("invalid task collections and dates are rejected", () => {
  assert.throws(
    () => getDashboardSummary(null, TODAY),
    TypeError,
  );

  assert.throws(
    () => getDashboardSummary([], new Date("invalid")),
    TypeError,
  );

  assert.throws(
    () => getDashboardSummary([], "2026-10-23"),
    TypeError,
  );
});

test("summary calculation does not mutate the task collection", () => {
  const tasks = [
    makeTask("overdue", "2026-10-22"),
    makeTask("today", "2026-10-23"),
  ];

  const originalIds = tasks.map((task) => task.id);

  getDashboardSummary(tasks, TODAY);

  assert.deepEqual(
    tasks.map((task) => task.id),
    originalIds,
  );
});
