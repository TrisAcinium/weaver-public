const path = require('path');
const { generateSlug } = require('../utils/slugifier');
const PropertyTool = require('../utils/property-tool');

class PreNormalizer {
  constructor(config) {
    this.config = config;
  }

  /**
   * Virtualization normalization handler
   * @param {string} virtualRelPath
   * @param {object} rawData
   */
  normalize(virtualRelPath, rawData) {
    let data = JSON.parse(JSON.stringify(rawData));
    const ext = path.extname(virtualRelPath).toLowerCase();
    const schema = this.config.schema;

    const pathParts = virtualRelPath.split(/[/\\]/);
    const packId = pathParts.length > 1 ? pathParts[0] : 'default';

    // Virtual & Virtual*
    let docType = PropertyTool.get(data, schema.docTypePath);
    let isVirtual = false;
    if (docType && typeof docType === 'string') {
      const virtualMatch = docType.match(/^Virtual([A-Z].*)?$/);
      if (virtualMatch) {
        isVirtual = true;
        docType = virtualMatch[1] ?? 'Virtual';
        PropertyTool.set(data, schema.docTypePath, docType);
      }
    }

    let slug = PropertyTool.get(data, schema.identifierPath);
    if (!slug) {
      slug = generateSlug(virtualRelPath);
      PropertyTool.set(data, schema.identifierPath, slug);
    }

    // Calculate the absolute ID (Source Key) of the current file
    const sourceKey = `${packId}::${slug}`;
    PropertyTool.set(data, schema.sourceKeyPath, sourceKey);
    PropertyTool.set(data, schema.relPathPath, virtualRelPath);

    if (isVirtual) {
      PropertyTool.set(data, schema.virtualFlagPath, true);
    } else {
      PropertyTool.unset(data, schema.virtualFlagPath);
    }

    // editorFolderPath
    function getCleanFolderPath(relPath) {
      const lastSlashIndex = relPath.lastIndexOf('/');
      const dirPart = lastSlashIndex !== -1 ? relPath.substring(0, lastSlashIndex) : "";
      const filePart = lastSlashIndex !== -1 ? relPath.substring(lastSlashIndex + 1) : relPath;
      const firstDotIndex = filePart.indexOf('.');
      const cleanFile = firstDotIndex !== -1 ? filePart.substring(0, firstDotIndex) : filePart;
      const folderPath = dirPart ? dirPart.split('/') : [];
      folderPath.push(cleanFile);
      return folderPath;
    }
    const editorFolderPath = getCleanFolderPath(virtualRelPath);
    PropertyTool.set(data, schema.editorFolderPath, editorFolderPath);

    // =========================================================================
    // Lexical self binding
    // =========================================================================
    try {
      let rawString = JSON.stringify(data);
      const tagRegex = this.config.REGEX.TAG;
      tagRegex.lastIndex = 0;
      rawString = rawString.replace(tagRegex, (fullMatch) => {
        return fullMatch.replace(/\bself\b/g, sourceKey);
      });
      data = JSON.parse(rawString);
    } catch (e) {
      console.warn(`[DocumentPreNormalizer] Error executing lexical self binding:`, e);
    }

    return { packId, slug, data, relPath: virtualRelPath };
  }
}

module.exports = PreNormalizer;
