import { getTasks, updateTask } from "../services/taskService.js";

const elements = {
  date: document.querySelector("#dashboard-date"),
  todayCount: document.querySelector("#today-count"),
  completedCount: document.querySelector("#completed-count"),
  remainingCount: document.querySelector("#remaining-count"),
  taskList: document.querySelector("#dashboard-task-list"),
  mobileMenu: document.querySelector("#app-mobile-menu"),
  sidebar: document.querySelector("#app-sidebar"),
};

function formatDate(date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isDueToday(dueDate) {
  if (!dueDate) return false;

  const today = new Date();
  const todayString = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  return dueDate === todayString;
}

function formatDueDate(dueDate) {
  if (!dueDate) return "No due date";

  const date = new Date(`${dueDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function showTaskMessage(message, isError = false) {
  if (!elements.taskList) return;

  // Remove any previous status message without removing task rows.
  elements.taskList
    .querySelectorAll("[data-dashboard-message]")
    .forEach((element) => element.remove());

  const status = document.createElement("p");
  status.dataset.dashboardMessage = "true";
  status.setAttribute("role", isError ? "alert" : "status");
  status.textContent = message;

  if (isError) {
    status.style.color = "var(--color-danger)";
  }

  elements.taskList.prepend(status);
}

function renderTask(task) {
  const row = document.createElement("label");

  row.className = `dashboard-task${task.completed ? " is-complete" : ""}`;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(task.completed);
  checkbox.setAttribute("aria-label", `Complete ${task.title}`);

  const content = document.createElement("span");
  content.className = "dashboard-task-content";

  const title = document.createElement("span");
  title.className = "dashboard-task-title";
  title.textContent = task.title;

  const meta = document.createElement("span");
  meta.className = "dashboard-task-meta";
  meta.textContent = `${
    task.category || "General"
  } · ${formatDueDate(task.dueDate)}`;

  const priority = document.createElement("span");
  priority.className = `priority-dot${task.priority === "low" ? " low" : ""}`;
  priority.setAttribute("aria-label", `${task.priority || "medium"} priority`);

  checkbox.addEventListener("change", () => {
    try {
      const updatedTask = updateTask(task.id, {
        completed: checkbox.checked,
      });

      if (!updatedTask) {
        checkbox.checked = Boolean(task.completed);

        showTaskMessage(
          "This task could not be found. Refresh the page and try again.",
          true,
        );
        return;
      }

      renderDashboard();
    } catch (error) {
      console.error("Unable to update dashboard task:", error);

      // Restore the checkbox to the last known saved state.
      checkbox.checked = Boolean(task.completed);

      showTaskMessage(
        error instanceof Error
          ? error.message
          : "Unable to update this task. Please try again.",
        true,
      );
    }
  });

  content.append(title, meta);
  row.append(checkbox, content, priority);

  return row;
}

function renderDashboard() {
  if (!elements.taskList) return;

  try {
    const allTasks = getTasks();

    const todaysTasks = allTasks.filter((task) => isDueToday(task.dueDate));

    const completed = todaysTasks.filter((task) => task.completed).length;

    const remaining = todaysTasks.length - completed;

    if (elements.todayCount) {
      elements.todayCount.textContent = String(todaysTasks.length);
    }

    if (elements.completedCount) {
      elements.completedCount.textContent = String(completed);
    }

    if (elements.remainingCount) {
      elements.remainingCount.textContent = String(remaining);
    }

    elements.taskList.replaceChildren();

    if (todaysTasks.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.textContent =
        "No tasks due today. Add a task with today's date to see it here.";

      elements.taskList.append(emptyMessage);
      return;
    }

    todaysTasks.forEach((task) => {
      elements.taskList.append(renderTask(task));
    });
  } catch (error) {
    console.error("Unable to load dashboard tasks:", error);

    // Do not display old counts as though they are current.
    if (elements.todayCount) {
      elements.todayCount.textContent = "—";
    }

    if (elements.completedCount) {
      elements.completedCount.textContent = "—";
    }

    if (elements.remainingCount) {
      elements.remainingCount.textContent = "—";
    }

    elements.taskList.replaceChildren();

    const errorMessage = document.createElement("p");
    errorMessage.setAttribute("role", "alert");
    errorMessage.style.color = "var(--color-danger)";
    errorMessage.textContent =
      error instanceof Error
        ? `Tasks could not be loaded: ${error.message}`
        : "Tasks could not be loaded. Please refresh the page and try again.";

    elements.taskList.append(errorMessage);
  }
}

function setupMobileNavigation() {
  if (!elements.mobileMenu || !elements.sidebar) return;

  elements.mobileMenu.addEventListener("click", () => {
    const isOpen = elements.sidebar.classList.toggle("is-open");

    elements.mobileMenu.setAttribute("aria-expanded", String(isOpen));

    elements.mobileMenu.setAttribute(
      "aria-label",
      isOpen ? "Close navigation" : "Open navigation",
    );
  });
}

if (elements.date && elements.taskList) {
  elements.date.textContent = formatDate(new Date());

  setupMobileNavigation();
  renderDashboard();

  // Refresh dashboard data when returning to this page
  // from the browser's back/forward cache.
  window.addEventListener("pageshow", renderDashboard);
}