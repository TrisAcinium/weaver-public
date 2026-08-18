const fsPromises = require('fs/promises');
const { existsSync, readdirSync } = require('fs');
const path = require('path');

const PropertyTool = require('../utils/property-tool');
const Logger = require('../utils/logger');

const HANDLERS_DIR = path.join(__dirname, 'handlers');

class IoHandler {
  constructor(config) {
    this.config = config;
    this.handlers = new Map();
    this.workspace = config.WORKSPACE ?? process.cwd();

    this._loadHandlers(HANDLERS_DIR);
  }

  static getUtils(config) {
    return {
      unflatten: (data) => {
        if (!data || typeof data !== 'object') return data;

        return Object.entries(data).reduce((result, [key, value]) => {
          key.split('.').reduce((current, part, index, array) => {
            const isLast = index === array.length - 1;
            if (isLast) {
              current[part] = value;
            } else {
              const nextPart = array[index + 1];
              current[part] = current[part] ?? (/^\d+$/.test(nextPart) ? [] : {});
            }
            return current[part];
          }, result);
          return result;
        }, {});
      },
      replaceModuleId: (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/_MODULE_ID_/g, config.MODULE_ID);
      }
    };
  }

  /**
   * Automatically scan and load plugin handlers.
   */
  _loadHandlers(handlersDir) {
    if (!existsSync(handlersDir)) return;

    const files = readdirSync(handlersDir);
    for (const file of files) {
      if (!file.endsWith('.js')) {
        Logger.warn(`[IoHandler] Ignoring non-plugin file: "${file}"`);
        continue;
      }

      const modulePath = path.join(handlersDir, file);
      const handlerModule = require(modulePath);

      if (!handlerModule.extensions) {
        Logger.warn(`[IoHandler] Plugin load skipped: File "${file}" does not declare 'extensions' property.`);
        continue;
      }

      if (typeof handlerModule.loadAndParse !== 'function') {
        Logger.warn(`[IoHandler] Plugin load skipped: File "${file}" does not implement 'loadAndParse' function.`);
        continue;
      }

      for (const ext of handlerModule.extensions) {
        this.handlers.set(ext.toLowerCase(), handlerModule);
      }
    }
  }

  /**
   * Identify the handler to invoke.
   * Supports passing: physical path string, relative path string, or document data object directly.
   */
  getHandler(target) {
    if (!target) return null;

    let targetPath = "";

    if (typeof target === 'object') {
      const modId = this.config.MODULE_ID;
      targetPath = target?.flags[modId]?._IO_HANDLER_ ??
        PropertyTool.get(target, this.config?.schema?.sourcePath);
    } else if (typeof target === 'string') {
      targetPath = target;
    }

    if (!targetPath) return null;
    const lowerName = targetPath.toLowerCase();

    const sortedExts = Array.from(this.handlers.keys())
      .sort((a, b) => b.length - a.length);

    for (const ext of sortedExts) {
      if (lowerName.endsWith(ext)) {
        return this.handlers.get(ext);
      }
    }

    return null;
  }

  /**
   * Backward compatible with single-directory scanning interface.
   */
  async scanDir(dir) {
    return this.scanAllDirs([dir]);
  }

  /**
   * Multi-datasource virtual merge core: traverse multiple physical directories and aggregate results.
   */
  async scanAllDirs(dirs) {
    const allFiles = [];
    for (const dir of dirs) {
      if (this.config.IGNORED_PACKS.includes(dir)) continue;
      const absoluteRoot = path.resolve(this.workspace, dir);
      if (!existsSync(absoluteRoot)) continue;

      const files = await this._scanDirRecursive(absoluteRoot, absoluteRoot);
      allFiles.push(...files);
    }
    return allFiles;
  }

  async _scanDirRecursive(currentDir, sourceRoot) {
    const entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
    const checkHandler = this.getHandler.bind(this);

    const results = await Promise.all(entries.map(async (e) => {
      const p = path.join(currentDir, e.name);

      if (e.isDirectory()) {
        return this._scanDirRecursive(p, sourceRoot);
      }

      if (checkHandler(e.name)) {
        return { filePath: p, sourceRoot };
      }

      return null;
    }));

    return results.flat().filter(Boolean);
  }

  /**
   * Load file
   */
  async loadFile(fileInfo) {
    const info = typeof fileInfo === 'string'
      ? { filePath: fileInfo, sourceRoot: path.join(this.workspace, 'data') }
      : fileInfo;

    const { filePath, sourceRoot } = info;

    const fileName = path.basename(filePath);
    const handler = this.getHandler(fileName);
    if (!handler) {
      throw new Error(`[IoHandler] No corresponding handler plugin found for file: "${fileName}"`);
    }

    const virtualRelPath = path.relative(sourceRoot, filePath);

    const utils = IoHandler.getUtils(this.config);
    try {
      const rawData = await handler.loadAndParse(fsPromises, filePath, utils, {
        moduleId: this.config.MODULE_ID,
        virtualRelPath: virtualRelPath,
        workspace: this.workspace,
      });

      if (!rawData) {
        throw new Error(`File content parsed as empty (possibly a Frontmatter boundary or YAML formatting error)`);
      }

      const info = Array.isArray(rawData) ? rawData : [rawData];
      return info.map(document => ({
        filePath,
        document,
        virtualRelPath
      }));
    } catch (e) {
      Logger.error(`[IoHandler] Physical file load failed: ${virtualRelPath} (Physical path: ${filePath})`, e);
      throw e;
    }
  }

  async writeBlueprintEntity(packId, filename, filedata) {
    const blueprintPath = path.join(this.config.BLUEPRINT_DIR, packId, filename);
    await fsPromises.mkdir(path.dirname(blueprintPath), { recursive: true });
    await fsPromises.writeFile(blueprintPath, filedata, 'utf8');
  }

  /**
   * Entity writing core with strategic querying responsibility
   * @param {string} fullKey - Global ID
   * @param {object} document - Document data object
   */
  async writeDocument(fullKey, document) {
    const [packId, slug] = fullKey.split('::');
    const handler = this.getHandler(document);

    let filename = `${slug}.json`;
    let filedata = JSON.stringify(document, null, 2);
    if (handler && typeof handler.onBeforeWrite === 'function') {
      const strategy = handler.onBeforeWrite(fullKey, document);
      if (typeof strategy?.name === 'string') {
        filename = strategy.name ?? filename;
      }
      if (typeof strategy?.file === 'string') {
        filedata = strategy.file ?? filedata;
      }
    }

    const blueprintPath = path.join(this.config.BLUEPRINT_DIR, packId, filename);
    await this.writeFile(blueprintPath, filedata);

    return {
      filename,
    };
  }

  async writeJson(distPath, document) {
    await this.writeFile(distPath, JSON.stringify(document, null, 2))
  }

  async writeFile(distPath, filedata) {
    await fsPromises.mkdir(path.dirname(distPath), { recursive: true });
    await fsPromises.writeFile(distPath, filedata, 'utf8');
  }

  async copyFile(src, dest) {
    await fsPromises.mkdir(path.dirname(dest), { recursive: true });
    await fsPromises.copyFile(src, dest);
  }
}

module.exports = IoHandler;
