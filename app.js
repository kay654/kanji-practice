const MAX_ENTRIES = 36;
const PAGE_COLUMNS = 12;
const PAGE_ROWS = 18;
const STORAGE_KEY = "kanji-practice-sheet-v2";
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

const entryList = document.getElementById("entryList");
const entryCount = document.getElementById("entryCount");
const previewStatus = document.getElementById("previewStatus");
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

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(saved.entries) && saved.entries.length) {
      entries = saved.entries.slice(0, MAX_ENTRIES);
    }
    if (GRADES.some((grade) => grade.key === saved.currentGradeKey)) {
      currentGradeKey = saved.currentGradeKey;
    }
  } catch {}
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    entries,
    currentGradeKey
  }));
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

    const indexWrap = document.createElement("div");
    indexWrap.className = "row-index";
    const number = document.createElement("span");
    number.textContent = index + 1;
    indexWrap.append(number);

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

  const sheetCount = pages.length;
  const wordCount = words.length;
  previewStatus.textContent = `（A4 たて・${sheetCount}シート・${wordCount}個）`;
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

function printSheets() {
  document.body.classList.add("is-printing");
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
idiomModal.addEventListener("click", (event) => {
  if (event.target === idiomModal) {
    closeIdiomDialog();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !idiomModal.hidden) {
    closeIdiomDialog();
  }
});

loadState();
renderEntryInputs();
renderPreview();
loadIdiomData();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
