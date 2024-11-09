import { PGlite } from "https://cdn.jsdelivr.net/npm/@electric-sql/pglite/dist/index.js";
import { seed } from './seeds/01-test.js';

// xterm module issue here: https://github.com/xtermjs/xterm.js/issues/2878

// Database initialization functions
const ensureTablesExist = async () => {
  // test table
  await db.query(`CREATE TABLE IF NOT EXISTS test (
    id serial primary key,
    title varchar not null
  )`);

  // seeds table
  await db.query(`CREATE TABLE IF NOT EXISTS seeds (
    id serial primary key,
    name varchar not null,
    run_at timestamp default current_timestamp
  )`);
};

const checkSeedStatus = async (seedName) => {
  const seedCheck = await db.query(
    `SELECT id FROM seeds WHERE name = $1`,
    [seedName]
  );
  return seedCheck.rows.length > 0;
};

const markSeedComplete = async (seedName) => {
  await db.query(
    `INSERT INTO seeds (name) values ($1)`,
    [seedName]
  );
};

const runSeed = async (seedName, seedFunction) => {
  const isSeeded = await checkSeedStatus(seedName);
  
  if (!isSeeded) {
    await db.query('BEGIN');
    try {
      await seedFunction(db);  // Pass db to the seed function
      await markSeedComplete(seedName);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }
};

const createTable = async () => {
  await ensureTablesExist();
  await runSeed('01-test', seed);
};

//
// -----------------------------------------------------
//

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

let multiline_command = [];

// Initialize PGlite
const db = new PGlite('idb://my-pgdata') // const db = new PGlite();
await createTable();

// Pass 'idb://my-pgdata' for indexedDB persistence

// Variable to store the current command
let command = '';

// Event listener for cursor move
term.onCursorMove(() => {
    // Update the command variable with the content of the current line
    command = term.buffer.active.getLine(term.buffer.active.cursorY).translateToString().trim();
    command = command.startsWith(PROMPT)
          ? command.slice(PROMPT.length)
          : command;
    // Handle the command content as needed
    //console.log("command fragment: " + command);
});

term.onKey(async (e) => {
  const printable =
    !e.domEvent.altKey && !e.domEvent.ctrlKey && !e.domEvent.metaKey;
  // Enter key
  if (e.domEvent.keyCode === 13) {
    term.writeln("");
    console.log("enter command fragment: " + command);
    if (command != "") multiline_command.push(command);
    console.log("mll: " + JSON.stringify(multiline_command));
    if (command.endsWith(';')) {
        command = multiline_command.join(" ");
        try {
          await executeCommand(command, term);
          // Add the command fragment to history
          commandHistory.unshift(command);
          historyIndex = -1;
        } catch (e) {
          // Adjust for browser differences in Error.stack().
          const report = (window["chrome"] ? "" : `${e.message}\n`) + e.stack;
          output.innerHTML = `<pre>${report}</pre>`;
        } finally {
        }
        multiline_command = [];
    }
    
  } else if (e.domEvent.key === "ArrowUp" && multiline_command.length==0 ) {
    // Up arrow key pressed
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      const command = commandHistory[historyIndex];
      term.write("\x1b[K" + command);
    }
  } else if (e.domEvent.key === "ArrowDown" && multiline_command.length == 0) {
    // Down arrow key pressed
    if (historyIndex >= 0) {
      historyIndex--;
      const command = commandHistory[historyIndex] || "";
      term.write("\x1b[K" + command); // Clear current line and write the command
    }
  } else if (e.domEvent.keyCode === 8) {
    // backspace
    if (multiline_command.length == 0) {
       if (term.buffer.active.cursorX > PROMPT.length)
            term.write("\b \b");
    } else term.write("\b \b");
  } else if (e.domEvent.ctrlKey && e.domEvent.key === "c") {
    term.writeln("");
    term.prompt();
    multiline_command = [];
    command = "";
  } else if (printable) {
    term.write(e.key);
  }
});

async function executeCommand(command, term) {
  console.log("trying")
  const results = await db.query(command);
  console.log("results");
  console.log(JSON.stringify(results));
  try {
    const results = await db.query(command);
    console.log(JSON.stringify(results));
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

// results format:
//{"rows":[{"?column?":"asas"}],"fields":[{"name":"?column?","dataTypeID":25}],"affectedRows":0}

function formatResults(results) {
  let formattedOutput = [];

  if (results.rows.length === 0) {
    formattedOutput.push("\x1b[31mNo results found.\x1b[0m");
  } else {
    const keys = results.fields.map((field) => field.name);
    const columnWidths = {};

    // Calculate the maximum width for each column
    keys.forEach((key) => {
      const maxWidth = Math.max(
        key.length,
        ...results.rows.map((row) => String(row[key]).length)
      );
      columnWidths[key] = maxWidth;
    });

    const lines = [];
    lines.push(
      "|" + keys.map((key) => key.padEnd(columnWidths[key])).join("|") + "|"
    );

    results.rows.forEach((row) => {
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
