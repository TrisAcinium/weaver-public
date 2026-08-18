const fs = require('fs');
const path = require('path');
const PackCompiler = require('../../bin/compile');
const baseConfig = require('../mock-config');

class TestSandbox {
  /**
   * @param {string} testName - Test identifier name (used as temp folder name)
   * @param {string} testDir - Absolute path of test script (pass __dirname)
   */
  constructor(testName, testDir) {
    this.testName = testName;
    this.testDir = testDir;

    // Create isolated sandbox path
    this.sandboxRoot = path.join(baseConfig.WORKSPACE, `build/tests/sandbox_${testName}`);
    this.sandboxDataDir = path.join(this.sandboxRoot, 'data');
    this.blueprintDir = path.join(this.sandboxRoot, 'blueprints');

    // Dynamically override environment configs
    this.config = {
      ...baseConfig,
      WORKSPACE: this.sandboxRoot,
      SOURCE_DIRS: [ 'data' ],
      BLUEPRINT_DIR: this.blueprintDir,
      IGNORED_PACKS: []
    };

    this.registry = null;
  }

  /**
   * 1. Clear old sandbox
   * 2. Automatically copy 'source/' next to the script into the sandbox's 'data/'
   */
  setup() {
    this.teardown();

    const sourceDir = path.join(this.testDir, 'source');
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`[TestSandbox] Test source directory not found: ${sourceDir}. Please ensure 'source/' directory exists inside the test folder.`);
    }

    // Recursive copy natively supported by Node.js 16.7+, retains all Pack subdirectory structures
    fs.cpSync(sourceDir, this.sandboxDataDir, { recursive: true });
  }

  /**
   * Execute compiler and save Registry
   */
  async compile() {
    const compiler = new PackCompiler(this.config);
    await compiler.exec();

    // Backward compatibility
    const testLibrary = new Map();
    for (const [key, doc] of compiler.registry.library.entries()) {
      testLibrary.set(key, doc.raw);
    }
    compiler.registry.library = testLibrary;
    this.registry = compiler.registry;

    return this.registry;
  }

  /**
   * Clear physical sandbox files
   */
  teardown() {
    if (fs.existsSync(this.sandboxRoot)) {
      fs.rmSync(this.sandboxRoot, { recursive: true, force: true });
    }
  }

  // ==============================================================================
  // Assertion Helpers - Keep test scripts clean
  // ==============================================================================

  /**
   * Quickly retrieve compiled JSON object
   * @param {string} fullKey - Format is "packId::slug"
   */
  getDocument(fullKey) {
    if (!this.registry) throw new Error("Please execute sandbox.compile() first");
    return this.registry.library.get(fullKey);
  }
}

module.exports = TestSandbox;
