
import { getTasks, updateTask } from "./taskService.js";

/**
 * Return all saved tasks for the Calendar module.
 * Calendar tasks share the same storage as the Tasks module.
 */
export function getCalendarTasks() {
  return getTasks();
}

/**
 * Format a valid Date as YYYY-MM-DD using local calendar dates.
 */
export function dateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError("A valid Date is required.");
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Parse an exact YYYY-MM-DD string into a valid local Date.
 * Invalid or noncanonical dates return null.
 */
export function parseCalendarDate(dateString) {
  if (
    typeof dateString !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateString)
  ) {
    return null;
  }

  const [year, month, day] = dateString.split("-").map(Number);

  if (year < 100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);

  return date;
}

/**
 * Return tasks scheduled for a particular local calendar date.
 */
export function getCalendarTasksForDate(date, tasks) {
  const key = dateKey(date);

  if (!Array.isArray(tasks)) {
    throw new TypeError("An array of tasks is required.");
  }

  return tasks.filter(
    (task) =>
      task !== null &&
      typeof task === "object" &&
      task.dueDate === key,
  );
}

/**
 * Update a task's completion status from the Calendar.
 */
export function updateCalendarTaskCompletion(taskId, completed) {
  if (typeof completed !== "boolean") {
    throw new TypeError("Task completion status must be true or false.");
  }

  return updateTask(taskId, { completed });
}