import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  increment,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const itemList = document.getElementById("item-list");
const emptyState = document.getElementById("empty-state");
const addForm = document.getElementById("add-form");
const newItemInput = document.getElementById("new-item");
const clearCheckedBtn = document.getElementById("clear-checked-btn");

const listSwitcherBtn = document.getElementById("list-switcher-btn");
const currentListName = document.getElementById("current-list-name");
const listMenu = document.getElementById("list-menu");
const listMenuItems = document.getElementById("list-menu-items");
const newListForm = document.getElementById("new-list-form");
const newListNameInput = document.getElementById("new-list-name");

const fontSmallerBtn = document.getElementById("font-smaller-btn");
const fontLargerBtn = document.getElementById("font-larger-btn");

const itemSuggestions = document.getElementById("item-suggestions");

let unsubscribeLists = null;
let unsubscribeItems = null;
let unsubscribeItemHistory = null;
let lists = [];
let itemHistory = [];
let currentListId = localStorage.getItem("grocery-current-list-id") || null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    subscribeToLists();
    subscribeToItemHistory();
  } else {
    appView.classList.add("hidden");
    loginView.classList.remove("hidden");
    if (unsubscribeLists) unsubscribeLists();
    if (unsubscribeItems) unsubscribeItems();
    if (unsubscribeItemHistory) unsubscribeItemHistory();
    unsubscribeLists = null;
    unsubscribeItems = null;
    unsubscribeItemHistory = null;
    itemHistory = [];
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.add("hidden");
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
  } catch (err) {
    loginError.textContent = "Couldn't log in — check your email and password.";
    loginError.classList.remove("hidden");
  }
});

logoutBtn.addEventListener("click", () => {
  if (confirm("Log out?")) signOut(auth);
});

/* ---------- Lists ---------- */

function subscribeToLists() {
  const q = query(collection(db, "lists"), orderBy("createdAt", "asc"));
  unsubscribeLists = onSnapshot(q, async (snapshot) => {
    if (snapshot.empty) {
      await addDoc(collection(db, "lists"), {
        name: "Groceries",
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
      });
      return; // this write triggers another snapshot with the new list in it
    }

    lists = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (!currentListId || !lists.some((l) => l.id === currentListId)) {
      currentListId = lists[0].id;
      localStorage.setItem("grocery-current-list-id", currentListId);
    }

    renderListMenu();
    currentListName.textContent = lists.find((l) => l.id === currentListId)?.name ?? "";
    subscribeToItemsForCurrentList();
  });
}

function subscribeToItemsForCurrentList() {
  if (unsubscribeItems) unsubscribeItems();
  const q = query(itemsCollection(), orderBy("createdAt", "asc"));
  unsubscribeItems = onSnapshot(q, (snapshot) => renderItems(snapshot.docs));
}

function itemsCollection() {
  return collection(db, "lists", currentListId, "items");
}

function switchList(listId) {
  closeListMenu();
  if (listId === currentListId) return;
  currentListId = listId;
  localStorage.setItem("grocery-current-list-id", listId);
  currentListName.textContent = lists.find((l) => l.id === listId)?.name ?? "";
  renderListMenu();
  subscribeToItemsForCurrentList();
}

function renderListMenu() {
  listMenuItems.innerHTML = "";
  for (const list of lists) {
    const li = document.createElement("li");
    li.className = list.id === currentListId ? "active" : "";

    const name = document.createElement("span");
    name.className = "list-name";
    name.textContent = list.name;
    name.addEventListener("click", () => switchList(list.id));

    li.appendChild(name);

    if (lists.length > 1) {
      const del = document.createElement("button");
      del.className = "del-list";
      del.type = "button";
      del.textContent = "✕";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteList(list.id, list.name);
      });
      li.appendChild(del);
    }

    listMenuItems.appendChild(li);
  }
}

async function deleteList(listId, name) {
  if (lists.length <= 1) return;
  if (!confirm(`Delete "${name}"? This removes all of its items.`)) return;

  const itemsSnap = await getDocs(collection(db, "lists", listId, "items"));
  await Promise.all(itemsSnap.docs.map((d) => deleteDoc(doc(db, "lists", listId, "items", d.id))));
  await deleteDoc(doc(db, "lists", listId));

  if (listId === currentListId) {
    currentListId = null; // subscribeToLists' next snapshot will pick a new current list
  }
}

listSwitcherBtn.addEventListener("click", () => {
  listMenu.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!listMenu.classList.contains("hidden") && !listMenu.contains(e.target) && e.target !== listSwitcherBtn) {
    closeListMenu();
  }
});

function closeListMenu() {
  listMenu.classList.add("hidden");
}

newListForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = newListNameInput.value.trim();
  if (!name) return;
  newListNameInput.value = "";
  const ref = await addDoc(collection(db, "lists"), {
    name,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  });
  switchList(ref.id);
});

/* ---------- Items ---------- */

function renderItems(docs) {
  itemList.innerHTML = "";
  emptyState.classList.toggle("hidden", docs.length > 0);

  let hasChecked = false;

  for (const docSnap of docs) {
    const item = docSnap.data();
    const id = docSnap.id;
    if (item.checked) hasChecked = true;

    const li = document.createElement("li");
    li.className = item.checked ? "checked" : "";

    const check = document.createElement("div");
    check.className = "check";
    check.textContent = item.checked ? "✓" : "";
    check.addEventListener("click", () => toggleChecked(id, !item.checked));

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = item.text;
    text.addEventListener("click", () => toggleChecked(id, !item.checked));

    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "✕";
    del.addEventListener("click", () => deleteDoc(doc(db, "lists", currentListId, "items", id)));

    li.append(check, text, del);
    itemList.appendChild(li);
  }

  clearCheckedBtn.classList.toggle("hidden", !hasChecked);
}

function toggleChecked(id, checked) {
  updateDoc(doc(db, "lists", currentListId, "items", id), { checked });
}

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = newItemInput.value.trim();
  if (!text) return;
  newItemInput.value = "";
  closeSuggestions();
  await addDoc(itemsCollection(), {
    text,
    checked: false,
    createdAt: serverTimestamp(),
    addedBy: auth.currentUser.uid,
  });
  recordItemHistory(text);
});

clearCheckedBtn.addEventListener("click", async () => {
  const q = query(itemsCollection(), where("checked", "==", true));
  const snapshot = await getDocs(q);
  await Promise.all(snapshot.docs.map((d) => deleteDoc(doc(db, "lists", currentListId, "items", d.id))));
});

/* ---------- Item history & autofill ---------- */
// Remembers every distinct item text ever added (household-wide, across all lists,
// independent of the lists/items themselves) so it survives deletions and powers autofill.

function subscribeToItemHistory() {
  const q = query(collection(db, "itemHistory"), orderBy("useCount", "desc"), limit(500));
  unsubscribeItemHistory = onSnapshot(q, (snapshot) => {
    itemHistory = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

async function recordItemHistory(text) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return;
  const existing = itemHistory.find((h) => h.normalized === normalized);
  try {
    if (existing) {
      await updateDoc(doc(db, "itemHistory", existing.id), {
        text,
        useCount: increment(1),
        lastUsed: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, "itemHistory"), {
        text,
        normalized,
        useCount: 1,
        lastUsed: serverTimestamp(),
      });
    }
  } catch (err) {
    console.warn("Failed to record item history:", err);
  }
}

newItemInput.addEventListener("input", () => {
  showSuggestions(newItemInput.value);
});

newItemInput.addEventListener("blur", closeSuggestions);

function showSuggestions(value) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return closeSuggestions();

  const matches = itemHistory
    .filter((h) => h.normalized.startsWith(normalized) && h.normalized !== normalized)
    .slice(0, 6);

  if (matches.length === 0) return closeSuggestions();

  itemSuggestions.innerHTML = "";
  for (const match of matches) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggestion";
    btn.textContent = match.text;
    // Prevents the input's blur (which would close this list) from firing before the click does.
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => {
      newItemInput.value = match.text;
      closeSuggestions();
      addForm.requestSubmit();
    });
    itemSuggestions.appendChild(btn);
  }
  itemSuggestions.classList.remove("hidden");
}

function closeSuggestions() {
  itemSuggestions.classList.add("hidden");
  itemSuggestions.innerHTML = "";
}

/* ---------- Text size ---------- */

const FONT_SCALE_KEY = "grocery-font-scale";
const FONT_SCALE_MIN = 0.8;
const FONT_SCALE_MAX = 1.6;
const FONT_SCALE_STEP = 0.1;

let fontScale = parseFloat(localStorage.getItem(FONT_SCALE_KEY)) || 1;

function applyFontScale() {
  document.documentElement.style.fontSize = 100 * fontScale + "%";
  localStorage.setItem(FONT_SCALE_KEY, fontScale);
  fontSmallerBtn.disabled = fontScale <= FONT_SCALE_MIN;
  fontLargerBtn.disabled = fontScale >= FONT_SCALE_MAX;
}

fontSmallerBtn.addEventListener("click", () => {
  fontScale = Math.max(FONT_SCALE_MIN, +(fontScale - FONT_SCALE_STEP).toFixed(2));
  applyFontScale();
});

fontLargerBtn.addEventListener("click", () => {
  fontScale = Math.min(FONT_SCALE_MAX, +(fontScale + FONT_SCALE_STEP).toFixed(2));
  applyFontScale();
});

applyFontScale();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
