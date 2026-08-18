const TagLexer = require('./tag-lexer');
const TagEvaluator = require('./tag-evaluator.js');
const WeaverScope = require('./weaver-scope');

class TagResolver {
  constructor(config, registry) {
    this.config = config;
    this.registry = registry;
    this.moduleId = config.MODULE_ID;
  }

  resolve(text, scope, allowStructural = false, depth = 0) {
    if (typeof text !== 'string') return text;

    // Track resolution depth across pipelines using scope.depth
    if (scope) scope.depth = (scope.depth || 0) + 1;
    const currentDepth = scope ? scope.depth : depth;

    try {
      if (currentDepth > 15) {
        const file = scope?.self?.flags?.[this.moduleId]?._REL_PATH_ || 'Unknown File';
        throw new Error(`💥 [RECURSION DEADLOCK] Infinite tag recursion detected! File: ${file}, Content: "${text}"`);
      }

      let current = text.trim();
      let last = '';
      let safetyCounter = 0;

      while (TagLexer.hasTokens(current)) {
        if (current === last || safetyCounter++ > 50) {
          if (scope && safetyCounter > 50) scope.hasUnresolved = true;
          break;
        }
        last = current;

        const token = TagLexer.nextDeepestToken(current);
        if (!token) break;

        const resolved = this._fullyResolveToken(token, scope, allowStructural, currentDepth);

        // Handle MUTE_FUSION
        if (resolved && resolved.__WEAVER_TYPE__ === 'MUTE_FUSION') {
          const escapedRaw = token.raw.replace(/\[\[/g, '[\\_').replace(/\{\{/g, '{\\_');
          current = current.split(token.raw).join(escapedRaw);
          if (scope) scope.hasUnresolved = true;
          continue;
        }

        if (current === token.raw) {
          if (resolved && typeof resolved === 'object') {
            return this._packageStructure(resolved, allowStructural);
          }
          return resolved;
        }

        const textValue = this._stringifyResolved(resolved);

        if (token.raw === textValue) {
          const escapedRaw = token.raw.replace(/\[\[/g, '[\\_').replace(/\{\{/g, '{\\_');
          current = current.split(token.raw).join(escapedRaw);
          if (scope) scope.hasUnresolved = true;
        } else {
          current = current.split(token.raw).join(textValue);
        }
      }

      const result = current.replace(/\[\\_/g, '[[').replace(/\{\\_/g, '{{');
      return result;

    } finally {
      if (scope) scope.depth--;
    }
  }

  _fullyResolveToken(token, scope, allowStructural, depth) {
    let resolved = TagEvaluator.evaluate(token, scope);

    if (typeof resolved === 'string' && TagLexer.hasTokens(resolved)) {

      if (resolved === token.raw || resolved.includes(token.raw)) {
        return resolved;
      }

      if (!resolved.includes(token.content)) {
        return resolved;
      }

      const trueSelfDoc = TagEvaluator.traceSource(token, scope);
      resolved = this.resolve(resolved, scope.derive(trueSelfDoc), allowStructural, depth + 1);
    }

    return resolved;
  }

  /**
   * Helper: Sanitizes private metadata properties from structural objects
   * @private
   */
  _packageStructure(resolved, allowStructural) {
    if (resolved.__WEAVER_TYPE__ === 'SPREAD') {
      return resolved;
    }

    if (resolved.__WEAVER_TYPE__ === 'OBJECT') {
      if (allowStructural) {
        return resolved;
      }

      const cloned = JSON.parse(JSON.stringify(resolved.val));
      if (cloned.flags?.[this.moduleId]) {
        delete cloned.flags[this.moduleId];
        if (Object.keys(cloned.flags).length === 0) delete cloned.flags;
      }
      return cloned;
    }

    return resolved;
  }

  /**
   * Helper: Degrades complex structures into formatted inline strings
   * @private
   */
  _stringifyResolved(resolved) {
    if (resolved === null || resolved === undefined) return '';

    if (typeof resolved === 'object') {
      const rawData = resolved.__WEAVER_TYPE__ ? resolved.val : resolved;

      if (rawData === null || rawData === undefined) return '';

      if (Array.isArray(rawData)) {
        return rawData
          .map(v => {
            if (v === null || v === undefined) return '';
            return v?.name || v?.uuid || (typeof v === 'object' ? JSON.stringify(v) : String(v));
          })
          .filter(Boolean)
          .join(', ');
      }

      return rawData?.name || rawData?.identifier || '[Object]';
    }

    return String(resolved);
  }

  // =============================================
  // Compatibility Layer
  // =============================================

  parse(content, self, host, isStrictPropertyLookUp = false) {
    const token = {
      type: content.includes('::') || !content.includes('.') ? this.config.TAG.TYPES.REF : this.config.TAG.TYPES.EXPR,
      content: content,
      raw: `{{${content}}}`
    };
    const res = TagEvaluator.evaluate(token, new WeaverScope({ self, host, resolver: this }));
    if (res && res.__WEAVER_TYPE__ === 'OBJECT') return { type: 'value', val: res.val };
    if (typeof res === 'string' && res.startsWith('[[')) {
      const strip = res.replace(/[\[\]]/g, '');
      const [parts, label] = strip.split('|');
      const [pack, id] = parts.split('::');
      return { type: 'link', pack, id, label };
    }
    return { type: 'value', val: res };
  }
}

module.exports = TagResolver;
