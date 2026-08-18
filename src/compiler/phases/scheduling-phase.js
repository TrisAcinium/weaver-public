const Logger = require('../../utils/logger');
const ExtendsTool = require('../../utils/extends-tool');
const WeaverScope = require('../../template-engine/weaver-scope');

class SchedulingPhase {
  constructor(context) {
    this.context = context;
  }

  execute() {
    Logger.info("▶ Building compile-time dependency schedule...");
    this.context.scheduler.buildCompileDependencyGraph();
    const compilePlan = this.context.scheduler.generateCompilePlan();
    this.context.scheduler.exportCompileGraph();

    if (compilePlan.cyclic.length > 0) {
      Logger.warn(`[Weaver] ⚠️ Compile-time circular reference nodes detected: ${JSON.stringify(compilePlan.cyclic, null, 2)}`);
    }

    // 1. Topological sort: Ensure depended base documents are processed before callers
    const fullCompileOrder = [...compilePlan.linear, ...compilePlan.cyclic];

    for (const key of fullCompileOrder) {
      const weaverDoc = this.context.registry.library.get(key);
      if (!weaverDoc) continue;

      // 2. Lazy Evaluation
      // If _EXTENDS_ contains keywords dependent on the caller's context
      let isLazyMacro = false;
      if (weaverDoc.raw._EXTENDS_) {
        const exprs = Array.isArray(weaverDoc.raw._EXTENDS_)
          ? weaverDoc.raw._EXTENDS_
          : [];
        // Mark as dynamic macro if array strings contain lazy keywords
        isLazyMacro = exprs.some(expr => typeof expr === 'string' && /\b(host|context|current)\b/.test(expr));
      }

      if (isLazyMacro) {
        continue;
      }

      // 3. Normal static inheritance expansion
      const scope = new WeaverScope({ selfDoc: weaverDoc, hostDoc: weaverDoc, resolver: this.context.resolver });
      weaverDoc.raw = ExtendsTool.apply(weaverDoc.raw, scope);
    }

    return compilePlan;
  }
}

module.exports = SchedulingPhase;
