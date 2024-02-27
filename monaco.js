// Monaco related UI elements originally via https://rhashimoto.github.io/wa-sqlite/demo/
// and Copyright 2023 Roy T. Hashimoto. All Rights Reserved.

const MONACO_VS =
  "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs";

// PGLite loader
import { PGlite } from "https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js";

// Initialize PGlite
const db = new PGlite();
// We can persist the db in the browser
//const db = new PGlite('idb://my-pgdata')

const DEFAULT_SQL = `
-- Optionally select statements to execute.

CREATE TABLE IF NOT EXISTS test  (
        id serial primary key,
        title varchar not null
      );

INSERT INTO test (title) values ('dummy');

`.trim();

async function createTable() {
  await db.query(DEFAULT_SQL);
  await db.query("select * from test").then((resultsX) => {
    console.log(JSON.stringify(resultsX));
  });
}
createTable();
window.addEventListener("DOMContentLoaded", async function () {
  // Load the Monaco editor
  const button = /** @type {HTMLButtonElement} */ (
    document.getElementById("execute")
  );
  const editorReady = createMonacoEditor().then((editor) => {
    // Change the button text with selection.
    editor.onDidChangeCursorSelection(({ selection }) => {
      button.textContent = selection.isEmpty()
        ? "Execute"
        : "Execute selection";
    });

    return editor;
  });

  // Execute SQL on button click.
  button.addEventListener("click", async function () {
    button.disabled = true;

    // Get SQL from editor.
    const editor = await editorReady;
    const selection = editor.getSelection();
    const queries = selection.isEmpty()
      ? editor.getValue()
      : editor.getModel().getValueInRange(selection);

    // Clear any previous output on the page.
    const output = document.getElementById("output");
    while (output.firstChild) output.removeChild(output.lastChild);

    const timestamp = document.getElementById("timestamp");
    timestamp.textContent = new Date().toLocaleTimeString();

    let time = Date.now();
    console.log(`${queries}`);
    try {
      const results = await db.query(`${queries}`);
      //.then(results => {console.log("results are"+JSON.stringify(results))});

      const resultsDiv = document.getElementById("results");
      resultsDiv.innerHTML = "";
      const table = formatTable(results);
      formatRows(results, table);
      resultsDiv.appendChild(table);
    } catch (e) {
      // Adjust for browser differences in Error.stack().
      const report = (window["chrome"] ? "" : `${e.message}\n`) + e.stack;
      output.innerHTML = `<pre>${report}</pre>`;
    } finally {
      timestamp.textContent += ` ${(Date.now() - time) / 1000} seconds`;
      button.disabled = false;
    }
  });
});

function formatTable(results) {
  const table = document.createElement("table");

  const headerRow = table.insertRow();
  Object.keys(results[0]).forEach((key) => {
    const th = document.createElement("th");
    th.textContent = key;
    headerRow.appendChild(th);
  });
  return table;
}

function formatRows(results, table) {
  results.forEach((rowData) => {
    const row = table.insertRow();
    Object.values(rowData).forEach((value) => {
      const cell = row.insertCell();
      cell.textContent = value;
    });
  });
}

// Monaco handlers
// Via https://rhashimoto.github.io/wa-sqlite/demo/
async function createMonacoEditor() {
  // Insert a script element to bootstrap the monaco loader.
  await new Promise((resolve) => {
    const loader = document.createElement("script");
    loader.src = `${MONACO_VS}/loader.js`;
    loader.async = true;
    loader.addEventListener("load", resolve, { once: true });
    document.head.appendChild(loader);
  });

  // Load monaco itself.
  /** @type {any} */ const require = globalThis.require;
  require.config({ paths: { vs: MONACO_VS } });
  const monaco = await new Promise((resolve) => {
    require(["vs/editor/editor.main"], resolve);
  });

  // Create editor.
  // https://microsoft.github.io/monaco-editor/api/modules/monaco.editor.html#create
  return monaco.editor.create(document.getElementById("editor-container"), {
    language: "sql",
    minimap: { enabled: false },
    automaticLayout: true,
  });
}