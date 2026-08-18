#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const WORKSPACE_ROOT = process.cwd();
const DATA_DIR = path.resolve(WORKSPACE_ROOT, process.argv[2] || 'data');
const EXTENSIONS = ['.yml', '.yaml', '.md'];

let errorCount = 0;
let fileCount = 0;

function lintFile(filePath) {
  const relativePath = path.relative(WORKSPACE_ROOT, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  let fileHasError = false;

  const logError = (type, msg, lineNum = null) => {
    if (!fileHasError) {
      console.log(`\n${YELLOW}[FILE] ${relativePath}${RESET}`);
      fileHasError = true;
    }
    const pos = lineNum ? `${RED}[LINE ${lineNum}]${RESET} ` : '';
    console.log(`  ${pos}[${type}] ${msg}`);
    errorCount++;
  };

  // 1. YAML Boundary Check (for .md)
  if (path.extname(filePath) === '.md') {
    const separators = content.split(/^---$/m).length - 1;
    if (separators < 2) {
      logError('ERR_FORMAT', 'Incomplete YAML boundary (requires two --- separators)');
    }
  }

  // 2. Content Character Check
  lines.forEach((line, index) => {
    // A. Full-width space check (retain or permit based on requirements)
    if (/\u3000/.test(line)) {
      logError('ERR_GREMLIN', `Full-width space detected: "${line.trim()}"`, index + 1);
    }

    // B. Precise TAB Check: Only verify if the "leading indentation area" contains TABs
    // Extract the "leading indent" before the first non-space/non-TAB character via Regex
    const indentMatch = line.match(/^[\s\t]*/);
    if (indentMatch && /\t/.test(indentMatch[0])) {
      logError(
        'ERR_TAB_INDENT',
        'TABs are prohibited in YAML indentation. Please use half-width spaces instead.',
        index + 1
      );
    }
  });

  fileCount++;
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`${YELLOW}ℹ️  [SKIP] Directory does not exist: ${dir}${RESET}`);
    return;
  }

  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', '.git', 'build', 'dist'].includes(file)) scanDir(fullPath);
    } else if (EXTENSIONS.includes(path.extname(fullPath))) {
      lintFile(fullPath);
    }
  });
}

console.log(`${CYAN}--- [LINT] Weaver Data Format Check ---${RESET}`);
console.log(`${CYAN}Workspace: ${WORKSPACE_ROOT}${RESET}`);
console.log(`${CYAN}Target: ${DATA_DIR}${RESET}\n`);

scanDir(DATA_DIR);

if (errorCount > 0) {
  console.log(`\n${RED}[FAIL] Check failed: Found ${errorCount} errors.${RESET}\n`);
  process.exit(1);
} else {
  if (fileCount === 0) {
    console.log(`${YELLOW}[WARN] No checkable files found.${RESET}\n`);
  } else {
    console.log(`${GREEN}[PASS] Scanned ${fileCount} files, all formats correct.${RESET}\n`);
  }
  process.exit(0);
}
