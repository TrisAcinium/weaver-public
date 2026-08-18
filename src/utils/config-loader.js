const path = require('path');
const fs = require('fs');

const MODULE_ID = 'weaver-core';

const TAG = {
  SYMBOLS: { EXPR_LEFT: '{{', EXPR_RIGHT: '}}', REF_LEFT: '[[', REF_RIGHT: ']]' },
  TYPES: { REF: 'REF_TAG', EXPR: 'EXPR_TAG' }
};

const REF_PATTERN_STR = '\\[\\[([^\\[\\]\\{\\}]+)\\]\\]';
const EXPR_PATTERN_STR = '\\{\\{([^\\[\\]\\{\\}]+)\\}\\}';
const COMBINED_TAG_STR = `(?:${REF_PATTERN_STR}|${EXPR_PATTERN_STR})`;

module.exports = function loadConfig() {
  const workspace = process.env.OVERRIDE_WORKSPACE || process.cwd();
  const userConfigPath = path.join(workspace, 'weaver.config.js');

  const coreConfig = {
    WORKSPACE: workspace,
    REGEX: {
      TAG: new RegExp(COMBINED_TAG_STR, 'g'),
      REF_TAG: new RegExp(REF_PATTERN_STR, 'g'),
      EXPR_TAG: new RegExp(EXPR_PATTERN_STR, 'g'),
      DEEPEST_TAG: new RegExp(COMBINED_TAG_STR),
      PURE_TAG: new RegExp(`^${COMBINED_TAG_STR}$`),
      QUERY_COND: /^([a-zA-Z0-9._\"-]+)\s*([<>!=*^$]{1,3})\s*(.*)$/,
    }
  };

  let userConfig = {};
  if (fs.existsSync(userConfigPath)) {
    try {
      delete require.cache[require.resolve(userConfigPath)];
      userConfig = require(userConfigPath);
    } catch (e) {
      console.warn("[Config] Failed to load weaver.config.js, using defaults.");
    }
  }

  const moduleId = userConfig.moduleId || MODULE_ID;
  const tempDir = userConfig.build?.tempDir || "build";
  const outputDir = userConfig.build?.outputDir || "dist";

  let envSourceDirs = null;
  if (process.env.SOURCE_DIRS) {
    try { envSourceDirs = JSON.parse(process.env.SOURCE_DIRS); }
    catch (e) { console.warn("[Config] Failed to parse process.env.SOURCE_DIRS"); }
  }

  const defaultSchema = {
    namespace: `flags.${moduleId}`,
    identifierPath: `flags.${moduleId}.id`,
    hashPath: `flags.${moduleId}.hash`,
    sourceKeyPath: `flags.${moduleId}._SOURCE_KEY_`,
    relPathPath: `flags.${moduleId}._REL_PATH_`,
    virtualFlagPath: `flags.${moduleId}._VIRTUAL_`,
    staticAssetFlagPath: `flags.${moduleId}._STATIC_ASSET_`,
    overridePath: `flags.${moduleId}._EXTENDS_OVERRIDE_`
  };

  const schema = { ...defaultSchema, ...(userConfig.schema || {}) };

  return {
    MODULE_ID: moduleId,
    WORKSPACE: workspace,
    SOURCE_DIRS: envSourceDirs || userConfig.build?.sourceDirs || ["data"],
    IGNORED_PACKS: userConfig.build?.ignoredPacks || [],
    EXTERNAL_METADATA_PATHS: userConfig.build?.externalMetadataPaths || [],

    BLUEPRINT_DIR: path.join(workspace, tempDir, 'blueprints'),
    DIST_DIR: path.join(workspace, outputDir),
    DIST_BLUEPRINT_DIR: path.join(workspace, outputDir, 'dev/blueprints'),

    schema,
    REGEX: coreConfig.REGEX,
    TAG,
  };
};
