const yaml = require('js-yaml');

module.exports = {
  extensions: ['.yaml', '.yml'],

  /**
   * YAML Handler responsibility: Read plain text and restore nested paths.
   */
  async loadAndParse(fs, filePath, utils, ctx) {
    let rawContent = await fs.readFile(filePath, 'utf8');
    rawContent = utils.replaceModuleId(rawContent);

    const rawObject = yaml.load(rawContent) || {};
    return utils.unflatten(rawObject);
  }
};
