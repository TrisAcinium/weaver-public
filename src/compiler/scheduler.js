const { mkdirSync, writeFileSync } = require('fs');
const path = require('path');

class DependencyScheduler {
  /**
   * @param {Object} config - Weaver 配置
   * @param {Object} registry - 資料庫
   */
  constructor(config, registry) {
    this.config = config;
    this.registry = registry;

    this.compileDependencies        = new Map(); // {{}} 正向
    this.compileReverseDependencies = new Map(); // {{}} 反向
    this.compileCyclics             = new Set(); // {{}} 循環
    this.deployDependencies         = new Map(); // [[]] 正向
    this.deployReverseDependencies  = new Map(); // [[]] 反向
    this.deployCyclics              = new Set(); // [[]] 循環
  }

  /** 建立編譯期依賴圖 */
  buildCompileDependencyGraph() {
    const compileOptions = {
      tagRegex: this.config?.REGEX?.EXPR_TAG ?? /\{\{([^\\[\]\{\}]+)\}\}/g,
    };

    this._buildDependency(
      this.compileDependencies,
      this.compileReverseDependencies,
      this.compileCyclics,
      compileOptions,
    );
  }

  /** 建立執行期依賴圖 */
  buildDeployDependencyGraph() {
    const deployOptions = {
      tagRegex: this.config?.REGEX?.REF_TAG ?? /\[\[([^\\[\]\{\}]+)\]\]/g,
    };

    this._buildDependency(
      this.deployDependencies,
      this.deployReverseDependencies,
      this.deployCyclics,
      deployOptions,
    );
  }

  /** 產出編譯期線性執行計畫 */
  generateCompilePlan() {
    return this._generatePlan(this.compileDependencies, this.compileCyclics);
  }

  /** 產出部署期線性執行計畫 (包含反向依賴表) */
  generateDeployPlan() {
    const rawPlan = this._generatePlan(this.deployDependencies, this.deployCyclics);

    const isPhysicalKey = (fullKey) => {
      const document = this.registry.library.get(fullKey);
      return document ? !document.isVirtual : false;
    };

    const physicalLinear = rawPlan.linear.filter(isPhysicalKey);
    const physicalCyclic = rawPlan.cyclic.filter(isPhysicalKey);

    const physicalReverseDeps = {};
    for (const [targetKey, dependentSet] of this.deployReverseDependencies.entries()) {
      if (!isPhysicalKey(targetKey)) continue;

      const physicalDependents = Array.from(dependentSet).filter(isPhysicalKey);
      if (physicalDependents.length > 0) {
        physicalReverseDeps[targetKey] = physicalDependents;
      }
    }

    return {
      linear: physicalLinear,
      cyclic: physicalCyclic,
      reverse: physicalReverseDeps,
    };
  }

  /** 匯出編譯期 Mermaid 圖 */
  exportCompileGraph() {
    this._exportGraph(this.compileDependencies, 'compile_dependency_graph.mmd');
  }

  /** 匯出部署期 Mermaid 圖 */
  exportDeployGraph() {
    this._exportGraph(this.deployDependencies, 'deploy_dependency_graph.mmd');
  }

  // ==============================================================================
  // 私有函數
  // ==============================================================================

  /** @private */
  _buildDependency(dependencies, reverseDependencies, cyclics, options = {}) {
    dependencies.clear();
    reverseDependencies.clear();

    const registry = this.registry;
    for (const [fullKey, document] of registry.library.entries()) {
      this._analyzeDocumentDependency(
        registry,
        fullKey,
        document,
        this._addDependency.bind(this, dependencies, reverseDependencies),
        options
      );
    }

    this._detectCycles(dependencies, cyclics);
  }

  /**
   * 深度遞迴掃描物件的所有屬性，抽取 AST 符號
   * @private
   */
  _analyzeDocumentDependency(registry, selfFullKey, documentNode, addDependency, options = {}, visited = new WeakSet()) {
    if (!documentNode || typeof documentNode !== 'object') return;

    if (visited.has(documentNode)) return;
    visited.add(documentNode);

    for (const [propertyKey, propertyValue] of Object.entries(documentNode)) {
      switch (typeof propertyValue) {
        case 'object':
          this._analyzeDocumentDependency(registry, selfFullKey, propertyValue, addDependency, options, visited);
          break;
        case 'string':
          let match, tagRegex = options.tagRegex;
          tagRegex.lastIndex = 0;

          while ((match = tagRegex.exec(propertyValue)) !== null) {
            const rawTagContent = match[1] ?? match[2];
            if (!rawTagContent) continue;

            let expression = rawTagContent.split('|')[0].trim();

            const targetFullKey = registry.resolveFullKey(expression);
            if (targetFullKey && targetFullKey !== selfFullKey) {
              addDependency(selfFullKey, targetFullKey);
            }
          }
      }
    }
  }

  /** @private */
  _addDependency(forwardMap, reverseMap, fromKey, toKey) {
    if (!forwardMap.has(fromKey)) forwardMap.set(fromKey, new Set());
    forwardMap.get(fromKey).add(toKey);

    if (!reverseMap.has(toKey)) reverseMap.set(toKey, new Set());
    reverseMap.get(toKey).add(fromKey);
  }

  /**
   * Performs a Depth-First Search (DFS) to detect circular dependencies within the graph.
   * Utilizes a 3-color marking algorithm (White: 0, Gray: 1, Black: 2) to identify back-edges.
   *
   * @private
   * @param {Map<string, Set<string>>} dependencies - The forward dependency graph.
   * @param {Set<string>} cyclics - A mutable set to store detected circular nodes.
   */
  _detectCycles(dependencies, cyclics) {
    cyclics.clear();

    // Node states:
    // 0 / undefined = Unvisited (White)
    // 1 = Visiting / In current DFS call stack (Gray)
    // 2 = Fully visited & safe (Black)
    const state = new Map();

    /**
     * Recursive DFS traversal helper.
     * @param {string} node - The current node identifier.
     * @returns {boolean} True if a cycle is detected down the current path.
     */
    const hasCycle = (node) => {
      state.set(node, 1); // Mark as Gray

      const neighbors = dependencies.get(node) || new Set();
      for (const neighbor of neighbors) {
        const neighborState = state.get(neighbor) || 0;

        if (neighborState === 1) {
          // 🎯 Back-edge detected! The neighbor is already in the current traversal stack.
          cyclics.add(node);
          cyclics.add(neighbor);
          return true; // Trigger circuit breaker
        }

        if (neighborState === 0) {
          if (hasCycle(neighbor)) {
            // Propagate the circuit breaker upwards
            cyclics.add(node);
            return true;
          }
        }
      }

      state.set(node, 2); // Mark as Black
      return false;
    };

    // Initiate DFS only for non-isolated nodes to optimize performance
    for (const node of dependencies.keys()) {
      if ((state.get(node) || 0) === 0) {
        hasCycle(node);
      }
    }
  }

  /**
   * 排程計畫生成
   * @private
   */
  _generatePlan(dependencies, cyclics) {
    const linear = [];
    const visited = new Set();

    const visit = (key) => {
      if (visited.has(key) || cyclics.has(key)) return;
      visited.add(key);

      const currentDeps = dependencies.get(key) ?? new Set();
      for (const depKey of currentDeps) {
        visit(depKey);
      }

      linear.push(key);
    };

    // 編譯順序權重排序演算法
    // 由於靜態掃描無法捕捉「動態拼接的依賴」（如 {{{{host...}}-theatre.webp}}）
    // 這會導致基礎資源（Assets/Virtual）成為孤島，若遍歷順序不佳會被排在實體卡片之後編譯。
    // 我們透過賦予節點優先級，強制將無靜態依賴的基礎設施提早推入 linear 計畫。
    const keys = Array.from(this.registry.library.keys());
    keys.sort((a, b) => {
      const docA = this.registry.library.get(a);
      const docB = this.registry.library.get(b);

      const getPriority = (doc) => {
        if (!doc) return 3;

        // Tier 1: 純二進位資產 (圖片、音訊) - 絕對無依賴，最先就緒
        if (doc.isStaticAsset) return 1;

        // Tier 2: 虛擬模板與原型 (Virtual Templates, Mixins)
        if (doc.isVirtual) return 2;

        // Tier 3: 實體卡片(Actor/Item/Adventure) 與 TextAssets (HTML/CSS) 殿後聚合
        return 3;
      };

      const prioA = getPriority(docA);
      const prioB = getPriority(docB);

      if (prioA !== prioB) return prioA - prioB;
      return a.localeCompare(b); // 權重相同時以 slug 字母排序保證穩定性
    });

    // 改以排序後的 keys 作為 DFS 的進入點
    for (const key of keys) {
      if (!visited.has(key)) visit(key);
    }

    return {
      linear,
      cyclic: Array.from(cyclics)
    };
  }

  /**
   * 通用型 Mermaid 匯出
   * @private
   */
  _exportGraph(dependencies, fileName) {
    let mmd = "graph TD\n";
    for (const [from, deps] of dependencies.entries()) {
      const fromSlug = from.split('::').pop();
      deps.forEach(to => {
        const toSlug = to.split('::').pop();
        mmd += `  ${from.replace(/[^a-z0-9]/gi, '_')}["${fromSlug}"] --> ${to.replace(/[^a-z0-9]/gi, '_')}["${toSlug}"]\n`;
      });
    }
    const out = path.join(this.config.WORKSPACE, 'build', fileName);
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, mmd);
  }
}

module.exports = DependencyScheduler;
