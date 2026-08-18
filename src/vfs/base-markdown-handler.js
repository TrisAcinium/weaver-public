const yaml = require('js-yaml');
const CONFIG = require('../utils/config-loader')();

class BaseMarkdownHandler {
  constructor() {
    this.config = CONFIG;
    this.extensions = ['.md'];
  }

  async loadAndParse(fs, filePath, utils, ctx) {
    let rawContent = await fs.readFile(filePath, 'utf8');
    rawContent = utils.replaceModuleId(rawContent);

    const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return null;

    const header = yaml.load(match[1]) || {};
    const rawBody = match[2].trim();

    let bodyHtml = rawBody;

    const data = utils.unflatten(header);
    let flatJsonStr = JSON.stringify(data);
    flatJsonStr = flatJsonStr.replace(/"_BODY_"/g, JSON.stringify(bodyHtml));

    const modId = this.config.MODULE_ID;
    const parsed = JSON.parse(flatJsonStr);

    return parsed;
  }
}

module.exports = BaseMarkdownHandler;
