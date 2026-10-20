
import {
  getShoppingLists,
  createShoppingList,
  renameShoppingList,
  deleteShoppingList,
  addShoppingItem,
  updateShoppingItem,
  deleteShoppingItem,
} from "../services/shoppingService.js";

const elements = {
  createForm: document.querySelector("#shopping-create-form"),
  listName: document.querySelector("#shopping-list-name"),
  listMessage: document.querySelector("#shopping-list-message"),
  storageMessage: document.querySelector("#shopping-storage-message"),
  listCollection: document.querySelector("#shopping-list-collection"),

  detailTitle: document.querySelector("#shopping-detail-title"),
  detailDescription: document.querySelector("#shopping-detail-description"),
  renameList: document.querySelector("#shopping-rename-list"),
  deleteList: document.querySelector("#shopping-delete-list"),
  activeContent: document.querySelector("#shopping-active-content"),

  progressText: document.querySelector("#shopping-progress-text"),
  progressBar: document.querySelector("#shopping-progress-bar"),
  progressFill: document.querySelector("#shopping-progress-fill"),

  itemForm: document.querySelector("#shopping-item-form"),
  itemName: document.querySelector("#shopping-item-name"),
  itemQuantity: document.querySelector("#shopping-item-quantity"),
  itemUnit: document.querySelector("#shopping-item-unit"),
  itemSubmit: document.querySelector("#shopping-item-submit"),
  itemCancel: document.querySelector("#shopping-item-cancel"),
  itemMessage: document.querySelector("#shopping-item-message"),
  itemCount: document.querySelector("#shopping-item-count"),
  itemList: document.querySelector("#shopping-item-list"),

  mobileMenu: document.querySelector("#app-mobile-menu"),
  sidebar: document.querySelector("#app-sidebar"),
};

let activeListId = null;
let editingItemId = null;

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `shopping-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showMessage(element, message, isError = false) {
  if (!element) {
    console.warn(
      "Shopping message element was not found. Message:",
      message,
    );
    return;
  }

  element.textContent = message;

  element.style.color = isError
    ? "var(--color-danger)"
    : "var(--color-text-secondary)";
}


function showStorageError(error) {
  if (!elements.storageMessage) {
    console.error(
      "Shopping storage message element is missing:",
      error,
    );
    return;
  }

  elements.storageMessage.hidden = false;
  elements.storageMessage.textContent =
    error?.message ||
    "Unable to load your saved shopping data. Do not overwrite or clear the saved data until this issue is resolved.";

  elements.storageMessage.style.color = "var(--color-danger)";
}

function clearStorageError() {
  if (!elements.storageMessage) return;

  elements.storageMessage.hidden = true;
  elements.storageMessage.textContent = "";
}


function loadShoppingListsSafely() {
  try {
    const lists = getShoppingLists();

    clearStorageError();
    return lists;
  } catch (error) {
    showStorageError(error);
    return null;
  }
}

function getActiveList() {
  const lists = loadShoppingListsSafely();

  if (!lists) return null;

  return lists.find(
    (list) => list.id === activeListId,
  ) || null;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function createActionButton(label, action, extraClass = "") {
  const button = createElement(
    "button",
    `shopping-action ${extraClass}`.trim(),
    label,
  );

  button.type = "button";
  button.dataset.action = action;

  return button;
}

function renderListCollection() {
  const lists = loadShoppingListsSafely();

  elements.listCollection.replaceChildren();

  // null means loading failed; [] means there are genuinely no lists.
  if (lists === null) {
    elements.listCollection.append(
      createElement(
        "p",
        "shopping-empty",
        "Shopping lists could not be loaded. See the error message above.",
      ),
    );

    return;
  }

  if (lists.length === 0) {
    elements.listCollection.append(
      createElement(
        "p",
        "shopping-empty",
        "No lists yet. Create your first shopping list above.",
      ),
    );

    return;
  }

  lists.forEach((list) => {
    const purchased = list.items.filter(
      (item) => item.purchased,
    ).length;

    const card = createElement(
      "button",
      `shopping-list-card${list.id === activeListId ? " is-active" : ""}`,
    );

    card.type = "button";
    card.dataset.listId = list.id;
    card.setAttribute(
      "aria-pressed",
      String(list.id === activeListId),
    );

    const content = createElement(
      "span",
      "shopping-list-card-content",
    );

    const title = createElement(
      "span",
      "shopping-list-card-title",
      list.name,
    );

    const meta = createElement(
      "span",
      "shopping-list-card-meta",
      `${purchased} of ${list.items.length} purchased`,
    );

    const count = createElement(
      "span",
      "shopping-list-card-count",
      String(list.items.length),
    );

    content.append(title, meta);
    card.append(content, count);
    elements.listCollection.append(card);
  });
}

function resetItemForm() {
  elements.itemForm.reset();
  elements.itemQuantity.value = "1";
  elements.itemUnit.value = "pcs";

  editingItemId = null;
  elements.itemSubmit.textContent = "Add item";
  elements.itemCancel.classList.add("shopping-hidden");
}

function startEditingItem(item) {
  editingItemId = item.id;

  elements.itemName.value = item.name;
  elements.itemQuantity.value = String(item.quantity);
  elements.itemUnit.value = item.unit || "pcs";

  elements.itemSubmit.textContent = "Save changes";
  elements.itemCancel.classList.remove("shopping-hidden");

  showMessage(elements.itemMessage, "Edit the item and save your changes.");
  elements.itemName.focus();
}

function renderProgress(list) {
  const total = list.items.length;
  const purchased = list.items.filter(
    (item) => item.purchased,
  ).length;

  const percentage = total === 0
    ? 0
    : Math.round((purchased / total) * 100);

  elements.progressText.textContent =
    `${purchased} of ${total} purchased`;

  elements.progressFill.style.width = `${percentage}%`;
  elements.progressBar.setAttribute(
    "aria-valuenow",
    String(percentage),
  );
}

function renderItems(list) {
  elements.itemList.replaceChildren();

  elements.itemCount.textContent =
    `${list.items.length} ${
      list.items.length === 1 ? "item" : "items"
    }`;

  if (list.items.length === 0) {
    elements.itemList.append(
      createElement(
        "p",
        "shopping-empty",
        "No items yet. Add your first item above.",
      ),
    );

    return;
  }

  // Keep purchased items after items that still need buying.
  const sortedItems = [...list.items].sort(
    (a, b) => Number(a.purchased) - Number(b.purchased),
  );

  sortedItems.forEach((item) => {
    const row = createElement(
      "article",
      `shopping-item${item.purchased ? " is-purchased" : ""}`,
    );

    row.dataset.itemId = item.id;

    const checkbox = createElement(
      "input",
      "shopping-item-checkbox",
    );

    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.purchased);
    checkbox.dataset.action = "toggle";

    checkbox.setAttribute(
      "aria-label",
      `Mark ${item.name} as purchased`,
    );

    const content = createElement(
      "div",
      "shopping-item-content",
    );

    const name = createElement(
      "span",
      "shopping-item-name",
      item.name,
    );

    const quantity = createElement(
      "span",
      "shopping-item-quantity",
      `${item.quantity} ${item.unit || "pcs"}`,
    );

    content.append(name, quantity);

    const actions = createElement(
      "div",
      "shopping-item-actions",
    );

    actions.append(
      createActionButton("Edit", "edit"),
      createActionButton(
        "Delete",
        "delete",
        "shopping-action-delete",
      ),
    );

    row.append(checkbox, content, actions);
    elements.itemList.append(row);
  });
}

function renderDetail() {
  const list = getActiveList();

  const hasList = Boolean(list);

  elements.renameList.disabled = !hasList;
  elements.deleteList.disabled = !hasList;

  elements.activeContent.classList.toggle(
    "shopping-hidden",
    !hasList,
  );

  if (!list) {
    elements.detailTitle.textContent = "Select a list";
    elements.detailDescription.textContent =
      "Create a shopping list to get started.";

    elements.progressText.textContent = "0 of 0 purchased";
    elements.progressFill.style.width = "0%";
    elements.progressBar.setAttribute("aria-valuenow", "0");
    elements.itemCount.textContent = "0 items";

    elements.itemList.replaceChildren();
    elements.itemList.append(
      createElement("p", "shopping-empty", "No list selected."),
    );

    resetItemForm();
    return;
  }

  elements.detailTitle.textContent = list.name;
  elements.detailDescription.textContent =
    "Manage items and track your shopping progress.";

  renderProgress(list);
  renderItems(list);
}

function renderAll() {
  renderListCollection();
  renderDetail();
}

elements.createForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = elements.listName.value.trim();

  if (!name) {
    showMessage(
      elements.listMessage,
      "Please enter a list name.",
      true,
    );
    return;
  }

  try {
    const list = createShoppingList(name);

    activeListId = list.id;
    elements.createForm.reset();

    showMessage(
      elements.listMessage,
      "Shopping list created successfully.",
    );

    showMessage(elements.itemMessage, "");
    renderAll();
  } catch (error) {
    console.error(error);

    showMessage(
      elements.listMessage,
      error.message || "Unable to create the list.",
      true,
    );
  }
});

elements.listCollection.addEventListener("click", (event) => {
  const button = event.target.closest("[data-list-id]");

  if (!button) return;

  activeListId = button.dataset.listId;

  resetItemForm();
  showMessage(elements.itemMessage, "");
  renderAll();
});

elements.renameList.addEventListener("click", () => {
  const list = getActiveList();

  if (!list) return;

  const newName = window.prompt("Enter the new list name:", list.name);

  if (newName === null) return;

  try {
    renameShoppingList(list.id, newName);

    showMessage(
      elements.listMessage,
      "Shopping list renamed successfully.",
    );

    renderAll();
  } catch (error) {
    showMessage(
      elements.listMessage,
      error.message || "Unable to rename the list.",
      true,
    );
  }
});

elements.deleteList.addEventListener("click", () => {
  const list = getActiveList();

  if (!list) return;

  const confirmed = window.confirm(
    `Delete "${list.name}" and all its items? This cannot be undone.`,
  );

  if (!confirmed) return;

  try {
    deleteShoppingList(list.id);

    const remainingLists = getShoppingLists();

    activeListId = remainingLists[0]?.id || null;

    resetItemForm();

    showMessage(
      elements.listMessage,
      "Shopping list deleted.",
    );

    renderAll();
  } catch (error) {
    console.error(error);

    showMessage(
      elements.listMessage,
      error.message || "Unable to delete the list.",
      true,
    );
  }
});

elements.itemForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const list = getActiveList();

  if (!list) {
    showMessage(
      elements.itemMessage,
      "Create or select a shopping list first.",
      true,
    );
    return;
  }

  const name = elements.itemName.value.trim();
  const quantity = Number(elements.itemQuantity.value);
  const unit = elements.itemUnit.value;

  if (!name) {
    showMessage(
      elements.itemMessage,
      "Please enter an item name.",
      true,
    );
    return;
  }

  if (
    !Number.isFinite(quantity) ||
    quantity < 0.01 ||
    quantity > 999999
  ) {
    showMessage(
      elements.itemMessage,
      "Enter a quantity between 0.01 and 999999.",
      true,
    );
    return;
  }

  try {
    if (editingItemId) {
      updateShoppingItem(list.id, editingItemId, {
        name,
        quantity,
        unit,
      });

      showMessage(
        elements.itemMessage,
        "Item updated successfully.",
      );
    } else {
      addShoppingItem(list.id, {
        name,
        quantity,
        unit,
      });

      showMessage(
        elements.itemMessage,
        "Item added successfully.",
      );
    }

    resetItemForm();
    renderAll();
  } catch (error) {
    console.error(error);

    showMessage(
      elements.itemMessage,
      error.message || "Unable to save the item.",
      true,
    );
  }
});

elements.itemCancel.addEventListener("click", () => {
  resetItemForm();

  showMessage(
    elements.itemMessage,
    "Item editing cancelled.",
  );
});

elements.itemList.addEventListener("change", (event) => {
  const checkbox = event.target.closest('[data-action="toggle"]');

  if (!checkbox) return;

  const row = checkbox.closest("[data-item-id]");
  const list = getActiveList();

  if (!row || !list) return;

  try {
    updateShoppingItem(list.id, row.dataset.itemId, {
      purchased: checkbox.checked,
    });

    showMessage(
      elements.itemMessage,
      checkbox.checked
        ? "Item marked as purchased."
        : "Item marked as not purchased.",
    );

    renderAll();
  } catch (error) {
    console.error(error);

    showMessage(
      elements.itemMessage,
      error.message || "Unable to update the item.",
      true,
    );

    renderAll();
  }
});

elements.itemList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");

  if (!button) return;

  const row = button.closest("[data-item-id]");
  const list = getActiveList();

  if (!row || !list) return;

  const item = list.items.find(
    (entry) => entry.id === row.dataset.itemId,
  );

  if (!item) return;

  if (button.dataset.action === "edit") {
    startEditingItem(item);
    return;
  }

  if (button.dataset.action === "delete") {
    const confirmed = window.confirm(
      `Delete "${item.name}"?`,
    );

    if (!confirmed) return;

    try {
      deleteShoppingItem(list.id, item.id);

      if (editingItemId === item.id) {
        resetItemForm();
      }

      showMessage(
        elements.itemMessage,
        "Item deleted successfully.",
      );

      renderAll();
    } catch (error) {
      console.error(error);

      showMessage(
        elements.itemMessage,
        error.message || "Unable to delete the item.",
        true,
      );
    }
  }
});

if (elements.mobileMenu && elements.sidebar) {
  elements.mobileMenu.addEventListener("click", () => {
    const isOpen = elements.sidebar.classList.toggle("is-open");

    elements.mobileMenu.setAttribute(
      "aria-expanded",
      String(isOpen),
    );

    elements.mobileMenu.setAttribute(
      "aria-label",
      isOpen ? "Close navigation" : "Open navigation",
    );
  });
}

function initializeShoppingPage() {
  const existingLists = loadShoppingListsSafely();

  if (existingLists === null) {
    activeListId = null;
    renderAll();
    return;
  }

  activeListId = existingLists[0]?.id || null;
  renderAll();
}

// Initial page setup.
initializeShoppingPage();

// Refresh shopping data after a backup is restored.
window.addEventListener("dayflow:data-restored", () => {
  const lists = loadShoppingListsSafely();

  if (lists === null) {
    activeListId = null;
    renderAll();
    return;
  }

  // Keep the current list if it still exists after restoration.
  // Otherwise, select the first available list.
  const activeListStillExists = lists.some(
    (list) => list.id === activeListId,
  );

  if (!activeListStillExists) {
    activeListId = lists[0]?.id || null;
  }

  // Reset editing state so we don't edit a stale item.
  resetItemForm();
  showMessage(elements.itemMessage, "");
  renderAll();
});

// Refresh the shopping page if another browser tab changes its data.
window.addEventListener("storage", (event) => {
  if (
    event.key === "dayflow.shopping.v1" ||
    event.key === null
  ) {
    const lists = loadShoppingListsSafely();

    if (lists === null) {
      activeListId = null;
      renderAll();
      return;
    }

    const activeListStillExists = lists.some(
      (list) => list.id === activeListId,
    );

    if (!activeListStillExists) {
      activeListId = lists[0]?.id || null;
    }

    resetItemForm();
    showMessage(elements.itemMessage, "");
    renderAll();
  }
});