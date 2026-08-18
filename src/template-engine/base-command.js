class BasePipelineCommand {
  constructor(name, aliases = []) {
    this.name = name;
    this.aliases = aliases;
    // Pre-compile regex for extracting command parameters to improve performance
    this.pattern = new RegExp(`^(?:${name}|${aliases.join('|')})\\s*`, 'i');
  }

  /**
   * Helper method: Strip command prefix and retrieve the pure parameter string
   */
  getRawParams(pipeContent) {
    return pipeContent.replace(this.pattern, '').trim();
  }

  /**
   * Interface method: Must be implemented by subclasses
   * @param {PipelineBox} box
   * @param {string} pipeContent
   * @param {WeaverScope} scope
   */
  execute(box, pipeContent, scope) {
    throw new Error(`[PipelineCommand] "${this.name}" must implement the execute method`);
  }
}

module.exports = BasePipelineCommand;
