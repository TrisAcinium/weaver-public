const PropertyTool = require('../utils/property-tool');
const PipelineHub = require('./pipeline-hub');
const WeaverScope = require('./weaver-scope');
const Logger = require('../utils/logger');

const CONFIG = (require('../utils/config-loader'))();

class TagEvaluator {
  /**
   * Evaluates a clean token dynamically and returns its final raw data
   * (Object, Array, String, or Primitive)
   */
  static evaluate(token, scope) {
    if (!token) return '';

    switch (token.type) {
      case CONFIG.TAG.TYPES.REF:
        return this._evaluateReference(token.content, scope);
      case CONFIG.TAG.TYPES.EXPR:
        return this._evaluateExpression(token.content, scope);
      default:
        return token.raw;
    }
  }

  /**
   * Traces back the underlying document instance for a given token expression
   * @param {Object} token - Current processing token
   * @param {Object} scope - Active WeaverScope context
   * @returns {Object} Target document model or falls back to scope.selfDoc
   */
  static traceSource(token, scope) {
    if (!token || !scope) return scope?.selfDoc;

    if (token.type !== CONFIG.TAG.TYPES.EXPR) {
      return scope.selfDoc;
    }

    const baseExpression = token.content.split('|')[0].trim();

    if (baseExpression.startsWith('current')) return scope.currentDoc || scope.contextDoc || scope.selfDoc;
    if (baseExpression.startsWith('context')) return scope.contextDoc || scope.selfDoc;
    if (baseExpression.startsWith('host')) return scope.hostDoc || scope.selfDoc;
    if (baseExpression.startsWith('self')) return scope.selfDoc;

    const registry = scope.resolver?.registry;
    if (registry) {
      const dotIdx = baseExpression.indexOf('.');
      const rootKey = dotIdx !== -1 ? baseExpression.substring(0, dotIdx) : baseExpression;

      const targetKey = registry.resolveFullKey(rootKey);
      if (targetKey) {
        const globalObj = registry.library.get(targetKey);
        if (globalObj) return new (require('../models/weaver-document'))(globalObj, scope.resolver.moduleId);
      }
    }

    return scope.selfDoc;
  }

  /**
   * Evaluates reference tags [[pack::slug|label]] or [[slug]]
   * @private
   */
  static _evaluateReference(content, scope) {
    let { self, context, host, resolver } = scope;
    const registry = resolver.registry;
    if (!registry) return `[[${content}]]`;

    const [targetPart, label] = content.split('|').map(s => s.trim());

    const { pId, oId } = this._splitTargetPart(targetPart, scope);

    const targetKey = registry.resolveFullKey(oId, pId);
    if (!targetKey) return `[[${content}]]`;

    const targetObj = registry.library.get(targetKey);
    if (!targetObj) return `[[${content}]]`;

    const finalPack = targetKey.split('::')[0];
    const finalSlug = oId;
    const finalLabel = label || targetObj.name || oId;

    return `[[${finalPack}::${finalSlug}${label ? '|' + finalLabel : ''}]]`;
  }

  /**
   * Evaluates expression tags {{...}}
   * @private
   */
  static _evaluateExpression(content, scope) {
    let { self, context, host, resolver } = scope;

    const parsed = PipelineHub.parseExpression(`{{${content}}}`);
    if (!parsed) return content;

    const baseExpression = parsed.core;

    let data = null;

    // Resolve property path
    data = this._resolveProperty(baseExpression, scope);
    if (data && data.__WEAVER_TYPE__ === 'MUTE_FUSION') {
      return data;
    }

    // Pipeline processing
    data = PipelineHub.process(data, parsed.pipelines, scope);

    if (data && data.__WEAVER_TYPE__ === 'SPREAD') {
      return data;
    }

    if (data && typeof data === 'object') {
      return { __WEAVER_TYPE__: 'OBJECT', val: JSON.parse(JSON.stringify(data)) };
    }

    return data;
  }

  /**
   * Property path resolution logic
   * @private
   */
  static _resolveProperty(pathStr, scope) {
    let { self, context, host, current, resolver } = scope;
    const registry = resolver.registry;

    if (pathStr.includes('::') && registry) {
      const dotIdx = pathStr.indexOf('.');
      const fullKey = dotIdx !== -1 ? pathStr.substring(0, dotIdx) : pathStr;
      const pPath = dotIdx !== -1 ? pathStr.substring(dotIdx + 1) : null;

      const globalObj = registry.library.get(fullKey);
      const actualObj = globalObj && globalObj.raw ? globalObj.raw : globalObj;
      if (actualObj) return pPath ? PropertyTool.get(actualObj, pPath) : actualObj;
    }

    const parts = pathStr.split('.');
    const rootKey = parts[0];

    let target = null;
    if (rootKey === 'self') target = self;
    else if (rootKey === 'current') {
      if (current) target = current;
      else return { __WEAVER_TYPE__: 'MUTE_FUSION', raw: `{{${pathStr}}}` };
    }
    else if (rootKey === 'context') {
      if (context) target = context;
      else return { __WEAVER_TYPE__: 'MUTE_FUSION', raw: `{{${pathStr}}}` };
    }
    else if (rootKey === 'host') {
      if (host) target = host;
      else return { __WEAVER_TYPE__: 'MUTE_FUSION', raw: `{{${pathStr}}}` };
    }

    if (target) {
      if (parts.length === 1) return target;
      return PropertyTool.get(target, parts.slice(1).join('.'));
    }

    if (registry) {
      const dotIdx = pathStr.indexOf('.');
      const oId = dotIdx !== -1 ? pathStr.substring(0, dotIdx) : pathStr;
      const pPath = dotIdx !== -1 ? pathStr.substring(dotIdx + 1) : null;

      const targetKey = registry.resolveFullKey(oId, null);
      const globalObj = registry.library.get(targetKey);

      if (globalObj) {
        const actualObj = globalObj.raw ? globalObj.raw : globalObj;
        return pPath ? PropertyTool.get(actualObj, pPath) : actualObj;
      }
    }

    return undefined;
  }

  /**
   * Helper: splits target pack::id syntax
   * @private
   */
  static _splitTargetPart(targetPart, scope) {
    let { self, context, host, resolver } = scope;
    const registry = resolver.registry;
    let pId = null;
    let oId = targetPart;

    if (targetPart.includes('::')) {
      const parts = targetPart.split('::');
      pId = parts[0];
      oId = parts[1];
    }

    if (pId && !registry.library.has(`${pId}::${oId}`)) {
      const realPacks = registry.slugIndex.get(oId) || [];
      if (realPacks.length > 0) pId = realPacks[0];
    }
    return { pId, oId };
  }
}

module.exports = TagEvaluator;
