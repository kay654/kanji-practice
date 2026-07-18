const MAX_ENTRIES = 36;
const PAGE_COLUMNS = 12;
const PAGE_ROWS = 18;
const STORAGE_KEY = "kanji-practice-sheet";
const STORAGE_KEY_PREFIX = "kanji-practice-sheet-";
const HISTORY_STORAGE_KEY = "kanji-practice-print-history";
const MAX_HISTORY_ITEMS = 100;
const PREVIEW_ZOOM_STEP = 0.08;
const INITIAL_WORDS = [""];
const SAMPLE_SIZE = "12mm";
const SAMPLE_OPACITY = 0.68;
const GRADES = [
  { label: "1年", key: "小1" },
  { label: "2年", key: "小2" },
  { label: "3年", key: "小3" },
  { label: "4年", key: "小4" },
  { label: "5年", key: "小5" },
  { label: "6年", key: "小6" }
];

let entries = [...INITIAL_WORDS];
let idiomData = window.GRADED_IDIOMS || {};
let idiomDataLoaded = Boolean(window.GRADED_IDIOMS);
let currentGradeKey = "小1";
let selectedIdioms = new Set();
let lastFocusedElement = null;
let pointerReorder = null;
let selectedHistoryId = null;
let previewZoomSteps = 0;
let previewResizeFrame = 0;

const entryList = document.getElementById("entryList");
const entryCount = document.getElementById("entryCount");
const reorderStatus = document.getElementById("reorderStatus");
const sheetsContainer = document.getElementById("sheetsContainer");
const printRoot = document.getElementById("printRoot");
const addButton = document.getElementById("addButton");
const chooseIdiomsButton = document.getElementById("chooseIdiomsButton");
const idiomModal = document.getElementById("idiomModal");
const gradeButtons = document.getElementById("gradeButtons");
const idiomList = document.getElementById("idiomList");
const selectedCount = document.getElementById("selectedCount");
const closeIdiomDialogButton = document.getElementById("closeIdiomDialogButton");
const cancelIdiomButton = document.getElementById("cancelIdiomButton");
const addSelectedIdiomsButton = document.getElementById("addSelectedIdiomsButton");
const openHistoryButton = document.getElementById("openHistoryButton");
const historyModal = document.getElementById("historyModal");
const closeHistoryButton = document.getElementById("closeHistoryButton");
const cancelHistoryButton = document.getElementById("cancelHistoryButton");
const restoreHistoryButton = document.getElementById("restoreHistoryButton");
const historyList = document.getElementById("historyList");
const historyHelp = document.getElementById("historyHelp");
const historyMessage = document.getElementById("historyMessage");
const zoomOutButton = document.getElementById("zoomOutButton");
const zoomInButton = document.getElementById("zoomInButton");

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(saved.entries) && saved.entries.length) {
      entries = saved.entries.slice(0, MAX_ENTRIES).map((word) => String(word));
    }
    if (GRADES.some((grade) => grade.key === saved.currentGradeKey)) {
      currentGradeKey = saved.currentGradeKey;
    }
  } catch {}
  cleanupStorage();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    entries,
    currentGradeKey
  }));
  cleanupStorage();
}

function loadPrintHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((item) => item && typeof item.id === "string" && Array.isArray(item.entries))
      .slice(0, MAX_HISTORY_ITEMS)
      .map((item) => ({
        id: item.id,
        printedAt: String(item.printedAt || ""),
        entries: item.entries.slice(0, MAX_ENTRIES).map((word) => String(word)).filter((word) => word.trim())
      }))
      .filter((item) => item.entries.length);
  } catch {
    return [];
  }
}

function savePrintHistory(history) {
  const remaining = history.slice(0, MAX_HISTORY_ITEMS);
  while (remaining.length) {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(remaining));
      return;
    } catch {
      remaining.pop();
    }
  }
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {}
}

function createHistoryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function saveCurrentPrintHistory() {
  const printedEntries = getPreviewWords();
  if (!printedEntries.length) return;
  const signature = JSON.stringify(printedEntries);
  const history = loadPrintHistory().filter((item) => JSON.stringify(item.entries) !== signature);
  history.unshift({
    id: createHistoryId(),
    printedAt: new Date().toISOString(),
    entries: printedEntries
  });
  savePrintHistory(history);
}

function formatHistoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderPrintHistory() {
  const history = loadPrintHistory();
  historyList.innerHTML = "";
  historyHelp.textContent = history.length
    ? `印刷した内容を新しい順に保存しています（${history.length}／${MAX_HISTORY_ITEMS}件）。`
    : `印刷した内容を新しい順に最大${MAX_HISTORY_ITEMS}件保存します。`;
  if (!history.some((item) => item.id === selectedHistoryId)) selectedHistoryId = null;

  if (!history.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "印刷履歴はまだありません。";
    historyList.append(empty);
  }

  history.forEach((item) => {
    const formattedDate = formatHistoryDate(item.printedAt);
    const row = document.createElement("article");
    row.className = "history-item";
    row.dataset.historyId = item.id;

    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "history-choice";
    choice.setAttribute("aria-pressed", String(item.id === selectedHistoryId));

    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = formattedDate;
    const count = document.createElement("span");
    count.className = "history-count";
    count.textContent = `${item.entries.length}個`;
    const preview = document.createElement("span");
    preview.className = "history-preview";
    preview.textContent = `${item.entries.slice(0, 3).join(" ／ ")}${item.entries.length > 3 ? " ほか" : ""}`;
    choice.append(date, count, preview);
    choice.addEventListener("click", () => {
      selectedHistoryId = item.id;
      historyMessage.textContent = "";
      updateHistorySelection();
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "history-delete";
    deleteButton.textContent = "削除";
    deleteButton.setAttribute("aria-label", `${formattedDate}の履歴を削除`);
    deleteButton.addEventListener("click", () => {
      savePrintHistory(loadPrintHistory().filter((entry) => entry.id !== item.id));
      if (selectedHistoryId === item.id) selectedHistoryId = null;
      historyMessage.textContent = `${formattedDate}の履歴を削除しました。`;
      renderPrintHistory();
    });

    row.append(choice, deleteButton);
    historyList.append(row);
  });
  updateHistorySelection();
}

function updateHistorySelection() {
  historyList.querySelectorAll(".history-item").forEach((row) => {
    const selected = row.dataset.historyId === selectedHistoryId;
    row.classList.toggle("is-selected", selected);
    row.querySelector(".history-choice")?.setAttribute("aria-pressed", String(selected));
  });
  restoreHistoryButton.disabled = !selectedHistoryId;
}

function openHistoryDialog() {
  lastFocusedElement = document.activeElement;
  selectedHistoryId = null;
  historyMessage.textContent = "";
  renderPrintHistory();
  historyModal.hidden = false;
  (historyList.querySelector(".history-choice") || closeHistoryButton).focus();
}

function closeHistoryDialog() {
  historyModal.hidden = true;
  selectedHistoryId = null;
  historyMessage.textContent = "";
  if (lastFocusedElement instanceof HTMLElement) lastFocusedElement.focus();
  lastFocusedElement = null;
}

function restoreSelectedPrintHistory() {
  const selected = loadPrintHistory().find((item) => item.id === selectedHistoryId);
  if (!selected) {
    historyMessage.textContent = "復元する履歴を選択してください。";
    updateHistorySelection();
    return;
  }
  entries = selected.entries.length ? [...selected.entries] : [...INITIAL_WORDS];
  renderEntryInputs();
  updateAll();
  closeHistoryDialog();
}

function cleanupStorage() {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(STORAGE_KEY_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
}

function splitPages(words) {
  const pages = [];
  for (let index = 0; index < words.length; index += PAGE_COLUMNS) {
    pages.push(words.slice(index, index + PAGE_COLUMNS));
  }
  return pages.length ? pages : [[]];
}

function getPreviewWords() {
  return entries.map((word) => word.trim()).filter(Boolean);
}

function getAvailableEntrySlots() {
  const blankCount = entries.filter((word) => word.trim() === "").length;
  return blankCount + Math.max(0, MAX_ENTRIES - entries.length);
}

function updateEntryCount() {
  entryCount.textContent = `${entries.length} / ${MAX_ENTRIES}`;
  addButton.disabled = entries.length >= MAX_ENTRIES;
  chooseIdiomsButton.disabled = getAvailableEntrySlots() <= 0;
}

function renderEntryInputs() {
  entryList.innerHTML = "";
  entries.forEach((word, index) => {
    const row = document.createElement("div");
    row.className = "entry-row";
    row.dataset.index = index;

    const indexWrap = document.createElement("div");
    indexWrap.className = "row-order-control";
    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "drag-handle";
    dragHandle.setAttribute("aria-label", `${index + 1}番の項目を並べ替え`);
    dragHandle.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
    dragHandle.title = "ドラッグ、または Alt＋↑／↓ で並べ替え";
    dragHandle.disabled = entries.length <= 1;
    dragHandle.addEventListener("pointerdown", (event) => beginPointerReorder(event, index, row, dragHandle));
    dragHandle.addEventListener("pointermove", updatePointerReorder);
    dragHandle.addEventListener("pointerup", finishPointerReorder);
    dragHandle.addEventListener("pointercancel", cancelPointerReorder);
    dragHandle.addEventListener("keydown", (event) => handleReorderKeydown(event, index));
    const number = document.createElement("span");
    number.className = "row-number";
    number.textContent = index + 1;
    indexWrap.append(dragHandle, number);

    const input = document.createElement("input");
    input.type = "text";
    input.value = word;
    input.maxLength = 20;
    input.placeholder = `漢字・熟語 ${index + 1}`;
    input.setAttribute("aria-label", `漢字・熟語 ${index + 1}`);
    input.addEventListener("input", () => {
      entries[index] = input.value;
      updateAll();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const inputs = entryList.querySelectorAll("input");
      const nextInput = inputs[index + 1];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      } else {
        addButton.focus();
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "×";
    deleteButton.title = "削除";
    deleteButton.setAttribute("aria-label", `${index + 1}行目を削除`);
    deleteButton.disabled = entries.length <= 1;
    deleteButton.addEventListener("click", () => {
      entries.splice(index, 1);
      renderEntryInputs();
      updateAll();
    });

    row.append(indexWrap, input, deleteButton);
    entryList.append(row);
  });
  updateEntryCount();
}

function moveEntry(sourceIndex, targetIndex, focusHandle = true) {
  if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0 || sourceIndex >= entries.length || targetIndex >= entries.length) return;
  const [movedEntry] = entries.splice(sourceIndex, 1);
  entries.splice(targetIndex, 0, movedEntry);
  renderEntryInputs();
  updateAll();
  reorderStatus.textContent = `${sourceIndex + 1}番の項目を${targetIndex + 1}番へ移動しました。`;
  if (focusHandle) {
    requestAnimationFrame(() => {
      entryList.querySelector(`.entry-row[data-index="${targetIndex}"] .drag-handle`)?.focus();
    });
  }
}

function handleReorderKeydown(event, index) {
  if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
  event.preventDefault();
  const targetIndex = event.key === "ArrowUp" ? Math.max(0, index - 1) : Math.min(entries.length - 1, index + 1);
  moveEntry(index, targetIndex);
}

function beginPointerReorder(event, index, row, handle) {
  if (event.button !== 0 || entries.length <= 1) return;
  event.preventDefault();
  handle.focus();
  handle.setPointerCapture?.(event.pointerId);
  pointerReorder = { pointerId: event.pointerId, sourceIndex: index, insertionIndex: index, startY: event.clientY, row, handle, started: false };
}

function updatePointerReorder(event) {
  if (!pointerReorder || event.pointerId !== pointerReorder.pointerId) return;
  if (!pointerReorder.started && Math.abs(event.clientY - pointerReorder.startY) < 5) return;
  if (!pointerReorder.started) {
    pointerReorder.started = true;
    pointerReorder.row.classList.add("is-dragging");
    entryList.classList.add("is-reordering");
    reorderStatus.textContent = `${pointerReorder.sourceIndex + 1}番の項目を移動中です。`;
  }
  event.preventDefault();
  const rows = Array.from(entryList.querySelectorAll(".entry-row"));
  let insertionIndex = rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const rect = rows[index].getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) {
      insertionIndex = index;
      break;
    }
  }
  pointerReorder.insertionIndex = insertionIndex;
  rows.forEach((row) => row.classList.remove("drop-before", "drop-after"));
  if (insertionIndex < rows.length) rows[insertionIndex].classList.add("drop-before");
  else rows[rows.length - 1]?.classList.add("drop-after");
  const controls = entryList.closest(".controls");
  if (controls) {
    const rect = controls.getBoundingClientRect();
    if (event.clientY < rect.top + 48) controls.scrollTop -= 14;
    if (event.clientY > rect.bottom - 48) controls.scrollTop += 14;
  }
}

function finishPointerReorder(event) {
  if (!pointerReorder || event.pointerId !== pointerReorder.pointerId) return;
  const state = pointerReorder;
  const targetIndex = state.insertionIndex > state.sourceIndex ? state.insertionIndex - 1 : state.insertionIndex;
  clearPointerReorder();
  if (state.started && targetIndex !== state.sourceIndex) moveEntry(state.sourceIndex, Math.max(0, Math.min(entries.length - 1, targetIndex)));
  else state.handle.focus();
}

function cancelPointerReorder(event) {
  if (!pointerReorder || event.pointerId !== pointerReorder.pointerId) return;
  const wasStarted = pointerReorder.started;
  clearPointerReorder();
  if (wasStarted) reorderStatus.textContent = "並べ替えをキャンセルしました。";
}

function clearPointerReorder() {
  if (!pointerReorder) return;
  pointerReorder.row.classList.remove("is-dragging");
  entryList.classList.remove("is-reordering");
  entryList.querySelectorAll(".drop-before, .drop-after").forEach((row) => row.classList.remove("drop-before", "drop-after"));
  pointerReorder = null;
}

function createCell(character) {
  const cell = document.createElement("div");
  cell.className = "practice-cell";
  if (character) {
    const sample = document.createElement("span");
    sample.className = "sample-char";
    sample.textContent = character;
    cell.append(sample);
  }
  return cell;
}

function createSheetHeader() {
  const header = document.createElement("header");
  header.className = "sheet-header";

  const title = document.createElement("h3");
  title.className = "sheet-title";
  title.textContent = "漢字れんしゅう";

  const date = document.createElement("div");
  date.className = "sheet-date-field";
  date.innerHTML = '<span class="sheet-date-value"></span><span>がつ</span><span class="sheet-date-value"></span><span>にち</span>';

  const name = document.createElement("div");
  name.className = "sheet-name-field";
  name.innerHTML = '<span>なまえ（</span><span class="sheet-name-value"></span><span>）</span>';

  header.append(title, date, name);
  return header;
}

function createPracticeGrid(words) {
  const grid = document.createElement("div");
  grid.className = "practice-grid";
  for (let row = 0; row < PAGE_ROWS; row += 1) {
    for (let column = 0; column < PAGE_COLUMNS; column += 1) {
      const word = words[PAGE_COLUMNS - 1 - column] || "";
      const chars = Array.from(word);
      grid.append(createCell(chars[row] || ""));
    }
  }
  return grid;
}

function applySettings(sheetElement) {
  sheetElement.style.setProperty("--sample-size", SAMPLE_SIZE);
  sheetElement.style.setProperty("--sample-opacity", SAMPLE_OPACITY);
}

function createPrintArea(pageWords, pageIndex) {
  const printArea = document.createElement("div");
  printArea.className = "print-area";
  applySettings(printArea);

  const sheet = document.createElement("article");
  sheet.className = "sheet";
  sheet.setAttribute("aria-label", `漢字練習シート ${pageIndex + 1}ページ`);
  sheet.append(createSheetHeader(), createPracticeGrid(pageWords));

  printArea.append(sheet);
  return printArea;
}

function createSheet(pageWords, pageIndex) {
  const preview = document.createElement("div");
  preview.className = "sheet-preview";
  const printArea = createPrintArea(pageWords, pageIndex);

  preview.append(printArea);
  return preview;
}

function createPrintPage(pageWords, pageIndex) {
  const page = document.createElement("div");
  page.className = "print-page";
  page.append(createPrintArea(pageWords, pageIndex));
  return page;
}

function renderPreview() {
  const words = getPreviewWords();
  const pages = splitPages(words);
  sheetsContainer.innerHTML = "";
  printRoot.innerHTML = "";
  pages.forEach((pageWords, pageIndex) => {
    sheetsContainer.append(createSheet(pageWords, pageIndex));
    printRoot.append(createPrintPage(pageWords, pageIndex));
  });

}

function getPreviewBaseScale() {
  const value = Number(getComputedStyle(sheetsContainer).getPropertyValue("--preview-base-scale"));
  return Number.isFinite(value) && value > 0 ? value : 0.58;
}

function getPreviewMaxScale(baseScale) {
  const paperWidthPx = 210 * 96 / 25.4;
  const availableWidth = Math.max(0, sheetsContainer.clientWidth - 4);
  return Math.max(baseScale, Math.min(1, availableWidth / paperWidthPx));
}

function updatePreviewZoom() {
  const baseScale = getPreviewBaseScale();
  const maxScale = getPreviewMaxScale(baseScale);
  const maxSteps = Math.ceil(Math.max(0, maxScale - baseScale) / PREVIEW_ZOOM_STEP);
  previewZoomSteps = Math.max(0, Math.min(previewZoomSteps, maxSteps));
  const scale = Math.min(maxScale, baseScale + previewZoomSteps * PREVIEW_ZOOM_STEP);

  if (previewZoomSteps === 0) {
    sheetsContainer.style.removeProperty("--preview-scale");
    sheetsContainer.style.removeProperty("--preview-w");
    sheetsContainer.style.removeProperty("--preview-h");
  } else {
    sheetsContainer.style.setProperty("--preview-scale", scale.toFixed(4));
    sheetsContainer.style.setProperty("--preview-w", `${(210 * scale).toFixed(3)}mm`);
    sheetsContainer.style.setProperty("--preview-h", `${(297 * scale).toFixed(3)}mm`);
  }
  zoomOutButton.disabled = previewZoomSteps === 0;
  zoomInButton.disabled = scale >= maxScale - 0.001;
}

function schedulePreviewZoomUpdate() {
  cancelAnimationFrame(previewResizeFrame);
  previewResizeFrame = requestAnimationFrame(updatePreviewZoom);
}

function updateAll() {
  updateEntryCount();
  renderPreview();
  saveState();
}

function addEntry() {
  if (entries.length >= MAX_ENTRIES) return;
  entries.push("");
  renderEntryInputs();
  updateAll();
  const inputs = entryList.querySelectorAll("input");
  inputs[inputs.length - 1].focus();
}

function resetAll() {
  entries = [...INITIAL_WORDS];
  renderEntryInputs();
  updateAll();
}

function loadIdiomData() {
  idiomData = window.GRADED_IDIOMS || {};
  idiomDataLoaded = Object.keys(idiomData).length > 0;
  updateEntryCount();
  return Promise.resolve(idiomData);
}

function renderGradeButtons() {
  gradeButtons.innerHTML = "";
  GRADES.forEach((grade) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "grade-button";
    button.textContent = grade.label;
    button.setAttribute("aria-label", `${grade.label}の熟語を表示`);
    button.classList.toggle("is-active", grade.key === currentGradeKey);
    button.addEventListener("click", () => {
      currentGradeKey = grade.key;
      saveState();
      renderGradeButtons();
      renderIdiomCards();
    });
    gradeButtons.append(button);
  });
}

function renderIdiomCards() {
  idiomList.innerHTML = "";
  const idioms = idiomData[currentGradeKey] || [];
  if (idioms.length === 0) {
    const message = document.createElement("p");
    message.className = "idiom-message";
    message.textContent = idiomDataLoaded ? "この学年の熟語がありません。" : "熟語を読みこめませんでした。";
    idiomList.append(message);
    return;
  }

  const fragment = document.createDocumentFragment();
  idioms.forEach((idiom) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "idiom-card";
    button.textContent = idiom;
    button.setAttribute("aria-label", `${idiom}をえらぶ`);
    button.classList.toggle("is-selected", selectedIdioms.has(idiom));
    button.addEventListener("click", () => {
      if (selectedIdioms.has(idiom)) {
        selectedIdioms.delete(idiom);
        button.classList.remove("is-selected");
      } else {
        selectedIdioms.add(idiom);
        button.classList.add("is-selected");
      }
      updateSelectedCount();
    });
    fragment.append(button);
  });
  idiomList.append(fragment);
}

function updateSelectedCount() {
  const count = selectedIdioms.size;
  selectedCount.textContent = `選んだ熟語：${count}こ`;
  addSelectedIdiomsButton.disabled = count === 0;
  addSelectedIdiomsButton.textContent = count === 0 ? "追加する" : `${count}こ追加する`;
}

async function openIdiomDialog() {
  lastFocusedElement = document.activeElement;
  selectedIdioms = new Set();
  idiomModal.hidden = false;
  idiomList.innerHTML = '<p class="idiom-message">熟語を読みこんでいます。</p>';
  updateSelectedCount();
  closeIdiomDialogButton.focus();
  await loadIdiomData();
  renderGradeButtons();
  renderIdiomCards();
  updateSelectedCount();
}

function closeIdiomDialog() {
  idiomModal.hidden = true;
  selectedIdioms.clear();
  if (lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus();
  }
}

function addSelectedIdioms() {
  if (selectedIdioms.size === 0) return;
  const existing = new Set(entries.map((word) => word.trim()).filter(Boolean));
  const selected = Array.from(selectedIdioms).filter((idiom) => !existing.has(idiom));

  selected.forEach((idiom) => {
    if (getAvailableEntrySlots() <= 0) return;
    const blankIndex = entries.findIndex((word) => word.trim() === "");
    if (blankIndex >= 0) {
      entries[blankIndex] = idiom;
    } else {
      entries.push(idiom);
    }
    existing.add(idiom);
  });

  renderEntryInputs();
  updateAll();
  closeIdiomDialog();
}

function cleanupPrintMode() {
  document.body.classList.remove("is-printing");
  window.removeEventListener("afterprint", cleanupPrintMode);
  window.removeEventListener("focus", cleanupPrintMode);
}

function waitForPrintFonts() {
  if (!document.fonts) return Promise.resolve();
  return Promise.race([
    document.fonts.ready,
    new Promise((resolve) => {
      setTimeout(resolve, 1200);
    })
  ]);
}

async function printSheets() {
  saveCurrentPrintHistory();
  document.body.classList.add("is-printing");
  await waitForPrintFonts();
  window.addEventListener("afterprint", cleanupPrintMode, { once: true });
  window.addEventListener("focus", cleanupPrintMode, { once: true });
  setTimeout(cleanupPrintMode, 10000);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
    });
  });
}

addButton.addEventListener("click", addEntry);
document.getElementById("headerResetButton").addEventListener("click", resetAll);
document.getElementById("printButton").addEventListener("click", printSheets);
chooseIdiomsButton.addEventListener("click", openIdiomDialog);
closeIdiomDialogButton.addEventListener("click", closeIdiomDialog);
cancelIdiomButton.addEventListener("click", closeIdiomDialog);
addSelectedIdiomsButton.addEventListener("click", addSelectedIdioms);
openHistoryButton.addEventListener("click", openHistoryDialog);
closeHistoryButton.addEventListener("click", closeHistoryDialog);
cancelHistoryButton.addEventListener("click", closeHistoryDialog);
restoreHistoryButton.addEventListener("click", restoreSelectedPrintHistory);
zoomInButton.addEventListener("click", () => {
  previewZoomSteps += 1;
  updatePreviewZoom();
});
zoomOutButton.addEventListener("click", () => {
  previewZoomSteps -= 1;
  updatePreviewZoom();
});
idiomModal.addEventListener("click", (event) => {
  if (event.target === idiomModal) {
    closeIdiomDialog();
  }
});
historyModal.addEventListener("click", (event) => {
  if (event.target === historyModal) closeHistoryDialog();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!historyModal.hidden) closeHistoryDialog();
  else if (!idiomModal.hidden) closeIdiomDialog();
});
window.addEventListener("resize", schedulePreviewZoomUpdate);

loadState();
renderEntryInputs();
renderPreview();
updatePreviewZoom();
loadIdiomData();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
