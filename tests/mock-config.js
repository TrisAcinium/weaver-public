const path = require('path');
const loadConfig = require('../src/utils/config-loader');

const config = loadConfig();
const MODULE_ID = "test-module";

config.MODULE_ID = MODULE_ID;
config.WORKSPACE = process.cwd();
config.SOURCE_DIRS = ["tests/fixtures"];
config.BLUEPRINT_DIR = path.join(process.cwd(), 'build/tests/blueprints');
config.IGNORED_PACKS = [];

config.schema = {
  namespace: `flags.${MODULE_ID}`,
  identifierPath: `flags.${MODULE_ID}.id`,
  hashPath: `flags.${MODULE_ID}.hash`,
  sourceKeyPath: `flags.${MODULE_ID}._SOURCE_KEY_`,
  relPathPath: `flags.${MODULE_ID}._REL_PATH_`,
  docTypePath: `flags.${MODULE_ID}.docType`,
  virtualFlagPath: `flags.${MODULE_ID}._VIRTUAL_`,
  staticAssetFlagPath: `flags.${MODULE_ID}._STATIC_ASSET_`,
  unindexableFlagPath: `flags.${MODULE_ID}._UNINDEXABLE_`,
  tasksPath: `flags.${MODULE_ID}._TASK_`,
  folderPathPath: `flags.${MODULE_ID}._COMPENDIUM_FOLDER_PATH_`,
  editorFolderPath: `flags.${MODULE_ID}._FOLDER_PATH_`,
  overridePath: `flags.${MODULE_ID}._EXTENDS_OVERRIDE_`
};

module.exports = config;
