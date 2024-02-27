import { PGlite } from "https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js";
// xterm module issue here: https://github.com/xtermjs/xterm.js/issues/2878
async function createTable() {
  await db.query(`CREATE TABLE IF NOT EXISTS test (
        id serial primary key,
        title varchar not null
      )`);
  await db.query(
    `INSERT INTO test (title) values ('Hello world') returning id;`
  );
  await db.query("select * from test").then((resultsX) => {
    console.log(JSON.stringify(resultsX));
  });
}

// Initialize xterm.js
const term = new Terminal({ cursorBlink: true });
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);

term.open(document.getElementById("terminal"));
fitAddon.fit();

const PROMPT = "pglite# ";
term.prompt = () => {
  term.write("\r\n" + PROMPT);
};

term.writeln("Welcome to pglite demo terminal!\r\n");
term.write(PROMPT);

// History handler via chatgpt
// Keep track of command history
const commandHistory = [];
let historyIndex = -1;

// Initialize PGlite
const db = new PGlite();
await createTable();

// Pass 'idb://my-pgdata' for indexedDB persistence

term.onKey(async (e) => {
  const printable =
    !e.domEvent.altKey && !e.domEvent.ctrlKey && !e.domEvent.metaKey;
  // Enter key
  if (e.domEvent.keyCode === 13) {
    // Enter key
    var command = term.buffer.active
      .getLine(term.buffer.active.cursorY)
      .translateToString()
      .trim();
    command = command.startsWith(PROMPT)
      ? command.slice(PROMPT.length)
      : PROMPT;
    term.writeln("");
    console.log(command);
    // Add the command to history
    commandHistory.unshift(command);
    historyIndex = -1;
    await executeCommand(command, term);
  } else if (e.domEvent.key === "ArrowUp") {
    // Up arrow key pressed
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      const command = commandHistory[historyIndex];
      term.write(command);
    }
  } else if (e.domEvent.key === "ArrowDown") {
    // Down arrow key pressed
    if (historyIndex >= 0) {
      historyIndex--;
      const command = commandHistory[historyIndex] || "";
      term.write("\x1b[K" + command); // Clear current line and write the command
    }
  } else if (e.domEvent.keyCode === 8) {
    if (term.buffer.active.cursorX > PROMPT.length) term.write("\b \b");
  } else if (printable) {
    term.write(e.key);
  }
});

async function executeCommand(command, term) {
  try {
    const results = await db.query(command);
    const formattedResults = formatResults(results);
    //const formattedResults = arrayToTable(results);

    term.writeln(formattedResults);
  } catch (e) {
    term.writeln(`Error: ${e.message}`);
  } finally {
    term.prompt();
  }
}

// Via https://github.com/nijikokun/array-to-table/
function arrayToMarkdownTable(array, columns, alignment = "center") {
  var table = "";
  var separator = {
    left: ":---",
    right: "---:",
    center: "---",
  };

  // Generate column list
  var cols = columns ? columns.split(",") : Object.keys(array[0]);

  // Generate table headers
  table += cols.join(" | ");
  table += "\r\n";

  // Generate table header seperator
  table += cols
    .map(function () {
      return separator[alignment] || separator.center;
    })
    .join(" | ");
  table += "\r\n";

  // Generate table body
  array.forEach(function (item) {
    table +=
      cols
        .map(function (key) {
          return String(item[key] || "");
        })
        .join(" | ") + "\r\n";
  });

  // Return table
  return table;
}

// With help from ChatGPT
function formatResults(results) {
  let formattedOutput = [];

  if (results.length === 0) {
    formattedOutput.push("\x1b[31mNo results found.\x1b[0m");
  } else {
    const keys = Object.keys(results[0]);
    const columnWidths = {};

    // Calculate the maximum width for each column
    keys.forEach((key) => {
      const maxWidth = Math.max(
        key.length,
        ...results.map((row) => String(row[key]).length)
      );
      columnWidths[key] = maxWidth;
    });

    const lines = [];
    lines.push(
      "|" + keys.map((key) => key.padEnd(columnWidths[key])).join("|") + "|"
    );

    results.forEach((row) => {
      lines.push(
        "|" +
          keys
            .map((key) => String(row[key]).padEnd(columnWidths[key]))
            .join("|") +
          "|"
      );
    });

    const divider =
      "|" + keys.map((key) => "-".repeat(columnWidths[key])).join("|") + "|";

    formattedOutput.push(divider);
    formattedOutput.push(lines[0]);
    formattedOutput.push(divider);
    formattedOutput.push(...lines.slice(1));
    formattedOutput.push(divider);
  }

  formattedOutput = "\r\n" + formattedOutput.join("\r\n");
  return formattedOutput;
}
