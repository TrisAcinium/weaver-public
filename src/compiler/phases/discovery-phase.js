const fs = require('fs');
const Logger = require('../../utils/logger');

const WeaverScope = require('../../template-engine/weaver-scope');
const { generateSlug } = require('../../utils/slugifier');
const PropertyTool = require('../../utils/property-tool');
const ObjectTool = require('../../utils/object-tool');

class DiscoveryPhase {
  constructor(context) {
    this.context = context;
  }

  async execute() {
    Logger.info("▶ Scanning data directories and registering identifiers...");

    let filesmeta = [];
    try {
      const files = await this.context.io.scanAllDirs(this.context.config.SOURCE_DIRS);
      filesmeta = (await Promise.all(files.map(async info => {
        try {
          const results = await this.context.io.loadFile(info);
          return results.map(file => this.context.preNormalizer.normalize(file.virtualRelPath, file.document));
        } catch (fileError) {
          Logger.error(`💥 [FILE PARSE CRASH] Physical file parsing failed! Path: ${info.filePath}`, fileError);
          throw fileError;
        }
      }))).flat();
    } catch (fatalError) {
      Logger.error(`[Compiler Fatal] Compilation aborted due to async IO exception.`, fatalError);
      throw fatalError;
    }

    // 1. Register to Registry
    for (const meta of filesmeta) {
      this.context.registry.register(meta.packId, meta.slug, meta.data, meta.relPath);
    }
    Logger.success(`✅ Identifier registration complete. Total records: ${this.context.registry.library.size}.`);

    // 2. Expand dynamic BUNDLE templates
    this.#expandBundles();

    // 3. Extract bundler tasks
    for (const [key, weaverDoc] of this.context.registry.library.entries()) {
      const tasks = weaverDoc.raw.flags?.[this.context.config.MODULE_ID]?._TASK_;
      if (!Array.isArray(tasks)) continue;

      this.context.tasks.push(...tasks);
      delete weaverDoc.raw.flags[this.context.config.MODULE_ID]._TASK_;
    }

    // 4. Load external links
    this.#loadExternal();
  }

  #expandBundles() {
    const modId = this.context.config.MODULE_ID;
    const bundlesToExpand = [];

    // Find _BUNDLE_ documents
    for (const [key, weaverDoc] of this.context.registry.library.entries()) {
      if (weaverDoc.raw._BUNDLE_) {
        bundlesToExpand.push({ key, doc: weaverDoc });
      }
    }

    for (const { key, doc } of bundlesToExpand) {
      const rawBundle = doc.raw._BUNDLE_;
      let expandedArray = [];

      const scope = new WeaverScope({ selfDoc: doc, hostDoc: doc, resolver: this.context.resolver });

      // Step A: Preliminary processing of root BUNDLE property
      if (typeof rawBundle === 'string') {
        const resolved = this.context.resolver.resolve(rawBundle, scope, true);
        if (resolved && resolved.__WEAVER_TYPE__ === 'SPREAD') {
          expandedArray = resolved.val;
        } else if (resolved && resolved.__WEAVER_TYPE__ === 'OBJECT') {
          expandedArray = Array.isArray(resolved.val) ? resolved.val : [resolved.val];
        } else if (Array.isArray(resolved)) {
          expandedArray = resolved;
        } else {
          Logger.warn(`[BUNDLE Expansion] Tag did not return an array or SPREAD, cannot expand: ${rawBundle}`);
        }
      } else if (Array.isArray(rawBundle)) {
        expandedArray = rawBundle;
      }

      if (!Array.isArray(expandedArray) || expandedArray.length === 0) continue;

      // Step B: Normalize array elements
      let normalizedArray = [];
      for (const item of expandedArray) {
        if (typeof item === 'string' && (item.includes('{{') || item.includes('[['))) {
          const resolved = this.context.resolver.resolve(item, scope, true);

          if (resolved && resolved.__WEAVER_TYPE__ === 'SPREAD') {
            normalizedArray.push(...resolved.val);
          } else if (resolved && resolved.__WEAVER_TYPE__ === 'OBJECT') {
            if (Array.isArray(resolved.val)) {
              normalizedArray.push(...resolved.val);
            } else {
              normalizedArray.push(resolved.val);
            }
          } else if (Array.isArray(resolved)) {
            normalizedArray.push(...resolved);
          } else {
            normalizedArray.push(resolved);
          }
        } else {
          normalizedArray.push(item);
        }
      }
      expandedArray = normalizedArray;

      // ============================================================

      // Prepare template base object (Remove _BUNDLE_)
      const baseObj = { ...doc.raw };
      delete baseObj._BUNDLE_;

      const packId = key.split('::')[0];
      const baseSlug = baseObj.flags?.[modId]?.id ?? key.split('::')[1];
      const prefix = `${baseSlug}-`;
      const relPath = this.context.registry.sourcePaths.get(key);

      for (let i = 0; i < expandedArray.length; i++) {
        const item = expandedArray[i];
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          Logger.warn(`[BUNDLE Expansion] Non-object element found at index ${i}, skipped. Supports SPREAD or static objects.`);
          continue;
        }

        // Determine the generated Slug
        const fallbackId = item._BUNDLE_ID_
            ?? PropertyTool.get(item, this.context.config.schema.identifierPath)
            ?? item.name
            ?? i;

        const rawSlug = item._ID_ ?? item.id ?? (String(fallbackId).startsWith(prefix) ? fallbackId : `${prefix}${fallbackId}`);
        const childSlug = generateSlug(String(rawSlug), false);
        const childKey = `${packId}::${childSlug}`;

        // Deep merge (Template Base + JSON Item)
        const merged = ObjectTool.deepMerge(baseObj, item);

        // Protect and concatenate _EXTENDS_ array to prevent parent inheritance from being overwritten by child items
        if (Array.isArray(baseObj._EXTENDS_) && Array.isArray(item._EXTENDS_)) {
          merged._EXTENDS_ = [...baseObj._EXTENDS_, ...item._EXTENDS_];
        }

        // Lexical Self Binding transfer (supports bundle-self)
        let mergedStr = JSON.stringify(merged);
        const tagRegex = this.context.config.REGEX.TAG;
        tagRegex.lastIndex = 0;

        mergedStr = mergedStr.replace(tagRegex, (fullMatch) => {
          return fullMatch.replace(/\bbundle-self\b/g, childKey);
        });

        const finalData = JSON.parse(mergedStr);

        // Ensure system ID and SOURCE_KEY are written correctly
        if (!finalData.flags) finalData.flags = {};
        if (!finalData.flags[modId]) finalData.flags[modId] = {};
        finalData.flags[modId].id = childSlug;
        finalData.flags[modId]._SOURCE_KEY_ = childKey;

        // Clean compilation markers
        delete finalData._BUNDLE_ID_;
        delete finalData._ID_;

        // Register newly generated child items into Registry
        this.context.registry.register(packId, childSlug, finalData, relPath);
      }

      // Mark parent template as Virtual document
      // Keep in Registry for {{self}} queries
      // But prevent it from being exported as physical Compendium packs
      if (!doc.raw.flags) doc.raw.flags = {};
      if (!doc.raw.flags[modId]) doc.raw.flags[modId] = {};
      doc.raw.flags[modId]._VIRTUAL_ = true;
    }
  }

  #loadExternal() {
    const externalPaths = this.context.config.EXTERNAL_METADATA_PATHS || [];
    for (const metadataPath of externalPaths) {
      if (!fs.existsSync(metadataPath)) continue;

      const rawContent = fs.readFileSync(metadataPath, 'utf8');
      const cacheEntries = JSON.parse(rawContent);

      for (const entry of cacheEntries) {
        const docStr = entry.document.replace(/_MODULE_ID_/g, this.context.config.MODULE_ID);
        const parsedData = JSON.parse(docStr);

        // Failsafe: Ensure object structure exists before marking as Virtual
        parsedData.flags ??= {};
        parsedData.flags[this.context.config.MODULE_ID] ??= {};
        parsedData.flags[this.context.config.MODULE_ID]._VIRTUAL_ = true;

        this.context.registry.register(
          entry.packId,
          entry.slug,
          parsedData,
          entry.relPath
        );
      }
      Logger.success(`✅ External cache loaded successfully: ${metadataPath}`);
    }
  }
}

module.exports = DiscoveryPhase;
