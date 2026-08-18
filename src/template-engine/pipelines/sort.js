const BasePipelineCommand = require('../base-command');
const PropertyTool = require('../../utils/property-tool');

class SortCommand extends BasePipelineCommand {
  constructor() {
    super('sort');
  }

  execute(box, pipeContent, scope) {
    if (box.items.length <= 1) return;

    const rawParam = this.getRawParams(pipeContent);
    if (!rawParam) return;

    const criteria = rawParam.split(',').map(s => s.trim()).filter(Boolean);
    if (criteria.length === 0) return;

    const parsedCriteria = criteria.map(criterion => {
      const parts = criterion.split(/\s+/);
      const propPath = parts[0];
      const direction = parts[1]?.toLowerCase() === 'desc' ? -1 : 1;
      return { propPath, direction };
    });

    box.items.sort((a, b) => {
      for (const { propPath, direction } of parsedCriteria) {
        const valA = PropertyTool.get(a, propPath);
        const valB = PropertyTool.get(b, propPath);

        const aValid = valA !== undefined && valA !== null;
        const bValid = valB !== undefined && valB !== null;

        if (!aValid && !bValid) continue;
        if (!aValid) return 1;
        if (!bValid) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          if (valA !== valB) return (valA - valB) * direction;
          continue;
        }

        const strA = String(valA);
        const strB = String(valB);
        if (strA !== strB) {
          return strA.localeCompare(strB) * direction;
        }
      }
      return 0;
    });
  }
}

module.exports = new SortCommand();
