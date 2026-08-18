const fs = require('fs');
const path = require('path');

const Logger = require('../utils/logger');

// ========================================== //
//    Auto-boxing / Unboxing mechanism
// ========================================== //
class PipelineBox {
  constructor(data) {
    this.isNullishInput = (data === null || data === undefined);
    this.isCollection = Array.isArray(data);

    this.items = this.isCollection ? [...data] : (this.isNullishInput ? [] : [data]);
    this.isSpread = false;
  }

  unbox() {
    if (this.isSpread) {
      return {
        __WEAVER_TYPE__: 'SPREAD',
        val: this.items
      };
    }
    if (this.isCollection) {
      return this.items;
    }
    return this.items.length > 0 ? this.items[0] : null;
  }
}

// ========================================== //
//    Pipeline Strategy
// ========================================== //

class PipelineHub {
  constructor(pipelinesDir = path.join(__dirname, 'pipelines')) {
    this.strategies = new Map();
    this._loadStrategies(pipelinesDir);
  }

  /**
   * Dynamically scan directories and register all Command strategies
   */
  _loadStrategies(pipelinesDir) {
    if (!fs.existsSync(pipelinesDir)) return;

    const files = fs.readdirSync(pipelinesDir);
    for (const file of files) {
      if (!file.endsWith('.js')) continue;

      const filePath = path.join(pipelinesDir, file);
      const commandInstance = require(filePath);

      if (typeof commandInstance.execute !== 'function') {
        Logger.warn(`[Pipeline Command][Loader] "${file}" does not implement execute() method, skipped.`);
        continue;
      }

      this.strategies.set(commandInstance.name.toLowerCase(), commandInstance.execute.bind(commandInstance));

      for (const alias of commandInstance.aliases) {
        this.strategies.set(alias.toLowerCase(), commandInstance.execute.bind(commandInstance));
      }
    }
  }

  process(data, pipelineInput, scope = {}) {
    let pipelines = Array.isArray(pipelineInput) ? pipelineInput : [];
    if (typeof pipelineInput === 'string' && pipelineInput.trim()) {
      const hasShell = pipelineInput.trim().startsWith('{{');
      if (hasShell) {
        const parsed = PipelineHub.parseExpression(pipelineInput);
        pipelines = parsed ? parsed.pipelines : [];
      } else {
        const parsed = PipelineHub.parseExpression(`{{ _MOCK_KEY_ | ${pipelineInput} }}`);
        pipelines = parsed ? parsed.pipelines : [];
      }
    }

    const box = new PipelineBox(data);

    if (scope && scope.resolver && box.items.length > 0) {
      box.items = box.items.flatMap(item => {
        let actualItem = item;

        // 1. Deep resolve if it's an unresolved tag string
        if (typeof item === 'string' && (item.includes('{{') || item.includes('[['))) {
          actualItem = scope.resolver.resolve(item, scope, true);
        }

        // 2. If resolution yields a SPREAD array, flatten it into the pipeline stream
        if (actualItem && actualItem.__WEAVER_TYPE__ === 'SPREAD') {
          box.isCollection = true;
          return actualItem.val;
        }
        // 3. If it's a standard high-level object, strip the wrapper
        else if (actualItem && actualItem.__WEAVER_TYPE__ === 'OBJECT') {
          return [actualItem.val];
        }

        return [actualItem];
      });
    }
    // =========================================================================

    for (const pipe of pipelines) {
      if (!pipe.trim()) continue;

      const command = pipe.split(/\s+/)[0].toLowerCase();
      const strategyExecute = this.strategies.get(command);

      if (strategyExecute) {
        strategyExecute(box, pipe, scope);
      } else {
        Logger.warn(`[Pipeline Command] Unknown pipeline command detected: "${command}". It will be ignored.`);
      }
    }

    return box.unbox();
  }

  static parseExpression(rawText) {
    const trimmed = rawText.trim();
    if (!trimmed.startsWith('{{') || !trimmed.endsWith('}}')) return null;

    const innerContent = trimmed
      .substring(2, trimmed.length - 2)
      .trim();

    const pipelines = [];
    let currentSegment = '';
    let inString = null;
    let braceDepth = 0;
    let parenDepth = 0;
    let bracketDepth = 0;

    for (let i = 0; i < innerContent.length; i++) {
      const char = innerContent[i];

      if (inString) {
        if (char === inString && innerContent[i - 1] !== '\\') inString = null;
        currentSegment += char;
        continue;
      }
      if ((char === "'" || char === '"' || char === '`') && innerContent[i - 1] !== '\\') {
        inString = char;
        currentSegment += char;
        continue;
      }

      if (char === '{') { braceDepth++; currentSegment += char; continue; }
      if (char === '}') { braceDepth--; currentSegment += char; continue; }
      if (char === '(') { parenDepth++; currentSegment += char; continue; }
      if (char === ')') { parenDepth--; currentSegment += char; continue; }
      if (char === '[') { bracketDepth++; currentSegment += char; continue; }
      if (char === ']') { bracketDepth--; currentSegment += char; continue; }

      if (char === '|' && braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
        pipelines.push(currentSegment.trim());
        currentSegment = '';
        continue;
      }

      currentSegment += char;
    }

    if (currentSegment.trim()) pipelines.push(currentSegment.trim());

    return {
      core: pipelines[0] || '',
      pipelines: pipelines.slice(1)
    };
  }
}

// Singleton
const defaultHub = new PipelineHub();
module.exports = {
  PipelineHub,
  process: (data, pipelineInput, scope) => defaultHub.process(data, pipelineInput, scope),
  parseExpression: PipelineHub.parseExpression
};
