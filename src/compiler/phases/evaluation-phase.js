const Logger = require('../../utils/logger');
const DataWalker = require('../../compiler/walker');
const WeaverScope = require('../../template-engine/weaver-scope');

class EvaluationPhase {
  constructor(context) {
    this.context = context;
  }

  execute(compilePlan) {
    // Phase 1: Process only linear topology {{pack::slug}} and basic MATH/PROJECT operations
    Logger.info("▶ [Phase 1] Executing global symbol table forward propagation evaluation (Static Dependency Resolution)...");
    this.context.resolver.skipQuery = true;
    this._runSweep(compilePlan, 3);

    // Phase 2: Global static values settled, deploy catch net for SPREAD and Query operations
    Logger.info("▶ [Phase 2] Executing global dynamic query and pipeline projection (Dynamic Query & SPREAD)...");
    this.context.resolver.skipQuery = false;
    this._runSweep(compilePlan, 2);
  }

  _runSweep(compilePlan, maxPasses) {
    const fullCompileOrder = [...compilePlan.linear, ...compilePlan.cyclic];

    let pass = 0;
    let hasUnresolved = true;

    while (hasUnresolved && pass < maxPasses) {
      pass++;
      hasUnresolved = false;

      for (const key of fullCompileOrder) {
        const weaverDoc = this.context.registry.library.get(key);
        if (!weaverDoc) continue;

        const scope = new WeaverScope({
          selfDoc: weaverDoc,
          hostDoc: weaverDoc.isVirtual ? null : weaverDoc,
          resolver: this.context.resolver
        });

        // 1. Inject flag to allow underlying resolver to report status directly
        scope.hasUnresolved = false;

        const compiledPureJson = DataWalker.walk(weaverDoc.raw, scope);

        // 2. Remove JSON.stringify, determine via flags directly
        if (scope.hasUnresolved) {
          hasUnresolved = true;
        }

        weaverDoc.raw = compiledPureJson;
      }
    }
  }
}

module.exports = EvaluationPhase;
