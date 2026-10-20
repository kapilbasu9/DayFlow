
const STORAGE_KEY = "dayflow.preferences.v1";

const DEFAULT_PREFERENCES = {
  theme: "light",
  workspaceName: "Guest workspace",
};

function readPreferences() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return { ...DEFAULT_PREFERENCES };

    const parsed = JSON.parse(saved);

    return {
      ...DEFAULT_PREFERENCES,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      theme: parsed?.theme === "dark" ? "dark" : "light",
      workspaceName:
        typeof parsed?.workspaceName === "string" &&
        parsed.workspaceName.trim()
          ? parsed.workspaceName.trim()
          : DEFAULT_PREFERENCES.workspaceName,
    };
  } catch (error) {
    console.error("Unable to read DayFlow preferences:", error);
    return { ...DEFAULT_PREFERENCES };
  }
}

function savePreferences(preferences) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(preferences),
    );
    return true;
  } catch (error) {
    console.error("Unable to save DayFlow preferences:", error);
    return false;
  }
}

export function getPreferences() {
  return readPreferences();
}

export function applyTheme(theme) {
  const safeTheme = theme === "dark" ? "dark" : "light";

  document.documentElement.dataset.theme = safeTheme;
  document.documentElement.style.colorScheme = safeTheme;
}

export function setTheme(theme) {
  const preferences = readPreferences();

  preferences.theme = theme === "dark" ? "dark" : "light";

  if (!savePreferences(preferences)) {
    throw new Error("Unable to save your theme preference.");
  }

  applyTheme(preferences.theme);

  window.dispatchEvent(
    new CustomEvent("dayflow:preferences-changed", {
      detail: { ...preferences },
    }),
  );

  return preferences;
}

export function setWorkspaceName(name) {
  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error("Workspace name cannot be empty.");
  }

  if (cleanName.length > 60) {
    throw new Error("Workspace name must be 60 characters or fewer.");
  }

  const preferences = readPreferences();
  preferences.workspaceName = cleanName;

  if (!savePreferences(preferences)) {
    throw new Error("Unable to save the workspace name.");
  }

  window.dispatchEvent(
    new CustomEvent("dayflow:preferences-changed", {
      detail: { ...preferences },
    }),
  );

  return preferences;
}

export function initTheme() {
  const preferences = readPreferences();

  applyTheme(preferences.theme);

  return preferences;
}

// Sync preferences when the same origin is open in another tab.
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;

  const preferences = readPreferences();
  applyTheme(preferences.theme);

  window.dispatchEvent(
    new CustomEvent("dayflow:preferences-changed", {
      detail: { ...preferences },
    }),
  );
});