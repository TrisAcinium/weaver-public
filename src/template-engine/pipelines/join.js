const BasePipelineCommand = require('../base-command');

class JoinCommand extends BasePipelineCommand {
  constructor() {
    super('join');
  }

  execute(box, pipeContent, scope) {
    const rawParam = this.getRawParams(pipeContent);

    let separator = '\n';
    if (rawParam) {
      separator = rawParam
        .replace(/^['"`]|['"`]$/g, '')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');
    }

    box.items = [box.items.join(separator)];
    box.isCollection = false;
  }
}

module.exports = new JoinCommand();
