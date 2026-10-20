
import {
  getPreferences,
  setTheme,
  setWorkspaceName,
} from "../services/themeService.js";

import {
  downloadBackup,
  validateBackupText,
  restoreBackupText,
  downloadTasksBackup,
  downloadCalendarBackup,
  downloadShoppingBackup,
  validateSelectiveBackupText,
  restoreSelectiveBackupText,
} from "../services/backupService.js";

const TASKS_KEY = "dayflow.tasks.v1";
const SHOPPING_KEY = "dayflow.shopping.v1";
const PREFERENCES_KEY = "dayflow.preferences.v1";
const MAX_BACKUP_SIZE = 10 * 1024 * 1024;

const elements = {
  themeToggle: document.querySelector("#theme-toggle"),
  themeLabel: document.querySelector("#theme-label"),
  themeMessage: document.querySelector("#theme-message"),

  workspaceForm: document.querySelector("#workspace-form"),
  workspaceName: document.querySelector("#workspace-name"),
  workspaceMessage: document.querySelector("#workspace-message"),

  taskCount: document.querySelector("#settings-task-count"),
  listCount: document.querySelector("#settings-list-count"),
  itemCount: document.querySelector("#settings-item-count"),
  clearData: document.querySelector("#clear-dayflow-data"),
  dataMessage: document.querySelector("#data-message"),

  mobileMenu: document.querySelector("#app-mobile-menu"),
  sidebar: document.querySelector("#app-sidebar"),

  backupType: document.querySelector("#backup-type"),
  backupTypeDescription: document.querySelector("#backup-type-description"),
  downloadSelectedBackup: document.querySelector("#download-selected-backup"),
  backupMessage: document.querySelector("#backup-message"),
  restoreBackup: document.querySelector("#restore-dayflow-backup"),
  backupFileInput: document.querySelector("#dayflow-backup-file"),
};

function showMessage(element, message, isError = false) {
  if (!element) return;

  element.textContent = message;
  element.style.color = isError
    ? "var(--color-danger)"
    : "var(--color-text-secondary)";
}

function updateThemeControls() {
  const preferences = getPreferences();

  if (elements.themeToggle) {
    elements.themeToggle.checked = preferences.theme === "dark";
  }

  if (elements.themeLabel) {
    elements.themeLabel.textContent =
      preferences.theme === "dark" ? "Dark" : "Light";
  }
}

function loadWorkspaceName() {
  if (elements.workspaceName) {
    elements.workspaceName.value = getPreferences().workspaceName;
  }
}

function readArray(key) {
  let raw;

  try {
    raw = localStorage.getItem(key);
  } catch {
    return {
      ok: false,
      data: [],
      message: "Browser storage could not be accessed.",
    };
  }

  if (raw === null) return { ok: true, data: [] };

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      data: [],
      message: "Saved data contains invalid JSON.",
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      data: [],
      message: "Saved data has an invalid structure.",
    };
  }

  return { ok: true, data: parsed };
}

function refreshDataCounts() {
  const tasks = readArray(TASKS_KEY);
  const shopping = readArray(SHOPPING_KEY);

  if (elements.taskCount) {
    elements.taskCount.textContent = tasks.ok
      ? String(tasks.data.length)
      : "Unavailable";
  }

  if (elements.listCount) {
    elements.listCount.textContent = shopping.ok
      ? String(shopping.data.length)
      : "Unavailable";
  }

  const itemCount = shopping.ok
    ? shopping.data.reduce(
        (total, list) =>
          total + (Array.isArray(list?.items) ? list.items.length : 0),
        0,
      )
    : null;

  if (elements.itemCount) {
    elements.itemCount.textContent =
      itemCount === null ? "Unavailable" : String(itemCount);
  }

  const errors = [];

  if (!tasks.ok) errors.push(`Tasks: ${tasks.message}`);
  if (!shopping.ok) errors.push(`Shopping: ${shopping.message}`);

  showMessage(
    elements.dataMessage,
    errors.join(" "),
    errors.length > 0,
  );
}

// Appearance
elements.themeToggle?.addEventListener("change", () => {
  try {
    const theme = elements.themeToggle.checked ? "dark" : "light";
    setTheme(theme);
    updateThemeControls();
    showMessage(elements.themeMessage, `${theme} theme saved.`);
  } catch (error) {
    console.error("Unable to save theme:", error);
    updateThemeControls();
    showMessage(
      elements.themeMessage,
      error.message || "Unable to save theme.",
      true,
    );
  }
});

// Workspace
elements.workspaceForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  try {
    const preferences = setWorkspaceName(elements.workspaceName.value);
    elements.workspaceName.value = preferences.workspaceName;
    showMessage(elements.workspaceMessage, "Workspace name saved.");
  } catch (error) {
    showMessage(
      elements.workspaceMessage,
      error.message || "Unable to save workspace name.",
      true,
    );
  }
});


/* Clear data */
elements.clearData?.addEventListener("click", () => {
  const confirmed = window.confirm(
    "Clear all DayFlow tasks and shopping lists stored in this browser? " +
      "This cannot be undone. Your theme and workspace name will be kept.",
  );

  if (!confirmed) return;

  let previousTasks;
  let previousShopping;

  try {
    // Save the original values before attempting any changes.
    previousTasks = localStorage.getItem(TASKS_KEY);
    previousShopping = localStorage.getItem(SHOPPING_KEY);
  } catch (error) {
    console.error("Unable to read DayFlow data before clearing:", error);

    showMessage(
      elements.dataMessage,
      "Browser storage could not be accessed. No data was intentionally cleared.",
      true,
    );
    return;
  }

  try {
    localStorage.removeItem(TASKS_KEY);
    localStorage.removeItem(SHOPPING_KEY);
  } catch (error) {
    console.error("Unable to clear DayFlow data:", error);

    let rollbackSucceeded = true;

    // Attempt to restore both original values.
    for (const [key, previousValue] of [
      [TASKS_KEY, previousTasks],
      [SHOPPING_KEY, previousShopping],
    ]) {
      try {
        if (previousValue === null) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, previousValue);
        }
      } catch (rollbackError) {
        rollbackSucceeded = false;

        console.error(
          `Unable to restore storage key "${key}":`,
          rollbackError,
        );
      }
    }

    if (rollbackSucceeded) {
      showMessage(
        elements.dataMessage,
        "Unable to clear the data. The original saved data was restored. Check browser storage and try again.",
        true,
      );
    } else {
      showMessage(
        elements.dataMessage,
        "WARNING: Clearing data failed and automatic recovery was incomplete. Your saved data may be partially cleared. Do not clear or overwrite any more data. If you have a backup, keep it available for recovery.",
        true,
      );
    }

    refreshDataCounts();
    return;
  }

  refreshDataCounts();

  showMessage(
    elements.dataMessage,
    "Tasks and shopping lists were cleared. Your theme and workspace name were kept.",
  );

  // Notify modules in this tab to refresh their displayed data.
  window.dispatchEvent(new CustomEvent("dayflow:data-cleared"));
});


// Backup descriptions
const backupDescriptions = {
  full: "Includes tasks, shopping lists and items, theme, and workspace name.",
  tasks: "Includes all saved tasks and their supported details.",
  calendar: "Includes tasks with due dates. Calendar uses shared task data.",
  shopping: "Includes shopping lists and their items.",
};

function updateBackupDescription() {
  const type = elements.backupType?.value || "full";

  showMessage(
    elements.backupTypeDescription,
    backupDescriptions[type] || backupDescriptions.full,
  );
}

elements.backupType?.addEventListener("change", updateBackupDescription);

const backupExporters = {
  full: downloadBackup,
  tasks: downloadTasksBackup,
  calendar: downloadCalendarBackup,
  shopping: downloadShoppingBackup,
};

// Download selected backup
elements.downloadSelectedBackup?.addEventListener("click", () => {
  const type = elements.backupType?.value || "full";
  const exportFunction = backupExporters[type];

  if (!exportFunction) {
    showMessage(elements.backupMessage, "Select a valid backup type.", true);
    return;
  }

  elements.downloadSelectedBackup.disabled = true;

  try {
    const backup = exportFunction();
    let details;

    if (type === "full") {
      const lists = backup.data.shoppingLists;
      const items = lists.reduce(
        (total, list) => total + list.items.length,
        0,
      );

      details =
        `${backup.data.tasks.length} tasks, ${lists.length} shopping lists, ` +
        `${items} items, and workspace preferences`;
    } else if (type === "shopping") {
      const lists = backup.data.shoppingLists;
      const items = lists.reduce(
        (total, list) => total + list.items.length,
        0,
      );

      details = `${lists.length} shopping lists and ${items} items`;
    } else {
      details = `${backup.data.tasks.length} tasks`;

      if (type === "calendar") details += " with due dates";
    }

    showMessage(
      elements.backupMessage,
      `${elements.backupType.selectedOptions[0].textContent} downloaded: ${details}.`,
    );
  } catch (error) {
    console.error("Unable to download backup:", error);
    showMessage(
      elements.backupMessage,
      error.message || "Unable to download this backup.",
      true,
    );
  } finally {
    elements.downloadSelectedBackup.disabled = false;
  }
});

// Restore using the selected backup type.
elements.restoreBackup?.addEventListener("click", () => {
  if (!elements.backupFileInput) {
    showMessage(elements.backupMessage, "Backup file input is unavailable.", true);
    return;
  }

  elements.backupFileInput.click();
});

elements.backupFileInput?.addEventListener("change", async () => {
  const file = elements.backupFileInput.files?.[0];

  if (!file) return;

  if (elements.restoreBackup) elements.restoreBackup.disabled = true;

  try {
    if (file.size > MAX_BACKUP_SIZE) {
      throw new Error("The backup file exceeds the 10 MB limit.");
    }

    const fileText = await file.text();
    const type = elements.backupType?.value || "full";

    let confirmation;
    let result;

    if (type === "full") {
      validateBackupText(fileText);

      confirmation =
        "Restore this FULL DayFlow backup? Current tasks, shopping lists, " +
        "theme, and workspace name will be replaced. Export current data " +
        "first if you want to keep a copy.";

      if (!window.confirm(confirmation)) {
        showMessage(elements.backupMessage, "Restore cancelled. No data changed.");
        return;
      }

      result = restoreBackupText(fileText);

      updateThemeControls();
      loadWorkspaceName();

      showMessage(
        elements.backupMessage,
        `Full backup restored: ${result.taskCount} tasks, ` +
          `${result.listCount} shopping lists, and ${result.itemCount} items.`,
      );
    } else {
      // Validate the exact selective format before asking for confirmation.
      const data = validateSelectiveBackupText(fileText, type);

      if (type === "tasks") {
        confirmation =
          `Restore ${data.tasks.length} tasks from this Tasks Only backup? ` +
          "Your existing tasks will be replaced. Shopping lists and preferences will be kept.";
      } else if (type === "calendar") {
        confirmation =
          `Restore ${data.tasks.length} dated tasks from this Calendar Only backup? ` +
          "Existing tasks without due dates will be preserved. Existing dated tasks will be replaced.";
      } else {
        confirmation =
          `Restore ${data.shoppingLists.length} shopping lists from this Shopping Only backup? ` +
          "Your existing shopping lists will be replaced. Tasks and preferences will be kept.";
      }

      if (!window.confirm(confirmation)) {
        showMessage(elements.backupMessage, "Restore cancelled. No data changed.");
        return;
      }

      result = restoreSelectiveBackupText(fileText, type);

      if (type === "tasks") {
        showMessage(
          elements.backupMessage,
          `Tasks restored: ${result.taskCount}. Shopping lists and preferences were preserved.`,
        );
      } else if (type === "calendar") {
        showMessage(
          elements.backupMessage,
          `Calendar restored: ${result.taskCount} dated tasks. ` +
            `${result.preservedUndatedTaskCount} undated tasks were preserved.`,
        );
      } else {
        showMessage(
          elements.backupMessage,
          `Shopping restored: ${result.listCount} lists and ${result.itemCount} items. Tasks and preferences were preserved.`,
        );
      }
    }

    refreshDataCounts();
  } catch (error) {
    console.error("Unable to restore backup:", error);
    showMessage(
      elements.backupMessage,
      error.message || "Unable to restore this backup. Verify the file and try again.",
      true,
    );
  } finally {
    elements.backupFileInput.value = "";
    if (elements.restoreBackup) elements.restoreBackup.disabled = false;
  }
});

// Mobile navigation
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

// Cross-tab synchronization
window.addEventListener("storage", (event) => {
  if (
    event.key === TASKS_KEY ||
    event.key === SHOPPING_KEY ||
    event.key === null
  ) {
    refreshDataCounts();
  }

  if (event.key === PREFERENCES_KEY || event.key === null) {
    updateThemeControls();
    loadWorkspaceName();
  }
});

// Refresh when backup restore events are dispatched.
window.addEventListener("dayflow:data-restored", () => {
  refreshDataCounts();
  updateThemeControls();
  loadWorkspaceName();
});

// Initial setup
updateThemeControls();
loadWorkspaceName();
refreshDataCounts();
updateBackupDescription();