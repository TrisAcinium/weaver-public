#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const WORKSPACE = process.cwd();
const DIRS_TO_CLEAN = [
  path.join(WORKSPACE, 'build'),
  path.join(WORKSPACE, 'dist')
];

function clean() {
  console.log(`${CYAN}--- [CLEAN] 🧹 Cleaning workspace artifacts ---${RESET}`);

  DIRS_TO_CLEAN.forEach(dir => {
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`${GREEN}✅ [SUCCESS] Removed: ${path.relative(WORKSPACE, dir)}${RESET}`);
      } catch (err) {
        console.error(`${RED}❌ [ERROR] Could not remove ${dir}: ${err.message}${RESET}`);
      }
    }
  });

  const BLUEPRINT_DIR = path.join(WORKSPACE, 'build/blueprints');
  fs.mkdirSync(BLUEPRINT_DIR, { recursive: true });
  console.log(`${GREEN}📁 [INFO] Compilation buffer created: build/blueprints/${RESET}\n`);
}

clean();
