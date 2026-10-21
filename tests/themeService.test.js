import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

const STORAGE_KEY = "dayflow.preferences.v1";

const state = {
  values: new Map(),
  failWrite: false,
};

const memoryStorage = {
  getItem(key) {
    return state.values.has(key) ? state.values.get(key) : null;
  },

  setItem(key, value) {
    if (state.failWrite) {
      throw new Error("Simulated storage write failure");
    }

    state.values.set(key, String(value));
  },

  removeItem(key) {
    state.values.delete(key);
  },

  clear() {
    state.values.clear();
  },
};

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: memoryStorage,
});

globalThis.window = new EventTarget();

globalThis.document = {
  documentElement: {
    dataset: {},
    style: {},
  },
};

const preferenceEvents = [];

window.addEventListener("dayflow:preferences-changed", (event) => {
  preferenceEvents.push(event.detail);
});

const {
  getPreferences,
  setTheme,
  setWorkspaceName,
  initTheme,
} = await import("../js/services/themeService.js");

beforeEach(() => {
  state.values.clear();
  state.failWrite = false;
  preferenceEvents.length = 0;
  document.documentElement.dataset = {};
  document.documentElement.style = {};
});

test("missing preferences return the documented defaults", () => {
  assert.deepEqual(getPreferences(), {
    theme: "light",
    workspaceName: "Guest workspace",
  });
});

test("setTheme persists and applies the selected theme", () => {
  const preferences = setTheme("dark");

  assert.equal(preferences.theme, "dark");
  assert.equal(getPreferences().theme, "dark");
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(document.documentElement.style.colorScheme, "dark");
  assert.equal(preferenceEvents.length, 1);
  assert.equal(preferenceEvents[0].theme, "dark");
});

test("unknown theme values safely resolve to light", () => {
  const preferences = setTheme("unsupported");

  assert.equal(preferences.theme, "light");
  assert.equal(document.documentElement.dataset.theme, "light");
});

test("setWorkspaceName trims and persists the workspace name", () => {
  const preferences = setWorkspaceName("  Family Workspace  ");

  assert.equal(preferences.workspaceName, "Family Workspace");
  assert.equal(getPreferences().workspaceName, "Family Workspace");
  assert.equal(preferenceEvents.length, 1);
  assert.equal(preferenceEvents[0].workspaceName, "Family Workspace");
});

test("empty workspace names are rejected without changing saved preferences", () => {
  setWorkspaceName("Existing workspace");
  preferenceEvents.length = 0;

  assert.throws(
    () => setWorkspaceName("   "),
    /cannot be empty/i,
  );

  assert.equal(
    getPreferences().workspaceName,
    "Existing workspace",
  );

  assert.equal(preferenceEvents.length, 0);
});

test("workspace names longer than 60 characters are rejected", () => {
  assert.throws(
    () => setWorkspaceName("A".repeat(61)),
    /60 characters/i,
  );

  assert.equal(state.values.has(STORAGE_KEY), false);
});

test("failed preference writes are reported without applying the new theme", () => {
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
  state.failWrite = true;

  assert.throws(
    () => setTheme("dark"),
    /Unable to save your theme preference/i,
  );

  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(document.documentElement.style.colorScheme, "light");
  assert.equal(preferenceEvents.length, 0);
});

test("initTheme applies saved preferences without changing stored values", () => {
  const saved = {
    theme: "dark",
    workspaceName: "Test Workspace",
  };

  state.values.set(STORAGE_KEY, JSON.stringify(saved));

  const preferences = initTheme();

  assert.deepEqual(preferences, saved);
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(state.values.get(STORAGE_KEY), JSON.stringify(saved));
});

test("storage events refresh preferences in another tab", () => {
  state.values.set(
    STORAGE_KEY,
    JSON.stringify({
      theme: "dark",
      workspaceName: "Shared Browser Workspace",
    }),
  );

  const event = new Event("storage");
  Object.defineProperty(event, "key", { value: STORAGE_KEY });

  window.dispatchEvent(event);

  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(document.documentElement.style.colorScheme, "dark");
  assert.equal(preferenceEvents.length, 1);
  assert.equal(
    preferenceEvents[0].workspaceName,
    "Shared Browser Workspace",
  );
});
