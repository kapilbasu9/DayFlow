import { initTheme, getPreferences } from "./services/themeService.js";

function renderPreferences() {
  const preferences = getPreferences();

  document.querySelectorAll(".profile-name").forEach((element) => {
    element.textContent = preferences.workspaceName;
  });

  document
    .querySelectorAll(".profile-name, .sidebar-profile-name")
    .forEach((element) => {
      element.textContent = preferences.workspaceName;
    });

  document.querySelectorAll(".profile-avatar").forEach((element) => {
    element.textContent = preferences.workspaceName.charAt(0).toUpperCase();
  });
}

initTheme();
renderPreferences();

window.addEventListener("dayflow:preferences-changed", renderPreferences);
