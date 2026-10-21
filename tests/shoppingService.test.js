import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  getShoppingLists,
  createShoppingList,
  renameShoppingList,
  deleteShoppingList,
  addShoppingItem,
  updateShoppingItem,
  deleteShoppingItem,
  ShoppingStorageError,
} from "../js/services/shoppingService.js";

const SHOPPING_KEY = "dayflow.shopping.v1";

const state = {
  values: new Map(),
  failRead: false,
  failWrite: false,
};

const memoryStorage = {
  getItem(key) {
    if (state.failRead) {
      throw new Error("Simulated read failure");
    }

    return state.values.has(key) ? state.values.get(key) : null;
  },

  setItem(key, value) {
    if (state.failWrite) {
      throw new Error("Simulated write failure");
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

beforeEach(() => {
  state.values.clear();
  state.failRead = false;
  state.failWrite = false;
});

test("creating a list trims its name and persists it", () => {
  const list = createShoppingList("  Weekly groceries  ");

  assert.equal(list.name, "Weekly groceries");
  assert.ok(list.id);
  assert.ok(Array.isArray(list.items));
  assert.equal(getShoppingLists().length, 1);
  assert.equal(getShoppingLists()[0].name, "Weekly groceries");
});

test("renaming a list persists the cleaned name", () => {
  const list = createShoppingList("Groceries");

  const renamed = renameShoppingList(list.id, "  Weekend groceries  ");

  assert.equal(renamed.name, "Weekend groceries");
  assert.equal(getShoppingLists()[0].name, "Weekend groceries");
});

test("adding an item trims its text and persists its details", () => {
  const list = createShoppingList("Groceries");

  const item = addShoppingItem(list.id, {
    name: "  Apples  ",
    quantity: 2,
    unit: " kg ",
  });

  assert.equal(item.name, "Apples");
  assert.equal(item.quantity, 2);
  assert.equal(item.unit, "kg");
  assert.equal(item.purchased, false);

  const saved = getShoppingLists()[0];
  assert.equal(saved.items.length, 1);
  assert.equal(saved.items[0].id, item.id);
});

test("updating an item persists supported fields", () => {
  const list = createShoppingList("Groceries");
  const item = addShoppingItem(list.id, {
    name: "Apples",
    quantity: 2,
    unit: "kg",
  });

  const updated = updateShoppingItem(list.id, item.id, {
    name: "Green apples",
    quantity: 3,
    purchased: true,
  });

  assert.equal(updated.name, "Green apples");
  assert.equal(updated.quantity, 3);
  assert.equal(updated.purchased, true);

  const savedItem = getShoppingLists()[0].items[0];
  assert.equal(savedItem.name, "Green apples");
  assert.equal(savedItem.quantity, 3);
  assert.equal(savedItem.purchased, true);
});

test("deleting an item and list removes them", () => {
  const list = createShoppingList("Temporary list");
  const item = addShoppingItem(list.id, { name: "Temporary item" });

  assert.equal(deleteShoppingItem(list.id, item.id), true);
  assert.equal(deleteShoppingItem(list.id, item.id), false);
  assert.equal(getShoppingLists()[0].items.length, 0);

  assert.equal(deleteShoppingList(list.id), true);
  assert.equal(deleteShoppingList(list.id), false);
  assert.equal(getShoppingLists().length, 0);
});

test("invalid names, quantities, units and update fields are rejected", () => {
  assert.throws(
    () => createShoppingList("   "),
    ShoppingStorageError,
  );

  const list = createShoppingList("Groceries");

  assert.throws(
    () => addShoppingItem(list.id, { name: "   " }),
    ShoppingStorageError,
  );

  assert.throws(
    () => addShoppingItem(list.id, {
      name: "Invalid quantity",
      quantity: -1,
    }),
    ShoppingStorageError,
  );

  assert.throws(
    () => addShoppingItem(list.id, {
      name: "Invalid quantity",
      quantity: Infinity,
    }),
    ShoppingStorageError,
  );

  const item = addShoppingItem(list.id, { name: "Apples" });

  assert.throws(
    () => updateShoppingItem(list.id, item.id, {
      purchased: "yes",
    }),
    ShoppingStorageError,
  );

  assert.throws(
    () => updateShoppingItem(list.id, item.id, {
      id: "changed-id",
    }),
    ShoppingStorageError,
  );

  assert.equal(getShoppingLists()[0].items[0].id, item.id);
});

test("corrupted shopping JSON is rejected without being overwritten", () => {
  const corruptedValue = "{invalid-json";
  state.values.set(SHOPPING_KEY, corruptedValue);

  assert.throws(
    () => getShoppingLists(),
    ShoppingStorageError,
  );

  assert.throws(
    () => createShoppingList("Must not overwrite corruption"),
    ShoppingStorageError,
  );

  assert.equal(state.values.get(SHOPPING_KEY), corruptedValue);
});

test("duplicate shopping IDs are rejected", () => {
  const list = {
    id: "duplicate-id",
    name: "Groceries",
    createdAt: "2026-10-20T10:00:00.000Z",
    items: [],
  };

  const secondList = { ...list };

  state.values.set(
    SHOPPING_KEY,
    JSON.stringify([list, secondList]),
  );

  assert.throws(
    () => getShoppingLists(),
    ShoppingStorageError,
  );
});

test("storage read failures are reported", () => {
  state.failRead = true;

  assert.throws(
    () => getShoppingLists(),
    ShoppingStorageError,
  );
});

test("storage write failures are reported", () => {
  const list = createShoppingList("Groceries");
  const originalValue = state.values.get(SHOPPING_KEY);

  state.failWrite = true;

  assert.throws(
    () => addShoppingItem(list.id, { name: "Apples" }),
    ShoppingStorageError,
  );

  assert.equal(state.values.get(SHOPPING_KEY), originalValue);
});
