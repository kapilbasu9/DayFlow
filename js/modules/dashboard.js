import { getTasks, updateTask } from "../services/taskService.js";
import { getDashboardSummary } from "../services/dashboardService.js";

const TASKS_KEY = "dayflow.tasks.v1";

const elements = {
  date: document.querySelector("#dashboard-date"),
  todayCount: document.querySelector("#today-count"),
  completedCount: document.querySelector("#completed-count"),
  remainingCount: document.querySelector("#remaining-count"),
  overdueCount: document.querySelector("#overdue-count"),
  progressDescription: document.querySelector("#today-progress-description"),
  progressLabel: document.querySelector("#today-progress-label"),
  progressBar: document.querySelector("#today-progress-bar"),
  progressFill: document.querySelector("#today-progress-fill"),
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

function updateSummaryCards(summary) {
  if (elements.todayCount) {
    elements.todayCount.textContent =
      String(summary.totalDueTodayCount);
  }

  if (elements.completedCount) {
    elements.completedCount.textContent =
      String(summary.completedDueTodayCount);
  }

  if (elements.remainingCount) {
    elements.remainingCount.textContent =
      String(summary.remainingDueTodayCount);
  }

  if (elements.overdueCount) {
    elements.overdueCount.textContent =
      String(summary.overdueCount);
  }

  const percentage = summary.todayCompletionPercentage;

  if (elements.progressLabel) {
    elements.progressLabel.textContent = `${percentage}%`;
  }

  if (elements.progressBar) {
    elements.progressBar.setAttribute(
      "aria-valuenow",
      String(percentage),
    );
  }

  if (elements.progressFill) {
    elements.progressFill.style.width = `${percentage}%`;
  }

  if (elements.progressDescription) {
    elements.progressDescription.textContent =
      summary.totalDueTodayCount === 0
        ? "No tasks due today yet."
        : `${summary.completedDueTodayCount} of ` +
          `${summary.totalDueTodayCount} tasks due today completed.`;
  }
}

function renderTask(task, isOverdue) {
  const row = document.createElement("label");

  row.className = [
    "dashboard-task",
    task.completed ? "is-complete" : "",
    isOverdue ? "is-overdue" : "",
  ].filter(Boolean).join(" ");

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

  const details = [
    task.category || "General",
    formatDueDate(task.dueDate),
  ];

  if (isOverdue) {
    details.push("Overdue");
  }

  meta.textContent = details.join(" · ");

  const priority = document.createElement("span");
  priority.className =
    `priority-dot${task.priority === "low" ? " low" : ""}`;
  priority.setAttribute(
    "aria-label",
    `${task.priority || "medium"} priority`,
  );

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

function resetDashboardAfterError(error) {
  for (const element of [
    elements.todayCount,
    elements.completedCount,
    elements.remainingCount,
    elements.overdueCount,
  ]) {
    if (element) element.textContent = "—";
  }

  if (elements.progressLabel) {
    elements.progressLabel.textContent = "—";
  }

  if (elements.progressBar) {
    elements.progressBar.setAttribute("aria-valuenow", "0");
  }

  if (elements.progressFill) {
    elements.progressFill.style.width = "0%";
  }

  if (elements.progressDescription) {
    elements.progressDescription.textContent =
      "Progress is unavailable until tasks can be loaded.";
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

function renderDashboard() {
  if (!elements.taskList) return;

  try {
    const allTasks = getTasks();
    const summary = getDashboardSummary(allTasks);

    updateSummaryCards(summary);
    elements.taskList.replaceChildren();

    if (summary.myDayTasks.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.textContent =
        "Your My Day is clear. Add a task due today or review your task list.";

      elements.taskList.append(emptyMessage);
      return;
    }

    summary.myDayTasks.forEach((task) => {
      const isOverdue =
        !task.completed &&
        Boolean(task.dueDate) &&
        task.dueDate < summary.todayKey;

      elements.taskList.append(renderTask(task, isOverdue));
    });
  } catch (error) {
    console.error("Unable to load dashboard tasks:", error);
    resetDashboardAfterError(error);
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

  window.addEventListener("pageshow", renderDashboard);

  // Refresh if task data changes in another tab.
  window.addEventListener("storage", (event) => {
    if (event.key === TASKS_KEY || event.key === null) {
      renderDashboard();
    }
  });

  // Refresh after restoration or clearing in this tab.
  window.addEventListener("dayflow:data-restored", renderDashboard);
  window.addEventListener("dayflow:data-cleared", renderDashboard);
}
