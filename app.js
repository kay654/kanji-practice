const MAX_ENTRIES = 30;
const PAGE_COLUMNS = 12;
const PAGE_ROWS = 18;
const STORAGE_KEY = "kanji-practice-sheet-v2";
const INITIAL_WORDS = [];
const SIZE_MAP = {
  small: "10.5mm",
  normal: "12mm",
  large: "13.4mm"
};
const OPACITY_MAP = {
  light: 0.38,
  normal: 0.68,
  dark: 1
};

let entries = [...INITIAL_WORDS];

const entryList = document.getElementById("entryList");
const entryCount = document.getElementById("entryCount");
const previewStatus = document.getElementById("previewStatus");
const sheetsContainer = document.getElementById("sheetsContainer");

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(saved.entries) && saved.entries.length) {
      entries = saved.entries.slice(0, MAX_ENTRIES);
    }
    if (saved.charSize) {
      const sizeInput = document.querySelector(`input[name="charSize"][value="${saved.charSize}"]`);
      if (sizeInput) sizeInput.checked = true;
    }
    if (saved.sampleOpacity) {
      const opacityInput = document.querySelector(`input[name="sampleOpacity"][value="${saved.sampleOpacity}"]`);
      if (opacityInput) opacityInput.checked = true;
    }
  } catch {}
}

function saveState() {
  const settings = getSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    entries,
    charSize: settings.charSize,
    sampleOpacity: settings.sampleOpacity
  }));
}

function getSettings() {
  return {
    charSize: document.querySelector("input[name='charSize']:checked").value,
    sampleOpacity: document.querySelector("input[name='sampleOpacity']:checked").value
  };
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

function updateEntryCount() {
  entryCount.textContent = `${entries.length} / ${MAX_ENTRIES}`;
  document.getElementById("addButton").disabled = entries.length >= MAX_ENTRIES;
}

function renderEntryInputs() {
  entryList.innerHTML = "";
  entries.forEach((word, index) => {
    const row = document.createElement("div");
    row.className = "entry-row";

    const indexWrap = document.createElement("div");
    indexWrap.className = "row-index";
    indexWrap.innerHTML = '<span class="drag-dots" aria-hidden="true"></span>';
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
  const settings = getSettings();
  sheetElement.style.setProperty("--sample-size", SIZE_MAP[settings.charSize]);
  sheetElement.style.setProperty("--sample-opacity", OPACITY_MAP[settings.sampleOpacity]);
}

function applySettingsToAllSheets() {
  document.querySelectorAll(".print-area").forEach((sheetElement) => {
    applySettings(sheetElement);
  });
}

function createSheet(pageWords, pageIndex) {
  const preview = document.createElement("div");
  preview.className = "sheet-preview";

  const printArea = document.createElement("div");
  printArea.className = "print-area";
  applySettings(printArea);

  const sheet = document.createElement("article");
  sheet.className = "sheet";
  sheet.setAttribute("aria-label", `漢字練習シート ${pageIndex + 1}ページ`);
  sheet.append(createSheetHeader(), createPracticeGrid(pageWords));

  printArea.append(sheet);
  preview.append(printArea);
  return preview;
}

function renderPreview() {
  const words = getPreviewWords();
  const pages = splitPages(words);
  sheetsContainer.innerHTML = "";
  pages.forEach((pageWords, pageIndex) => {
    sheetsContainer.append(createSheet(pageWords, pageIndex));
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

function updateSettingsOnly() {
  applySettingsToAllSheets();
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
  document.querySelector("input[name='charSize'][value='normal']").checked = true;
  document.querySelector("input[name='sampleOpacity'][value='dark']").checked = true;
  renderEntryInputs();
  updateAll();
}

document.getElementById("addButton").addEventListener("click", addEntry);
document.getElementById("headerResetButton").addEventListener("click", resetAll);
document.getElementById("printButton").addEventListener("click", () => window.print());

document.querySelectorAll("input[name='charSize'], input[name='sampleOpacity']").forEach((input) => {
  input.addEventListener("change", updateSettingsOnly);
});

loadState();
renderEntryInputs();
renderPreview();
