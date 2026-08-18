const PropertyTool = {
  get(obj, path) {
    if (!path) return undefined;
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (current === null || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current;
  },

  set(obj, path, value) {
    if (!path) return obj;
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((acc, part) => {
      if (!acc[part] || typeof acc[part] !== 'object') acc[part] = {};
      return acc[part];
    }, obj);
    target[last] = value;
    return obj;
  },

  unset(obj, path) {
    if (!obj || typeof obj !== 'object' || !path) return;

    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        return;
      }
      current = current[key];
    }

    const lastKey = parts[parts.length - 1];
    delete current[lastKey];
  }
};

module.exports = PropertyTool;
