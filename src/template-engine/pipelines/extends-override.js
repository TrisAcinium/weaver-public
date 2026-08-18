const BasePipelineCommand = require('../base-command');
const PropertyTool = require('../../utils/property-tool');

class ExtendsOverrideCommand extends BasePipelineCommand {
  constructor() {
    super('extendsoverride', ['extends-override', 'extends_override', 'override', 'post']);
  }

  execute(box, pipeContent, scope) {
    const modId = scope.resolver?.moduleId || 'weaver-core';

    box.items = box.items.map(item => {
      if (item === null || typeof item !== 'object') {
        return item;
      }

      const clonedItem = JSON.parse(JSON.stringify(item));
      PropertyTool.set(clonedItem, `flags.${modId}._EXTENDS_OVERRIDE_`, true);

      return clonedItem;
    });
  }
}

module.exports = new ExtendsOverrideCommand();
