
const STORAGE_KEY = "dayflow.shopping.v1";

const ALLOWED_ITEM_UPDATE_FIELDS = new Set([
  "name",
  "quantity",
  "unit",
  "purchased",
]);

export class ShoppingStorageError extends Error {
  constructor(message) {
    super(message);
    this.name = "ShoppingStorageError";
  }
}

function createId(existingIds = new Set()) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `shopping-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (!existingIds.has(id)) {
      return id;
    }
  }

  throw new ShoppingStorageError(
    "DayFlow could not generate a unique shopping ID. Please try again.",
  );
}

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isValidQuantity(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0;
  }

  if (typeof value === "string") {
    // Keep optional and legacy blank quantities compatible.
    if (value.trim() === "") return true;

    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue >= 0;
  }

  return false;
}

function isValidShoppingItem(item) {
  if (
    !isObject(item) ||
    typeof item.id !== "string" ||
    !item.id.trim() ||
    typeof item.name !== "string" ||
    !item.name.trim() ||
    typeof item.purchased !== "boolean" ||
    typeof item.createdAt !== "string" ||
    !item.createdAt.trim()
  ) {
    return false;
  }

  // Quantity and unit remain optional for backward compatibility.
  if (
    item.quantity !== undefined &&
    !isValidQuantity(item.quantity)
  ) {
    return false;
  }

if (
  item.unit !== undefined &&
  typeof item.unit !== "string"
) {
  return false;
}

  return true;
}

function isValidShoppingList(list) {
  return (
    isObject(list) &&
    typeof list.id === "string" &&
    list.id.trim() !== "" &&
    typeof list.name === "string" &&
    list.name.trim() !== "" &&
    typeof list.createdAt === "string" &&
    list.createdAt.trim() !== "" &&
    Array.isArray(list.items) &&
    list.items.every(isValidShoppingItem)
  );
}

function validateLists(lists) {
  if (!Array.isArray(lists)) {
    throw new ShoppingStorageError(
      "Saved shopping data has an invalid structure. " +
        "Your original data has not been overwritten.",
    );
  }

  const allIds = new Set();

  for (let index = 0; index < lists.length; index += 1) {
    const list = lists[index];

    if (!isValidShoppingList(list)) {
      throw new ShoppingStorageError(
        `Shopping list record ${index + 1} is invalid. ` +
          "Your original data has not been overwritten.",
      );
    }

    if (allIds.has(list.id)) {
      throw new ShoppingStorageError(
        `Duplicate shopping list ID found in record ${index + 1}. ` +
          "Your original data has not been overwritten.",
      );
    }

    allIds.add(list.id);

    for (const item of list.items) {
      if (allIds.has(item.id)) {
        throw new ShoppingStorageError(
          `Duplicate shopping ID found in list "${list.name}". ` +
            "Your original data has not been overwritten.",
        );
      }

      allIds.add(item.id);
    }
  }

  return lists;
}

function getExistingIds(lists) {
  const ids = new Set();

  for (const list of lists) {
    ids.add(list.id);

    for (const item of list.items) {
      ids.add(item.id);
    }
  }

  return ids;
}

function readLists() {
  let saved;

  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new ShoppingStorageError(
      "DayFlow could not access saved shopping lists. " +
        "Check your browser storage settings.",
    );
  }

  if (saved === null) {
    return [];
  }

  let lists;

  try {
    lists = JSON.parse(saved);
  } catch {
    throw new ShoppingStorageError(
      "Saved shopping data could not be read because its JSON " +
        "format is invalid. Your original data has not been overwritten.",
    );
  }

  return validateLists(lists);
}

function writeLists(lists) {
  validateLists(lists);

  let serialized;

  try {
    serialized = JSON.stringify(lists);
  } catch {
    throw new ShoppingStorageError(
      "DayFlow could not prepare shopping data for saving.",
    );
  }

  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    throw new ShoppingStorageError(
      "DayFlow could not save your shopping data. " +
        "Browser storage may be unavailable or full.",
    );
  }
}

function requireText(value, message) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ShoppingStorageError(message);
  }

  return value.trim();
}

function validateOptionalQuantity(value) {
  if (value !== undefined && !isValidQuantity(value)) {
    throw new ShoppingStorageError(
      "Quantity must be a non-negative finite number.",
    );
  }
}

function validateOptionalUnit(value) {
  if (value !== undefined && typeof value !== "string") {
    throw new ShoppingStorageError(
      "Unit must be text when provided.",
    );
  }
}

export function getShoppingLists() {
  return readLists();
}

export function createShoppingList(name) {
  const cleanName = requireText(name, "Please enter a list name.");
  const lists = readLists();
  const existingIds = getExistingIds(lists);

  const newList = {
    id: createId(existingIds),
    name: cleanName,
    createdAt: new Date().toISOString(),
    items: [],
  };

  writeLists([newList, ...lists]);

  return newList;
}

export function renameShoppingList(listId, name) {
  if (typeof listId !== "string" || !listId.trim()) {
    throw new ShoppingStorageError(
      "The shopping-list update request is invalid.",
    );
  }

  const cleanName = requireText(name, "List name cannot be empty.");
  const lists = readLists();
  const list = lists.find((entry) => entry.id === listId);

  if (!list) {
    throw new ShoppingStorageError("Shopping list not found.");
  }

  list.name = cleanName;
  writeLists(lists);

  return list;
}

export function deleteShoppingList(listId) {
  if (typeof listId !== "string" || !listId.trim()) {
    throw new ShoppingStorageError(
      "The shopping-list deletion request is invalid.",
    );
  }

  const lists = readLists();
  const updated = lists.filter((list) => list.id !== listId);

  if (updated.length === lists.length) {
    return false;
  }

  writeLists(updated);

  return true;
}

export function addShoppingItem(listId, itemData) {
  if (
    typeof listId !== "string" ||
    !listId.trim() ||
    !isObject(itemData)
  ) {
    throw new ShoppingStorageError(
      "The shopping item details are invalid.",
    );
  }

  const name = requireText(
    itemData.name,
    "Please enter an item name.",
  );

  validateOptionalQuantity(itemData.quantity);
  validateOptionalUnit(itemData.unit);

  const lists = readLists();
  const list = lists.find((entry) => entry.id === listId);

  if (!list) {
    throw new ShoppingStorageError("Shopping list not found.");
  }

  const item = {
    id: createId(getExistingIds(lists)),
    name,
    ...(itemData.quantity !== undefined
      ? { quantity: itemData.quantity }
      : {}),
    ...(itemData.unit !== undefined
      ? { unit: itemData.unit.trim() }
      : {}),
    purchased: false,
    createdAt: new Date().toISOString(),
  };

  if (!isValidShoppingItem(item)) {
    throw new ShoppingStorageError(
      "The shopping item contains invalid data.",
    );
  }

  list.items.push(item);
  writeLists(lists);

  return item;
}

export function updateShoppingItem(listId, itemId, updates) {
  if (
    typeof listId !== "string" ||
    !listId.trim() ||
    typeof itemId !== "string" ||
    !itemId.trim() ||
    !isObject(updates)
  ) {
    throw new ShoppingStorageError(
      "The shopping-item update request is invalid.",
    );
  }

  const updateKeys = Object.keys(updates);

  if (
    updateKeys.length === 0 ||
    updateKeys.some(
      (key) => !ALLOWED_ITEM_UPDATE_FIELDS.has(key),
    )
  ) {
    throw new ShoppingStorageError(
      "The shopping-item update contains unsupported fields.",
    );
  }

  const lists = readLists();
  const list = lists.find((entry) => entry.id === listId);

  if (!list) {
    throw new ShoppingStorageError("Shopping list not found.");
  }

  const item = list.items.find((entry) => entry.id === itemId);

  if (!item) {
    throw new ShoppingStorageError("Shopping item not found.");
  }

  const updated = { ...updates };

  if (Object.hasOwn(updated, "name")) {
    updated.name = requireText(
      updated.name,
      "Item name cannot be empty.",
    );
  }

  if (Object.hasOwn(updated, "quantity")) {
    validateOptionalQuantity(updated.quantity);
  }

  if (Object.hasOwn(updated, "unit")) {
    validateOptionalUnit(updated.unit);
    updated.unit = updated.unit.trim();
  }

  if (
    Object.hasOwn(updated, "purchased") &&
    typeof updated.purchased !== "boolean"
  ) {
    throw new ShoppingStorageError(
      "Item purchase status must be true or false.",
    );
  }

  const updatedItem = {
    ...item,
    ...updated,
    id: item.id,
    createdAt: item.createdAt,
  };

  if (!isValidShoppingItem(updatedItem)) {
    throw new ShoppingStorageError(
      "The shopping-item update contains invalid data.",
    );
  }

  Object.assign(item, updatedItem);
  writeLists(lists);

  return item;
}

export function deleteShoppingItem(listId, itemId) {
  if (
    typeof listId !== "string" ||
    !listId.trim() ||
    typeof itemId !== "string" ||
    !itemId.trim()
  ) {
    throw new ShoppingStorageError(
      "The shopping-item deletion request is invalid.",
    );
  }

  const lists = readLists();
  const list = lists.find((entry) => entry.id === listId);

  if (!list) {
    throw new ShoppingStorageError("Shopping list not found.");
  }

  const originalLength = list.items.length;
  list.items = list.items.filter((item) => item.id !== itemId);

  if (list.items.length === originalLength) {
    return false;
  }

  writeLists(lists);

  return true;
}