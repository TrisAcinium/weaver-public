const ObjectTool = require('../utils/object-tool');
const WeaverScope = require('../template-engine/weaver-scope');
const Logger = require('../utils/logger');
const ExtendsTool = require('../utils/extends-tool');
const PropertyTool = require('../utils/property-tool');

const CONFIG = require('../utils/config-loader')();

class DataWalker {
  /**
   * Depth-first traversal evaluation
   */
  static walk(document, scope, visited = new WeakSet()) {
    const schema = scope.resolver.config.schema;
    const tagSymbols = scope.resolver.config.TAG.SYMBOLS;

    if (document === null || typeof document !== 'object') {
      return document;
    }

    // Circular reference protection to prevent Call Stack overflow from infinite loops
    if (visited.has(document)) {
      return document;
    }
    visited.add(document);

    // shortcut
    if (typeof document === 'string') {
      if (document.length > 2 &&
        !document.includes(tagSymbols.EXPR_LEFT) &&
        !document.includes(tagSymbols.REF_LEFT)) {
        return document;
      }
      return scope.resolver.resolve(document, scope, true);
    }

    // ====================================================================
    // Lazy inheritance expansion
    // ====================================================================
    if (document._EXTENDS_) {
      document = JSON.parse(JSON.stringify(document));
      document = ExtendsTool.apply(document, scope);
    }

    const { self: currentSelf, resolver } = scope;

    // ─── Array node evaluation and spread expansion ───
    if (Array.isArray(document)) {
      return document.flatMap(item => {
        let resolved = (typeof item === 'string')
          ? resolver.resolve(item, scope, true)
          : item;

        if (resolved?.__WEAVER_TYPE__ === 'SPREAD') {
          return resolved.val.map(i => this.walk(i, scope, visited));
        }
        if (resolved?.__WEAVER_TYPE__ === 'OBJECT') {
          resolved = resolved.val;
        }

        if (resolved && typeof resolved === 'object') {
          const innerKey = PropertyTool.get(resolved, schema.sourceKeyPath) || resolved._SOURCE_KEY_;
          const currentKey = PropertyTool.get(currentSelf, schema.sourceKeyPath) || currentSelf._SOURCE_KEY_;
          if (innerKey === currentKey) {
            return resolved;
          }
          return this.walk(resolved, scope, visited);
        }

        return resolved;
      });
    }

    // ─── Deep object property traversal and context switching ───
    const out = {};
    const sourceKey = PropertyTool.get(document, schema.sourceKeyPath) ?? document._SOURCE_KEY_;
    const sourceDoc = sourceKey ? resolver.registry.library.get(sourceKey) : null;
    const mySelf = sourceDoc ? sourceDoc.raw : currentSelf;

    const isBoundary = !!sourceKey;
    const newScope = scope.derive(
      mySelf,
      isBoundary ? mySelf : scope.contextDoc,
      scope.currentDoc,
      isBoundary ? mySelf : scope.hostDoc
    );

    const isVirtual = PropertyTool.get(mySelf, schema.virtualFlagPath) === true;
    for (const [k, v] of Object.entries(document)) {
      if (k === '_TEMPLATE_' && isVirtual) {
        out[k] = JSON.parse(JSON.stringify(v));
        continue;
      }

      let res = (typeof v === 'string')
        ? resolver.resolve(v, newScope, true)
        : this.walk(v, newScope, visited);

      // Ensure objects emitted from pipelines can be further unboxed and fully Walked
      if (res?.__WEAVER_TYPE__ === 'OBJECT') {
        res = res.val;
        if (res && typeof res === 'object') {
          res = this.walk(res, newScope, visited);
        }
      }

      out[k] = res;
    }

    return out;
  }
}

module.exports = DataWalker;
