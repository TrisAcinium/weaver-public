const path = require('path');
const Logger = require('../../utils/logger');

class EmitPhase {
  constructor(context) {
    this.context = context;
  }

  async execute(compilePlan) {
    const fullCompileOrder = [...compilePlan.linear, ...compilePlan.cyclic];

    // 1. Post-Normalization (Validation and fallback)
    Logger.info("▶ Running post-normalization on global symbols...");
    for (const key of fullCompileOrder) {
      const weaverDoc = this.context.registry.library.get(key);
      if (!weaverDoc) continue;

      const relPath = this.context.registry.sourcePaths.get(key);
      weaverDoc.raw = this.context.postNormalizer.normalize(key, weaverDoc.raw, relPath);
    }

    // 2. Build deployment plan
    Logger.info("▶ Generating deploy-time dependency graph...");
    this.context.scheduler.buildDeployDependencyGraph();
    const deployPlan = this.context.scheduler.generateDeployPlan();
    this.context.scheduler.exportDeployGraph();

    // 3. Emit physical JSON artifacts
    Logger.info("▶ Emitting compiled JSON artifacts to build directory...");
    const fullDeployOrder = [...deployPlan.linear, ...deployPlan.cyclic];
    for (const fullKey of fullDeployOrder) {
      const weaverDoc = this.context.registry.library.get(fullKey);

      if (!weaverDoc || weaverDoc.isVirtual) continue;

      await this.context.io.writeDocument(fullKey, weaverDoc.raw);
    }

    // 4. Export Global Metadata Cache
    await this._exportCompiledCache();
  }

  async _exportCompiledCache() {
    Logger.info("▶ Exporting global metadata cache...");

    const registryCache = [];
    for (const [fullKey, weaverDoc] of this.context.registry.library.entries()) {
      const [packId, slug] = fullKey.split('::');
      const relPath = this.context.registry.sourcePaths.get(fullKey);
      const cleanedDoc = JSON.parse(JSON.stringify(weaverDoc.raw));

      registryCache.push({
        packId,
        slug,
        document: JSON.stringify(cleanedDoc),
        relPath,
      });
    }

    const cacheDest = path.join(this.context.config.BLUEPRINT_DIR, 'weaver.compiled.json');
    await this.context.io.writeJson(cacheDest, registryCache);

    Logger.success(`✅ Global metadata cache exported successfully! (${registryCache.length} records)`);
  }
}

module.exports = EmitPhase;
