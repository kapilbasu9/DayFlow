const VALID_STATUSES = new Set([
  "all",
  "pending",
  "completed",
]);

const VALID_SORT_OPTIONS = new Set([
  "dueDate",
  "priority",
  "title",
  "createdAt",
]);

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

function normalizeText(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function getCategory(task) {
  const category = normalizeText(task?.category);
  return category || "general";
}

function getPriority(task) {
  return normalizeText(task?.priority) || "medium";
}

function compareText(a, b) {
  return a.localeCompare(b, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

/**
 * Return distinct task categories in alphabetical order.
 * Blank categories are represented as General.
 */
export function getTaskCategories(tasks) {
  if (!Array.isArray(tasks)) {
    throw new TypeError("An array of tasks is required.");
  }

  const categories = new Map();

  for (const task of tasks) {
    const rawCategory =
      typeof task?.category === "string"
        ? task.category.trim()
        : "";

    const label = rawCategory || "General";
    const key = normalizeText(label);

    if (!categories.has(key)) {
      categories.set(key, label);
    }
  }

  return [...categories.values()].sort(compareText);
}

/**
 * Filter and sort tasks without changing the source collection.
 *
 * Options:
 * status: "all", "pending", or "completed"
 * category: "" for all categories, or a category name
 * priority: "" for all priorities, or low/medium/high
 * query: text to search
 * sortBy: dueDate, priority, title, or createdAt
 */
export function organizeTasks(tasks, options = {}) {
  if (!Array.isArray(tasks)) {
    throw new TypeError("An array of tasks is required.");
  }

  if (
    options === null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    throw new TypeError("Task organization options must be an object.");
  }

  const {
    status = "all",
    category = "",
    priority = "",
    query = "",
    sortBy = "dueDate",
  } = options;

  if (!VALID_STATUSES.has(status)) {
    throw new RangeError("The selected task status is invalid.");
  }

  if (
    typeof category !== "string" ||
    typeof priority !== "string" ||
    typeof query !== "string"
  ) {
    throw new TypeError(
      "Category, priority, and search filters must be strings.",
    );
  }

  if (
    priority.trim() !== "" &&
    !Object.hasOwn(PRIORITY_ORDER, normalizeText(priority))
  ) {
    throw new RangeError("The selected task priority is invalid.");
  }

  if (!VALID_SORT_OPTIONS.has(sortBy)) {
    throw new RangeError("The selected task sort option is invalid.");
  }

  const normalizedCategory = normalizeText(category);
  const normalizedPriority = normalizeText(priority);
  const normalizedQuery = normalizeText(query);

  const filtered = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => {
      const matchesStatus =
        status === "all" ||
        (status === "pending" && task.completed === false) ||
        (status === "completed" && task.completed === true);

      const matchesCategory =
        normalizedCategory === "" ||
        getCategory(task) === normalizedCategory;

      const matchesPriority =
        normalizedPriority === "" ||
        getPriority(task) === normalizedPriority;

      const searchableText = [
        task.title,
        task.category,
        task.priority,
      ]
        .filter((value) => typeof value === "string")
        .join(" ")
        .toLowerCase();

      const matchesQuery =
        normalizedQuery === "" ||
        searchableText.includes(normalizedQuery);

      return (
        matchesStatus &&
        matchesCategory &&
        matchesPriority &&
        matchesQuery
      );
    });

  filtered.sort((a, b) => {
    const first = a.task;
    const second = b.task;
    let comparison = 0;

    switch (sortBy) {
      case "dueDate": {
        const firstDate =
          typeof first.dueDate === "string" ? first.dueDate : "";
        const secondDate =
          typeof second.dueDate === "string" ? second.dueDate : "";

        if (!firstDate && secondDate) {
          comparison = 1;
        } else if (firstDate && !secondDate) {
          comparison = -1;
        } else {
          comparison = compareText(firstDate, secondDate);
        }

        break;
      }

      case "priority":
        comparison =
          (PRIORITY_ORDER[getPriority(first)] ?? 3) -
          (PRIORITY_ORDER[getPriority(second)] ?? 3);
        break;

      case "title":
        comparison = compareText(
          normalizeText(first.title),
          normalizeText(second.title),
        );
        break;

      case "createdAt":
        comparison = compareText(
          typeof second.createdAt === "string"
            ? second.createdAt
            : "",
          typeof first.createdAt === "string"
            ? first.createdAt
            : "",
        );
        break;
    }

    // Preserve original order when sort values are equal.
    return comparison || a.index - b.index;
  });

  return filtered.map(({ task }) => task);
}
