
const STORAGE_KEY = "dayflow.tasks.v1";

const ALLOWED_UPDATE_FIELDS = new Set([
  "title",
  "category",
  "dueDate",
  "priority",
  "completed",
]);

export class TaskStorageError extends Error {
  constructor(message) {
    super(message);
    this.name = "TaskStorageError";
  }
}

function createTaskId(existingIds = new Set()) {
  // Try several times to avoid an ID collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (!existingIds.has(id)) {
      return id;
    }
  }

  throw new TaskStorageError(
    "DayFlow could not generate a unique task ID. Please try again.",
  );
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
    task !== null &&
    typeof task === "object" &&
    !Array.isArray(task) &&
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

function validateTasks(tasks, source = "Saved task data") {
  if (!Array.isArray(tasks)) {
    throw new TaskStorageError(
      `${source} has an invalid structure. ` +
        "Your original data has not been overwritten.",
    );
  }

  const ids = new Set();

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];

    if (!isValidTask(task)) {
      throw new TaskStorageError(
        `${source}: task record ${index + 1} is invalid. ` +
          "Your original data has not been overwritten.",
      );
    }

    if (ids.has(task.id)) {
      throw new TaskStorageError(
        `${source} contains a duplicate task ID in record ${index + 1}. ` +
          "Your original data has not been overwritten.",
      );
    }

    ids.add(task.id);
  }

  return tasks;
}

function readTasksFromStorage() {
  let rawData;

  try {
    rawData = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new TaskStorageError(
      "DayFlow could not access saved tasks. " +
        "Check your browser storage settings.",
    );
  }

  // A missing key is a valid empty state.
  if (rawData === null) return [];

  let tasks;

  try {
    tasks = JSON.parse(rawData);
  } catch {
    throw new TaskStorageError(
      "Saved task data could not be read because its JSON format is invalid. " +
        "Your original data has not been overwritten.",
    );
  }

  return validateTasks(tasks);
}

function saveTasksToStorage(tasks) {
  // Validate the complete collection before writing anything.
  validateTasks(tasks, "Task changes");

  let serializedData;

  try {
    serializedData = JSON.stringify(tasks);
  } catch {
    throw new TaskStorageError(
      "DayFlow could not prepare the task data for saving.",
    );
  }

  try {
    localStorage.setItem(STORAGE_KEY, serializedData);
  } catch {
    throw new TaskStorageError(
      "DayFlow could not save your tasks. " +
        "Your browser storage may be unavailable or full.",
    );
  }
}

export function getTasks() {
  const tasks = readTasksFromStorage();

  return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;

    return a.dueDate.localeCompare(b.dueDate);
  });
}

export function addTask(taskData) {
  if (
    !taskData ||
    typeof taskData !== "object" ||
    Array.isArray(taskData) ||
    typeof taskData.title !== "string" ||
    !taskData.title.trim()
  ) {
    throw new TaskStorageError("A task must have a valid title.");
  }

  const tasks = readTasksFromStorage();
  const existingIds = new Set(tasks.map((task) => task.id));

  const category =
    taskData.category === undefined ? "Personal" : taskData.category;

  const dueDate =
    taskData.dueDate === undefined ? "" : taskData.dueDate;

  const priority =
    taskData.priority === undefined ? "Medium" : taskData.priority;

  const task = {
    id: createTaskId(existingIds),
    title: taskData.title.trim(),
    category,
    dueDate,
    priority,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  if (!isValidTask(task)) {
    throw new TaskStorageError(
      "The new task contains invalid data. Check its category, due date, and priority.",
    );
  }

  saveTasksToStorage([...tasks, task]);

  return task;
}

export function updateTask(taskId, updates) {
  if (
    typeof taskId !== "string" ||
    !taskId.trim() ||
    !updates ||
    typeof updates !== "object" ||
    Array.isArray(updates)
  ) {
    throw new TaskStorageError("The task update request is invalid.");
  }

  const updateKeys = Object.keys(updates);

  if (
    updateKeys.length === 0 ||
    updateKeys.some((key) => !ALLOWED_UPDATE_FIELDS.has(key))
  ) {
    throw new TaskStorageError(
      "The task update contains unsupported fields.",
    );
  }

  const tasks = readTasksFromStorage();
  const taskIndex = tasks.findIndex((task) => task.id === taskId);

  if (taskIndex === -1) return null;

  const changes = { ...updates };

  if (Object.hasOwn(changes, "title")) {
    if (typeof changes.title !== "string" || !changes.title.trim()) {
      throw new TaskStorageError("Task title cannot be empty.");
    }

    changes.title = changes.title.trim();
  }

  if (Object.hasOwn(changes, "category")) {
    if (
      typeof changes.category !== "string" ||
      !changes.category.trim()
    ) {
      throw new TaskStorageError("Task category cannot be empty.");
    }

    changes.category = changes.category.trim();
  }

  if (Object.hasOwn(changes, "dueDate")) {
    if (
      typeof changes.dueDate !== "string" ||
      !isValidDateKey(changes.dueDate)
    ) {
      throw new TaskStorageError(
        "Task due date must be a valid YYYY-MM-DD date or empty.",
      );
    }
  }

  if (Object.hasOwn(changes, "priority")) {
    if (
      typeof changes.priority !== "string" ||
      !changes.priority.trim()
    ) {
      throw new TaskStorageError("Task priority cannot be empty.");
    }

    changes.priority = changes.priority.trim();
  }

  if (
    Object.hasOwn(changes, "completed") &&
    typeof changes.completed !== "boolean"
  ) {
    throw new TaskStorageError(
      "Task completion status must be true or false.",
    );
  }

  const updatedTask = {
    ...tasks[taskIndex],
    ...changes,
  };

  if (!isValidTask(updatedTask)) {
    throw new TaskStorageError("The task update contains invalid data.");
  }

  const updatedTasks = [...tasks];
  updatedTasks[taskIndex] = updatedTask;

  saveTasksToStorage(updatedTasks);

  return updatedTask;
}

export function deleteTask(taskId) {
  if (typeof taskId !== "string" || !taskId.trim()) {
    throw new TaskStorageError("The task deletion request is invalid.");
  }

  const tasks = readTasksFromStorage();
  const updatedTasks = tasks.filter((task) => task.id !== taskId);

  if (updatedTasks.length === tasks.length) return false;

  saveTasksToStorage(updatedTasks);

  return true;
}