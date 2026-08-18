const ObjectTool = require('./object-tool');
const PropertyTool = require('../utils/property-tool');
const Logger = require('./logger');

const ExtendsTool = {
  apply(obj, scope, visited = new Set()) {
    if (!obj || typeof obj !== 'object') return obj;

    const schema = scope.resolver.config.schema;
    let currentTarget = obj;

    if (currentTarget._EXTENDS_) {
      const extendsArray = Array.isArray(currentTarget._EXTENDS_) ? currentTarget._EXTENDS_ : [];
      const isHostVirtual = scope.selfDoc.isVirtual;

      const preItems = [];
      const postItems = [];

      // ==========================================
      // 1. Resolve first, then route based on directives
      // ==========================================
      for (const expr of extendsArray) {
        if (visited.has(expr)) {
          Logger.warn(`[ExtendsTool] Circular _EXTENDS_ dependency detected: ${expr}`);
          continue;
        }

        const resolved = scope.resolver.resolve(expr, scope, true);
        if (!resolved) continue;

        // Unbox: Ensure unified array traversal (supports SPREAD or queries returning arrays)
        let items = [];
        if (resolved.__WEAVER_TYPE__ === 'OBJECT') {
          items = [resolved.val];
        } else if (resolved.__WEAVER_TYPE__ === 'SPREAD') {
          items = resolved.val;
        } else if (Array.isArray(resolved)) {
          items = resolved;
        } else {
          items = [resolved];
        }

        for (const item of items) {
          if (item && typeof item === 'object') {
            let protoVal = item.raw && typeof item.raw === 'object' ? item.raw : item;
            let protoClone = JSON.parse(JSON.stringify(protoVal));

            // If the inherited object also has _EXTENDS_, recursively expand it first
            if (protoClone._EXTENDS_) {
              const nextVisited = new Set(visited);
              nextVisited.add(expr);
              protoClone = this.apply(protoClone, scope, nextVisited);
            }

            // Four-quadrant architecture gatekeeper
            const isBaseVirtual = PropertyTool.get(protoClone, schema.virtualFlagPath) === true;
            if (isHostVirtual && !isBaseVirtual) {
              Logger.error(`❌ [Anti-Pattern] Virtual template (${scope.selfDoc.sourceKey}) attempting to inherit physical data (${expr})! This merge has been skipped.`);
              continue;
            }

            const isPost = PropertyTool.get(protoClone, schema.overridePath) === true;

            this._sanitizeIdentity(protoClone, schema);
            this._sanitizeCompilerDirectives(protoClone, schema);

            PropertyTool.unset(protoClone, schema.overridePath);
            const namespaceObj = PropertyTool.get(protoClone, schema.namespace);
            if (namespaceObj && Object.keys(namespaceObj).length === 0) {
              PropertyTool.unset(protoClone, schema.namespace);
            }
            if (protoClone.flags && Object.keys(protoClone.flags).length === 0) {
              delete protoClone.flags;
            }

            if (isPost) {
              postItems.push(protoClone);
            } else {
              preItems.push(protoClone);
            }
          }
        }
      }

      // ==========================================
      // 2. Deep merge by priority: PRE -> HOST -> POST
      // ==========================================
      let baseObj = {};
      for (const pre of preItems) {
        baseObj = ObjectTool.deepMerge(baseObj, pre);
      }

      let hostData = JSON.parse(JSON.stringify(currentTarget));
      delete hostData._EXTENDS_;
      let mergedObj = ObjectTool.deepMerge(baseObj, hostData);

      for (const post of postItems) {
        mergedObj = ObjectTool.deepMerge(mergedObj, post);
      }

      currentTarget = mergedObj;
    }

    // ==========================================
    // 3. Recursive deep object processing (Handle nested _EXTENDS_)
    // ==========================================
    for (const key in currentTarget) {
      if (currentTarget[key] && typeof currentTarget[key] === 'object') {
        currentTarget[key] = this.apply(currentTarget[key], scope, visited);
      }
    }

    return currentTarget;
  },

  /**
   * Clear file-specific identifiers
   */
  _sanitizeIdentity(protoClone, schema) {
    if (!protoClone || typeof protoClone !== 'object') return;
    PropertyTool.unset(protoClone, schema.identifierPath);
    PropertyTool.unset(protoClone, schema.sourceKeyPath);
    PropertyTool.unset(protoClone, schema.relPathPath);
    PropertyTool.unset(protoClone, schema.editorFolderPath);
    PropertyTool.unset(protoClone, schema.folderPathPath);
    PropertyTool.unset(protoClone, schema.tasksPath);
    PropertyTool.unset(protoClone, schema.virtualFlagPath);
    PropertyTool.unset(protoClone, schema.unindexableFlagPath);

    const docType = PropertyTool.get(protoClone, schema.docTypePath);
    if (typeof docType === 'string' && docType.startsWith('Virtual')) {
      PropertyTool.unset(protoClone, schema.docTypePath);
    }
  },

  /**
   * Strip compiler state and control directives from Prototype
   */
  _sanitizeCompilerDirectives(protoClone, schema) {
    if (!protoClone || typeof protoClone !== 'object') return;
    delete protoClone._EXTENDS_;
    delete protoClone._TEMPLATE_;
  },
};

module.exports = ExtendsTool;
