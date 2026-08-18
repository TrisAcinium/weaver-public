const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const TestSandbox = require('./utils/sandbox-env');
const baseConfig = require('./mock-config');

test('Core Compiler Showcase: Mixins, AST Pipelines, and Cross-File Resolution', async () => {
  const sandbox = new TestSandbox('core-showcase', __dirname);

  // 動態獲取測試沙盒所使用的 MODULE_ID，避免 ID 抓取失效
  const modId = baseConfig.MODULE_ID;

  // 我們將檔案寫入 tests/source/my-pack/ 確保 packId 為 my-pack
  const sourcePackDir = path.join(__dirname, 'source', 'my-pack');
  fs.mkdirSync(path.join(sourcePackDir, 'mixins'), { recursive: true });
  fs.mkdirSync(path.join(sourcePackDir, 'employees'), { recursive: true });

  // Mock Mixin 1: Base Employee
  fs.writeFileSync(path.join(sourcePackDir, 'mixins/base-employee.md'), `---
company: "Weaver Tech Inc."
status: "Active"
access_level: "Standard"
flags:
  ${modId}:
    id: base-employee
    _VIRTUAL_: true
---`);

  // Mock Mixin 2: Admin Policy (Override)
  fs.writeFileSync(path.join(sourcePackDir, 'mixins/admin-policy.md'), `---
access_level: "SuperAdmin"
privileges: ["Read", "Write", "Delete"]
flags:
  ${modId}:
    id: admin-policy
    _VIRTUAL_: true
---`);

  // Mock Host File: Alice (using Mixins and AST Pipelines)
  fs.writeFileSync(path.join(sourcePackDir, 'employees/alice.md'), `---
_EXTENDS_:
  - '{{base-employee}}'
  - '{{admin-policy | POST}}'

name: "Alice"
role: "Engineer"
# Trying to bypass security, but POST policy should override this
access_level: "Guest"

# Reactive cross-reference and pipeline test
welcome_msg: "Welcome to {{self.company}}, {{self.name}}! Your privileges: {{self.privileges | JOIN ', '}}"

flags:
  ${modId}:
    id: emp-alice
---`);

  // 1. Setup and Compile
  sandbox.setup();
  await sandbox.compile();

  // 2. Assertions
  const aliceDoc = sandbox.getDocument('my-pack::emp-alice');
  assert.ok(aliceDoc, 'Alice document should be compiled successfully');

  // Test PRE Mixin application
  assert.strictEqual(
    aliceDoc.company,
    "Weaver Tech Inc.",
    "Should inherit from PRE base-employee mixin"
  );

  // Test POST Mixin override
  assert.strictEqual(
    aliceDoc.access_level,
    "SuperAdmin",
    "POST admin-policy should strictly override host's 'Guest' setting"
  );

  // Test AST Pipeline Evaluation
  assert.strictEqual(
    aliceDoc.welcome_msg,
    "Welcome to Weaver Tech Inc., Alice! Your privileges: Read, Write, Delete",
    "AST Pipeline (JOIN) and string interpolation should evaluate correctly"
  );

  // Test cleanup
  assert.strictEqual(
    aliceDoc._EXTENDS_,
    undefined,
    "Compiler directives like _EXTENDS_ must be cleaned up"
  );

  // 3. Teardown Sandbox & Remove Temp Source
  sandbox.teardown();
  fs.rmSync(sourcePackDir, { recursive: true, force: true });
});

test('DAG Scheduler: Cyclic Dependency Detection and Circuit Breaker', async () => {
  const sandbox = new TestSandbox('cyclic-test', __dirname);
  const modId = baseConfig.MODULE_ID;
  const sourcePackDir = path.join(__dirname, 'source', 'cyclic-pack');

  fs.mkdirSync(path.join(sourcePackDir, 'mixins'), { recursive: true });

  // Node A -> Extends Node B
  fs.writeFileSync(path.join(sourcePackDir, 'mixins/node-a.md'), `---
_EXTENDS_: ['{{node-b}}']
name: "Node A"
flags:
  ${modId}:
    id: node-a
---`);

  // Node B -> Extends Node C
  fs.writeFileSync(path.join(sourcePackDir, 'mixins/node-b.md'), `---
_EXTENDS_: ['{{node-c}}']
name: "Node B"
flags:
  ${modId}:
    id: node-b
---`);

  // Node C -> Extends Node A (Creates the Cycle: A -> B -> C -> A)
  fs.writeFileSync(path.join(sourcePackDir, 'mixins/node-c.md'), `---
_EXTENDS_: ['{{node-a}}']
name: "Node C"
flags:
  ${modId}:
    id: node-c
---`);

  sandbox.setup();

  // The compile execution should NOT stack overflow or hang.
  // It should successfully finish, logging a warning, and gracefully degrading the resolution.
  let errorCaught = false;
  try {
    await sandbox.compile();
  } catch (err) {
    errorCaught = true;
  }

  assert.strictEqual(errorCaught, false, "Compiler should not crash on cyclic dependencies.");

  const nodeC = sandbox.getDocument('cyclic-pack::node-c');
  assert.ok(nodeC, "Documents should still be registered despite the cycle.");

  sandbox.teardown();
  fs.rmSync(sourcePackDir, { recursive: true, force: true });
});
