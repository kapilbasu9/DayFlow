import {
  getCalendarTasks,
  dateKey,
  parseCalendarDate,
  getCalendarTasksForDate,
  updateCalendarTaskCompletion,
} from "../services/calendarService.js";

const elements = {
  monthTitle: document.querySelector("#calendar-month-title"),
  grid: document.querySelector("#calendar-grid"),
  previous: document.querySelector("#calendar-prev"),
  next: document.querySelector("#calendar-next"),
  today: document.querySelector("#calendar-today"),
  agendaTitle: document.querySelector("#calendar-agenda-title"),
  agendaCount: document.querySelector("#calendar-agenda-count"),
  agendaList: document.querySelector("#calendar-agenda-list"),
  message: document.querySelector("#calendar-message"),
  mobileMenu: document.querySelector("#app-mobile-menu"),
  sidebar: document.querySelector("#app-sidebar"),
};

const today = new Date();
today.setHours(0, 0, 0, 0);

let displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);

let selectedDate = new Date(today);

function formatMonth(date) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

function showMessage(message, isError = false) {
  if (!elements.message) return;

  elements.message.textContent = message;
  elements.message.style.color = isError
    ? "var(--color-danger)"
    : "var(--color-text-secondary)";

  elements.message.setAttribute("role", isError ? "alert" : "status");
}

function renderCalendar(tasks) {
  if (!elements.grid || !elements.monthTitle) return;

  elements.monthTitle.textContent = formatMonth(displayedMonth);
  elements.grid.replaceChildren();

  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();

  const firstDay = new Date(year, month, 1);

  // Convert Sunday-first JavaScript weekdays to Monday-first.
  const mondayOffset = (firstDay.getDay() + 6) % 7;

  const gridStart = new Date(year, month, 1 - mondayOffset);
  const selectedKey = dateKey(selectedDate);
  const todayKey = dateKey(today);

  // Six rows keep the calendar layout stable between months.
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    const key = dateKey(date);
    const dayTasks = getCalendarTasksForDate(date, tasks);

    const isOutsideMonth = date.getMonth() !== month;
    const isToday = key === todayKey;
    const isSelected = key === selectedKey;

    const dayButton = createElement("button", "calendar-day");

    dayButton.type = "button";
    dayButton.dataset.date = key;

    dayButton.classList.toggle("is-outside-month", isOutsideMonth);

    dayButton.classList.toggle("is-today", isToday);
    dayButton.classList.toggle("is-selected", isSelected);

    dayButton.setAttribute(
      "aria-label",
      `${formatLongDate(date)}, ${dayTasks.length} ${
        dayTasks.length === 1 ? "task" : "tasks"
      }`,
    );

    dayButton.setAttribute("aria-pressed", String(isSelected));

    const number = createElement(
      "span",
      "calendar-day-number",
      String(date.getDate()),
    );

    const indicator = createElement("span", "calendar-day-indicator");

    if (dayTasks.length > 0) {
      indicator.append(
        createElement("span", "calendar-task-dot"),
        createElement("span", "calendar-task-count", String(dayTasks.length)),
      );
    }

    dayButton.append(number, indicator);
    elements.grid.append(dayButton);
  }
}

function renderAgenda(tasks) {
  if (!elements.agendaTitle || !elements.agendaList) return;

  elements.agendaTitle.textContent = `Tasks for ${formatLongDate(selectedDate)}`;

  const selectedTasks = getCalendarTasksForDate(selectedDate, tasks);

  if (elements.agendaCount) {
    elements.agendaCount.textContent = `${selectedTasks.length} ${
      selectedTasks.length === 1 ? "task" : "tasks"
    }`;
  }

  elements.agendaList.replaceChildren();

  if (selectedTasks.length === 0) {
    elements.agendaList.append(
      createElement(
        "p",
        "calendar-agenda-empty",
        "No tasks scheduled for this date. You can add one from the Tasks page.",
      ),
    );

    return;
  }

  selectedTasks.forEach((task) => {
    const item = createElement(
      "article",
      `calendar-agenda-item${task.completed ? " is-complete" : ""}`,
    );

    item.dataset.taskId = task.id;

    const checkbox = createElement("input", "calendar-agenda-checkbox");

    checkbox.type = "checkbox";
    checkbox.checked = Boolean(task.completed);
    checkbox.dataset.action = "toggle";

    checkbox.setAttribute("aria-label", `Complete ${task.title}`);

    const content = createElement("div", "calendar-agenda-content");

    const title = createElement("span", "calendar-agenda-title", task.title);

    const meta = createElement("div", "calendar-agenda-meta");

    const category = createElement(
      "span",
      "calendar-agenda-tag",
      task.category || "General",
    );

    const priorityValue = task.priority || "medium";

    const priority = createElement(
      "span",
      "calendar-agenda-tag",
      `${priorityValue.charAt(0).toUpperCase()}${priorityValue.slice(1)} priority`,
    );

    meta.append(category, priority);
    content.append(title, meta);
    item.append(checkbox, content);

    elements.agendaList.append(item);
  });
}

function renderAll() {
  if (!elements.grid || !elements.agendaList) return;

  try {
    // Load and validate task storage only once per render.
    const tasks = getCalendarTasks();

    renderCalendar(tasks);
    renderAgenda(tasks);
  } catch (error) {
    console.error("Unable to load calendar tasks:", error);

    // Do not leave old calendar data visible as if it were current.
    elements.grid.replaceChildren();
    elements.agendaList.replaceChildren();

    if (elements.agendaCount) {
      elements.agendaCount.textContent = "—";
    }

    const errorMessage = createElement(
      "p",
      "calendar-agenda-empty",
      error instanceof Error
        ? `Tasks could not be loaded: ${error.message}`
        : "Tasks could not be loaded. Please refresh the page and try again.",
    );

    errorMessage.setAttribute("role", "alert");
    errorMessage.style.color = "var(--color-danger)";

    elements.agendaList.append(errorMessage);

    showMessage(
      error instanceof Error ? error.message : "Unable to load saved tasks.",
      true,
    );
  }
}

elements.previous?.addEventListener("click", () => {
  displayedMonth = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth() - 1,
    1,
  );

  renderAll();
});

elements.next?.addEventListener("click", () => {
  displayedMonth = new Date(
    displayedMonth.getFullYear(),
    displayedMonth.getMonth() + 1,
    1,
  );

  renderAll();
});

elements.today?.addEventListener("click", () => {
  selectedDate = new Date(today);

  displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  renderAll();
  showMessage("Showing today's date.");
});

elements.grid?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date]");

  if (!button) return;

  const date = parseCalendarDate(button.dataset.date);

  if (!date) return;

  selectedDate = date;

  // If an adjacent-month date is selected, navigate to that month.
  displayedMonth = new Date(date.getFullYear(), date.getMonth(), 1);

  renderAll();
  showMessage("");
});

elements.agendaList?.addEventListener("change", (event) => {
  const checkbox = event.target.closest('[data-action="toggle"]');

  if (!checkbox) return;

  const item = checkbox.closest("[data-task-id]");

  if (!item) return;

  try {
    const updatedTask = updateCalendarTaskCompletion(
      item.dataset.taskId,
      checkbox.checked,
    );

    if (!updatedTask) {
      renderAll();
      showMessage(
        "This task could not be found. Refresh the page and try again.",
        true,
      );
      return;
    }

    renderAll();

    showMessage(
      checkbox.checked
        ? "Task marked as completed."
        : "Task marked as pending.",
    );
  } catch (error) {
    console.error("Unable to update calendar task:", error);

    // Restore the displayed checkbox from the saved data if possible.
    renderAll();

    showMessage(
      error instanceof Error
        ? error.message
        : "Unable to update the task. Please try again.",
      true,
    );
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

// Refresh task information when returning through browser navigation.
window.addEventListener("pageshow", renderAll);

window.addEventListener("dayflow:data-restored", () => {
  renderAll();
});

renderAll();
