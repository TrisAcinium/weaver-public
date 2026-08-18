const WeaverDocument = require('../models/weaver-document');

class DataRegistry {
  constructor(configParam) {
    let config = configParam;
    if (!config) {
      config = require('../utils/config-loader')();
    }
    this.config = config;
    this.moduleId = config.MODULE_ID;

    this.library = new Map();      // FullKey -> WeaverDocument entity
    this.slugIndex = new Map();    // Slug -> [PackIds] (used for cross-pack global search)
    this.sourcePaths = new Map();  // FullKey -> Relative path of the original physical file
  }

  /**
   * Register raw symbols
   */
  register(packId, slug, rawData, relPath) {
    const fullKey = `${packId}::${slug}`;

    if (this.library.has(fullKey) && !rawData?._SILENCE_SLUG_CONFLICT_) {
      console.error(`💥 [CONFLICT] Severe ID conflict: ${fullKey} at data/${relPath}`);
      return fullKey;
    } else if (this.slugIndex.has(slug) && !rawData?._SILENCE_SLUG_CONFLICT_) {
      const existingPackId = this.slugIndex.get(slug)[0];
      const existingFullKey = `${existingPackId}::${slug}`;
      const existingPath = this.sourcePaths.get(existingFullKey) || "Unknown Path";

      console.warn(`⚠️ [SLUG CONFLICT] Cross-pack Slug name collision "${slug}" (Existing: ${existingPackId}::${existingPath} ➔ Current: ${packId}::${relPath})`);
    }

    const doc = new WeaverDocument(rawData, this.config);

    this.library.set(fullKey, doc);
    this.sourcePaths.set(fullKey, relPath);

    if (!this.slugIndex.has(slug)) this.slugIndex.set(slug, []);
    this.slugIndex.get(slug).push(packId);

    return fullKey;
  }

  getRaw(fullKey) {
    const doc = this.library.get(fullKey);
    return doc ? doc.raw : null;
  }

  /**
   * Accepts raw expression string, returns globally unique identifier
   * @param {string} expression - Raw expression inside the tag
   * @returns {string|null} Globally unique identifier fullKey, or null if not found
   */
  resolveFullKey(expression) {
    if (!expression || typeof expression !== 'string') return null;

    let pId = null;
    let oId = expression;

    // 1. Physical split of Pack boundary (::)
    if (expression.includes('::')) {
      const parts = expression.split('::');
      pId = parts[0];
      oId = parts[1];
    }

    // 2. Physical split of property path boundary (.)
    if (oId.includes('.')) {
      oId = oId.split('.')[0];
    }

    // 3. Precise location routing via global index defense line
    const fullKey = `${pId}::${oId}`;
    if (pId && this.library.has(fullKey)) {
      return fullKey;
    }

    // If pId is not provided, launch cross-pack global Slug search
    const packs = this.slugIndex.get(oId) || [];
    return packs.length > 0 ? `${packs[0]}::${oId}` : null;
  }
}

module.exports = DataRegistry;
