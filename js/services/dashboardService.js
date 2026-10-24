function isValidDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Derive Dashboard counts and My Day tasks from the shared task collection.
 * This function does not access or modify browser storage.
 */
export function getDashboardSummary(tasks, today = new Date()) {
  if (!Array.isArray(tasks)) {
    throw new TypeError("An array of tasks is required.");
  }

  if (!(today instanceof Date) || Number.isNaN(today.getTime())) {
    throw new TypeError("A valid Date is required.");
  }

  const todayKey = getDateKey(today);

  const validTasks = tasks.filter(
    (task) =>
      task !== null &&
      typeof task === "object" &&
      !Array.isArray(task),
  );

  const todaysTasks = validTasks.filter(
    (task) => task.dueDate === todayKey,
  );

  const overdueTasks = validTasks.filter(
    (task) =>
      typeof task.dueDate === "string" &&
      isValidDateKey(task.dueDate) &&
      task.dueDate !== "" &&
      task.dueDate < todayKey &&
      task.completed === false,
  );

  // Keep the original task order supplied by the shared task service.
  const myDayTasks = validTasks.filter(
    (task) =>
      task.dueDate === todayKey ||
      (
        typeof task.dueDate === "string" &&
        isValidDateKey(task.dueDate) &&
        task.dueDate !== "" &&
        task.dueDate < todayKey &&
        task.completed === false
      ),
  );

  const completedDueTodayCount = todaysTasks.filter(
    (task) => task.completed === true,
  ).length;

  const remainingDueTodayCount =
    todaysTasks.length - completedDueTodayCount;

  const todayCompletionPercentage =
    todaysTasks.length === 0
      ? 0
      : Math.round(
          (completedDueTodayCount / todaysTasks.length) * 100,
        );

  return {
    todayKey,
    todaysTasks,
    overdueTasks,
    myDayTasks,
    totalDueTodayCount: todaysTasks.length,
    completedDueTodayCount,
    remainingDueTodayCount,
    overdueCount: overdueTasks.length,
    todayCompletionPercentage,
  };
}
