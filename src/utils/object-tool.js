const ObjectTool = {
  /**
   * Deep merge two objects, recursively overwriting or filling fields from source to target
   * @param {Object} target Base object
   * @param {Object} source Mutation object to mix in
   * @returns {Object} Newly merged object
   */
  deepMerge(target, source) {
    const output = JSON.parse(JSON.stringify(target || {}));

    if (source && typeof source === 'object' && !Array.isArray(source)) {
      Object.keys(source).forEach(key => {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (output[key] && typeof output[key] === 'object' && !Array.isArray(output[key])) {
            output[key] = this.deepMerge(output[key], source[key]);
          } else {
            output[key] = JSON.parse(JSON.stringify(source[key]));
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    return output;
  }
};

module.exports = ObjectTool;
