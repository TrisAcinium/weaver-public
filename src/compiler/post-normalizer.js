const path = require('path');
const PropertyTool = require('../utils/property-tool');

class PostNormalizer {
  constructor(config) {
    this.config = config;
  }

  normalize(fullKey, document, relPath) {
    const isVirtual = !!PropertyTool.get(document, this.config.schema.virtualFlagPath);
    const fileName = path.basename(relPath, path.extname(relPath));

    if (!isVirtual && !document.name) {
      document.name = fileName;
    }

    return document;
  }
}

module.exports = PostNormalizer;
