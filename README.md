[![CI](https://github.com/TrisAcinium/weaver-public/actions/workflows/ci.yml/badge.svg)](https://github.com/TrisAcinium/weaver-public/actions/workflows/ci.yml)

# Weaver: Declarative Metadata Compiler

> **Notice:** This repository is a **code architecture and design showcase** extracted and simplified from a private engine. It is strictly intended for technical review and portfolio display.

A compiler that brings reactivity, mixins, and AST pipelines to static configuration files. 

Weaver is a powerful metadata compilation engine designed to solve "configuration hell." It transforms scattered, static YAML/Markdown files into a reactive, dependency-resolved JSON graph.

## Technical Highlights & Architecture

Weaver was built with a strict adherence to **Data/Logic Separation**, ensuring that content creators and system logic remain decoupled. 

* **Directed Acyclic Graph (DAG) Compilation:** Implements custom topological sorting and DFS-based cycle detection (circuit breakers) to guarantee correct cross-file resolution order without infinite loops.
* **Zero-Dependency State-Machine Lexer:** Replaces slow Regex parsing with a robust, character-by-character state machine to safely evaluate AST tags, entirely immune to string literal traps.
* **Incremental Build Ready:** Features a strict multi-phase compiler pipeline (Discovery -> Scheduling -> Evaluation -> Emit) combined with fast hashing (`hash-tool.js`) to support highly performant incremental updates.
* **Virtual File System (VFS):** Abstracted IO Handlers that dynamically load and parse hierarchical data from heterogeneous sources into a unified memory registry.

## The Problem It Solves
In large-scale applications (e.g., game development, CMS, enterprise permission systems), managing static configurations via plain JSON or YAML often leads to duplication and rigid data structures.

* **Before Weaver:** 500 lines of highly repetitive data where updating a shared trait requires manual find-and-replace across dozens of files.
* **After Weaver:** 50 lines of modular, DRY Markdown/YAML files. Update the base mixin, and the compiler instantly propagates the changes across the entire output tree.

---

## Core Features (Under the Hood)

### 1. Schema Composition & Deep Merging (`_EXTENDS_`)
Achieve true Don't-Repeat-Yourself (DRY) configurations. Files can inherit base templates (`PRE`), and optionally apply decorators (`POST`) that forcefully override the host's data.

### 2. Reactive Cross-File Resolution & Scopes
You don't need to specify build orders. Weaver builds a **Directed Acyclic Graph (DAG)** of all your data files and performs **Topological Sorting** to guarantee correct resolution order.
* **Namespace & Scopes:**
  * `{{self.property}}`: Targets the current document.
  * `{{pack::slug.property}}`: Targets a specific document globally across your workspace.
* **Safety First:** Circular dependencies are caught during the DAG scheduling phase, throwing a strict `[RECURSION DEADLOCK]` error instead of infinite looping. Undefined variables degrade safely.

### 3. AST Data Pipeline (Core DSL)
Weaver features a safe, non-`eval()` pipeline engine. Data can be piped through built-in commands to transform values dynamically:
* `| JOIN 'char'`: Joins array elements into a formatted string.
* `| SORT 'key'`: Dynamically sorts array or object structures.
* `| POST`: A special directive used in `_EXTENDS_` to force late-binding overrides.

---

## Quick Showcase

To understand how Weaver merges and resolves data, consider the following files.

**1. The Mixins (Base Data)**
```yaml
# base-employee.yml
company_name: "Weaver Tech Inc."
access_level: "Standard"

# admin-policy.yml
access_level: "SuperAdmin"
system_privileges: ["Read", "Write", "Delete"]
```

**2. The Host File (Input)**
```yaml
# emp-alice.yml
---
_EXTENDS_:
  - '{{base-employee}}'            # 1. Inherit default attributes (PRE)
  - '{{admin-policy | POST}}'      # 2. Forcefully override with admin privileges (POST)

name: "Alice"
department: "Engineering"
# Reactive string interpolation & cross-file reference
welcome_msg: "Hi {{self.name}}, welcome to {{self.company_name}}!"

flags:
  weaver-core:
    id: emp-alice
---
```

**3. Fully Resolved, Clean JSON (Output)**
Weaver deeply merges the files, evaluates the `{{ }}` tags, and outputs a clean JSON file ready for production.
```json
{
  "name": "Alice",
  "department": "Engineering",
  "company_name": "Weaver Tech Inc.",
  "access_level": "SuperAdmin",
  "system_privileges": ["Read", "Write", "Delete"],
  "welcome_msg": "Hi Alice, welcome to Weaver Tech Inc.!",
  "flags": {
    "weaver-core": {
      "id": "emp-alice"
    }
  }
}
```

---

## Compilation Phases

Weaver's compilation process mirrors standard compiler design, ensuring stability and performance:

```
[ Discovery Phase ] ──► [ Scheduling Phase ] ──► [ Evaluation Phase ] ──► [ Emit Phase ]
       │                         │                        │                     │
  Scans VFS &              Resolves AST             Evaluates Tags          Outputs Final
  Builds Graph             Dependencies             & Pipelines             Artifacts
```

1. **Discovery Phase (`discovery-phase.js`):** Scans source directories via VFS, parsing YAML/Markdown and normalizing them into a global symbol registry.
2. **Scheduling Phase (`scheduling-phase.js`):** Parses AST expressions, builds the Dependency Graph, detects circular references, and generates a safe execution plan.
3. **Evaluation Phase (`evaluation-phase.js`):** Walks through the AST of every document, injecting dependencies, executing pipelines, and mutating the data tree.
4. **Emit Phase (`emit-phase.js`):** Strips out internal compilation directives (such as `_EXTENDS_`) and outputs clean, production-ready `.json` artifacts.

---

## Progressive Learning Examples

We provide a progressive learning curve to demonstrate the engine's capabilities. Check out the `examples/` directory:

* **`01-hello-weaver`**: Introduction to basic variables, string interpolation, and cross-file references.
* **`02-pipelines-and-flow`**: Utilizing the AST Pipeline for data transformation.
* **`03-schema-inheritance`**: Mastering the `_EXTENDS_` mechanism with base templates and overrides.

To run any example, navigate to the directory and run `make`:
```bash
cd examples/01-hello-weaver
make
```

---

## Showcase Scope & Limitations

To protect proprietary business logic while presenting clean software architecture, this repository operates under a constrained scope:

* **Engine Architecture:** Multi-pass compilation, AST Lexer/Evaluator, and VFS mechanics are fully readable to demonstrate code aesthetics and engineering patterns.
* **Pipelines & Handlers:** Limited to essential showcase commands (`extends-override`, `join`, `sort`). Auxiliary production transformers have been omitted.
* **Execution Target:** Maintained exclusively for running predefined example suites in `examples/`.

---

## License & Usage Terms

**Copyright (c) 2026. All Rights Reserved.**

This repository is strictly **Showcase-Only Code** for portfolio and code-review purposes.

* [PROHIBITED] **No Grant of License:** No permission is granted to copy, modify, merge, publish, distribute, sublicense, or sell this software or its parts.
* [PROHIBITED] **No Production Use:** Use of these compiler pipelines or VFS architecture in commercial, personal, or third-party products is strictly prohibited.
