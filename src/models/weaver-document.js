const PropertyTool = require('../utils/property-tool');

class WeaverDocument {
  /**
   * @param {Object} rawData - Raw parsed JSON object
   */
  constructor(rawData, config) {
    this.raw = rawData || {};
    this.schema = config?.schema || require('../utils/config-loader')().schema;
  }

  // ==========================================
  // Core Identification
  // ==========================================

  get slug() {
    return PropertyTool.get(this.raw, this.schema.identifierPath);
  }

  get docType() {
    return PropertyTool.get(this.raw, this.schema.docTypePath) || 'Item';
  }

  get isVirtual() {
    return !!PropertyTool.get(this.raw, this.schema.virtualFlagPath);
  }

  get isStaticAsset() {
    return !!PropertyTool.get(this.raw, this.schema.staticAssetFlagPath);
  }

  // ==========================================
  // Physical and Topology Paths
  // ==========================================

  get sourceKey() {
    return PropertyTool.get(this.raw, this.schema.sourceKeyPath);
  }

  get packId() {
    const key = this.sourceKey;
    return key ? key.split('::')[0] : null;
  }

  get relPath() {
    return PropertyTool.get(this.raw, this.schema.relPathPath);
  }

  // ==========================================
  // System Internal Scheduling and Pipelines
  // ==========================================

  get tasks() {
    return PropertyTool.get(this.raw, this.schema.tasksPath) || [];
  }

  get extends() {
    return this.raw._EXTENDS_ || null;
  }

  hasExtends() {
    return !!this.raw._EXTENDS_;
  }

  get isUnindexable() {
    return !!PropertyTool.get(this.raw, this.schema.unindexableFlagPath);
  }

  // ==========================================
  // Data Operations
  // ==========================================

  cleanForExport() {
    const exportData = JSON.parse(JSON.stringify(this.raw));
    if (exportData._EXTENDS_) delete exportData._EXTENDS_;
    return exportData;
  }
}

module.exports = WeaverDocument;
