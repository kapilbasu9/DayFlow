import {
  getTasks,
  addTask,
  updateTask,
  deleteTask,
} from "../services/taskService.js";

import {
  getTaskCategories,
  organizeTasks,
} from "../services/taskOrganizationService.js";

const elements = {
  form: document.querySelector("#task-form"),
  formPanel: document.querySelector("#task-form-panel"),
  formHeading: document.querySelector("#task-form-heading"),
  title: document.querySelector("#task-title"),
  category: document.querySelector("#task-category"),
  dueDate: document.querySelector("#task-due-date"),
  priority: document.querySelector("#task-priority"),
  submit: document.querySelector("#task-submit"),
  cancelEdit: document.querySelector("#task-cancel-edit"),
  message: document.querySelector("#task-message"),
  list: document.querySelector("#task-list"),
  count: document.querySelector("#task-count"),
  search: document.querySelector("#task-search"),
  categoryFilter: document.querySelector("#task-category-filter"),
  priorityFilter: document.querySelector("#task-priority-filter"),
  sortBy: document.querySelector("#task-sort-by"),
  filters: document.querySelectorAll("[data-filter]"),
  mobileMenu: document.querySelector("#app-mobile-menu"),
  sidebar: document.querySelector("#app-sidebar"),
};

let activeFilter = "all";
let editingTaskId = null;

function showMessage(message, isError = false) {
  if (!elements.message) return;

  elements.message.textContent = message;
  elements.message.style.color = isError
    ? "var(--color-danger)"
    : "var(--color-text-secondary)";
}

function formatDueDate(dateString) {
  if (!dateString) return "No due date";

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function resetForm() {
  if (!elements.form) return;

  elements.form.reset();
  editingTaskId = null;

  if (elements.formHeading) {
    elements.formHeading.textContent = "Create a new task";
  }

  if (elements.submit) {
    elements.submit.textContent = "Add task";
  }

  if (elements.cancelEdit) {
    elements.cancelEdit.hidden = true;
  }
}

function startEditing(task) {
  editingTaskId = task.id;

  elements.title.value = task.title;
  elements.category.value = task.category || "";
  elements.dueDate.value = task.dueDate || "";
  elements.priority.value = task.priority || "medium";

  elements.formHeading.textContent = "Edit task";
  elements.submit.textContent = "Save changes";
  elements.cancelEdit.hidden = false;

  showMessage("Editing task. Save your changes when ready.");

  elements.formPanel?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  elements.title.focus();
}

function createActionButton(label, action, extraClass = "") {
  const button = document.createElement("button");

  button.type = "button";
  button.className = `task-action ${extraClass}`.trim();
  button.textContent = label;
  button.dataset.action = action;

  return button;
}

function renderTask(task) {
  const item = document.createElement("article");
  item.className = `task-item${task.completed ? " is-complete" : ""}`;
  item.dataset.taskId = task.id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = Boolean(task.completed);
  checkbox.dataset.action = "toggle";
  checkbox.setAttribute("aria-label", `Complete ${task.title}`);

  const content = document.createElement("div");
  content.className = "task-item-content";

  const title = document.createElement("span");
  title.className = "task-item-title";
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-item-meta";

  const category = document.createElement("span");
  category.className = "task-tag";
  category.textContent = task.category || "General";

  const dueDate = document.createElement("span");
  dueDate.textContent = formatDueDate(task.dueDate);

  const priorityValue = task.priority || "medium";
  const priority = document.createElement("span");
  priority.className = `task-tag task-priority-${priorityValue}`;
  priority.textContent = `${priorityValue.charAt(0).toUpperCase()}${priorityValue.slice(1)} priority`;

  meta.append(category, dueDate, priority);
  content.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "task-item-actions";

  actions.append(
    createActionButton("Edit", "edit"),
    createActionButton("Delete", "delete", "task-action-delete"),
  );

  item.append(checkbox, content, actions);

  return item;
}

function updateCategoryOptions(allTasks) {
  if (!elements.categoryFilter) return;

  const selectedCategory = elements.categoryFilter.value;
  const categories = getTaskCategories(allTasks);

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All categories";

  const categoryOptions = categories.map((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    return option;
  });

  elements.categoryFilter.replaceChildren(allOption, ...categoryOptions);

  const matchingCategory = categories.find(
    (category) => category.toLowerCase() === selectedCategory.toLowerCase(),
  );

  elements.categoryFilter.value = matchingCategory || "";
}

function getVisibleTasks(allTasks) {
  return organizeTasks(allTasks, {
    status: activeFilter,
    category: elements.categoryFilter?.value || "",
    priority: elements.priorityFilter?.value || "",
    query: elements.search?.value || "",
    sortBy: elements.sortBy?.value || "dueDate",
  });
}

function renderTasks() {
  if (!elements.list || !elements.count) return;

  try {
    // Read saved tasks once so counts and visible tasks use
    // the same validated snapshot.
    const allTasks = getTasks();

    updateCategoryOptions(allTasks);

    const visibleTasks = getVisibleTasks(allTasks);

    elements.count.textContent =
      visibleTasks.length === allTasks.length
        ? `${allTasks.length} ${allTasks.length === 1 ? "task" : "tasks"}`
        : `${visibleTasks.length} of ${allTasks.length} tasks`;

    elements.list.replaceChildren();

    if (visibleTasks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "tasks-empty";

      if (allTasks.length === 0) {
        empty.textContent =
          "No tasks yet. Create your first task using the form above.";
      } else {
        empty.textContent =
          "No tasks match this filter or search. Try another filter.";
      }

      elements.list.append(empty);
      return;
    }

    visibleTasks.forEach((task) => {
      elements.list.append(renderTask(task));
    });
  } catch (error) {
    console.error("DayFlow could not load tasks:", error);

    elements.count.textContent = "Tasks unavailable";
    elements.list.replaceChildren();

    const errorMessage = document.createElement("p");
    errorMessage.className = "tasks-empty";
    errorMessage.textContent =
      "Your tasks could not be loaded. Your saved data has not been intentionally cleared. Check storage availability and try refreshing the page.";

    elements.list.append(errorMessage);

    showMessage(
      error instanceof Error
        ? error.message
        : "Unable to load tasks. Please try again.",
      true,
    );
  }
}

elements.form?.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = elements.title.value.trim();

  if (!title) {
    showMessage("Please enter a task title.", true);
    elements.title.focus();
    return;
  }

  const taskData = {
    title,
    category: elements.category.value.trim() || "General",
    dueDate: elements.dueDate.value,
    priority: elements.priority.value,
  };

  try {
    if (editingTaskId) {
      const updatedTask = updateTask(editingTaskId, taskData);

      if (!updatedTask) {
        showMessage(
          "This task no longer exists. Refresh the list before editing again.",
          true,
        );
        renderTasks();
        return;
      }

      resetForm();
      renderTasks();
      showMessage("Task updated successfully.");
    } else {
      addTask({
        ...taskData,
        completed: false,
        createdAt: new Date().toISOString(),
      });

      resetForm();
      renderTasks();
      showMessage("Task added successfully.");
    }
  } catch (error) {
    console.error("DayFlow could not save the task:", error);

    showMessage(
      error instanceof Error
        ? error.message
        : "Unable to save task. Please try again.",
      true,
    );
  }
});

elements.cancelEdit?.addEventListener("click", () => {
  resetForm();
  showMessage("Editing cancelled.");
});

elements.filters.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "all";

    elements.filters.forEach((filterButton) => {
      const isActive = filterButton === button;

      filterButton.classList.toggle("is-active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });

    renderTasks();
  });
});

elements.search?.addEventListener("input", renderTasks);
elements.categoryFilter?.addEventListener("change", renderTasks);
elements.priorityFilter?.addEventListener("change", renderTasks);
elements.sortBy?.addEventListener("change", renderTasks);

elements.list?.addEventListener("change", (event) => {
  const checkbox = event.target.closest('[data-action="toggle"]');

  if (!checkbox) return;

  const item = checkbox.closest("[data-task-id]");
  if (!item) return;

  try {
    const updatedTask = updateTask(item.dataset.taskId, {
      completed: checkbox.checked,
    });

    if (!updatedTask) {
      showMessage("Task not found. Refresh the list and try again.", true);
      renderTasks();
      return;
    }

    renderTasks();

    showMessage(
      checkbox.checked
        ? "Task marked as completed."
        : "Task marked as pending.",
    );
  } catch (error) {
    console.error("DayFlow could not update the task:", error);

    showMessage(
      error instanceof Error
        ? error.message
        : "Unable to update task. Please try again.",
      true,
    );

    renderTasks();
  }
});

elements.list?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  const item = button.closest("[data-task-id]");
  if (!item) return;

  let task;

  try {
    task = getTasks().find((savedTask) => savedTask.id === item.dataset.taskId);
  } catch (error) {
    console.error("DayFlow could not find the task:", error);

    showMessage(
      error instanceof Error ? error.message : "Unable to read saved tasks.",
      true,
    );
    return;
  }

  if (!task) {
    showMessage("Task not found. Refresh the list and try again.", true);
    renderTasks();
    return;
  }

  if (button.dataset.action === "edit") {
    startEditing(task);
    return;
  }

  if (button.dataset.action === "delete") {
    const confirmed = window.confirm(
      `Delete "${task.title}"? This cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      const deleted = deleteTask(task.id);

      if (!deleted) {
        showMessage(
          "Task was not deleted because it could not be found.",
          true,
        );
        renderTasks();
        return;
      }

      if (editingTaskId === task.id) {
        resetForm();
      }

      renderTasks();
      showMessage("Task deleted successfully.");
    } catch (error) {
      console.error("DayFlow could not delete the task:", error);

      showMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete task. Please try again.",
        true,
      );

      renderTasks();
    }
  }
});

if (elements.mobileMenu && elements.sidebar) {
  elements.mobileMenu.addEventListener("click", () => {
    const isOpen = elements.sidebar.classList.toggle("is-open");

    elements.mobileMenu.setAttribute("aria-expanded", String(isOpen));
    elements.mobileMenu.setAttribute(
      "aria-label",
      isOpen ? "Close navigation" : "Open navigation",
    );
  });
}

window.addEventListener("dayflow:data-restored", () => {
  renderTasks();
});

// Safe initial load: storage errors are handled by renderTasks().
renderTasks();
