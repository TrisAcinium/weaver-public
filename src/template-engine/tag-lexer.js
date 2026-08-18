const loadConfig = require('../utils/config-loader');
const CONFIG = loadConfig();

class TagLexer {
  /**
   * 檢查字串中是否還殘留任何標籤記號 (高效字串比對，捨棄緩慢且具備限制的 Regex)
   */
  static hasTokens(text) {
    if (typeof text !== 'string') return false;
    return text.includes(CONFIG.TAG.SYMBOLS.EXPR_LEFT) || text.includes(CONFIG.TAG.SYMBOLS.REF_LEFT);
  }

  /**
   * State-machine based lexer to extract the deepest, non-nested tag token.
   * This approach is vastly superior to regex execution, avoiding backtracking issues
   * and correctly ignoring tags disguised within string literals or HTML attributes.
   *
   * @param {string} text - The raw source text containing template tags.
   * @returns {{ raw: string, type: string, content: string } | null} The deeply nested token object.
   */
  static nextDeepestToken(text) {
    if (typeof text !== 'string') return null;

    let currentTagStart = -1;
    let currentTagType = null;
    let inString = null;

    let braceDepth = 0;
    let bracketDepth = 0;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      // 判斷是否處於標籤內部
      const inTag = braceDepth > 0 || bracketDepth > 0;

      // 字串遮罩保護：只有在標籤「內部」的引號，才具備遮罩效力
      if (inTag) {
        if (inString) {
          // 遇到未跳脫的同款引號，解除字串狀態
          if (char === inString && text[i - 1] !== '\\') {
            inString = null;
          }
          continue; // 在字串狀態中，略過任何括號的判斷
        } else if ((char === '"' || char === "'" || char === '`') && text[i - 1] !== '\\') {
          inString = char; // 進入字串狀態
          continue;
        }
      }

      // ─── 解析表達式 {{ ... }} ───
      if (char === '{' && nextChar === '{') {
        braceDepth++;
        currentTagStart = i;
        currentTagType = CONFIG.TAG.TYPES.EXPR;
        i++; // 略過下一個 '{'
        continue;
      }
      if (char === '}' && nextChar === '}') {
        if (braceDepth > 0) {
          braceDepth--;
          // 只要找到第一個閉合的標籤，代表它就是最深層 (沒有被其他括號包裹) 的 Token
          if (currentTagType === CONFIG.TAG.TYPES.EXPR) {
            const raw = text.substring(currentTagStart, i + 2);
            const content = text.substring(currentTagStart + 2, i).trim();
            return { raw, type: currentTagType, content };
          }
        }
        i++;
        continue;
      }

      // ─── 解析參照 [[ ... ]] ───
      if (char === '[' && nextChar === '[') {
        bracketDepth++;
        currentTagStart = i;
        currentTagType = CONFIG.TAG.TYPES.REF;
        i++;
        continue;
      }
      if (char === ']' && nextChar === ']') {
        if (bracketDepth > 0) {
          bracketDepth--;
          if (currentTagType === CONFIG.TAG.TYPES.REF) {
            const raw = text.substring(currentTagStart, i + 2);
            const content = text.substring(currentTagStart + 2, i).trim();
            return { raw, type: currentTagType, content };
          }
        }
        i++;
        continue;
      }
    }

    return null;
  }
}

module.exports = TagLexer;
