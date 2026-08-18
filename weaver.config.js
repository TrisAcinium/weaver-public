const MODULE_ID = "weaver-core";

module.exports = {
  moduleId: MODULE_ID,

  // Core schema paths for metadata identification
  schema: {
    identifierPath: `flags.${MODULE_ID}.id`,
    hashPath:       `flags.${MODULE_ID}.hash`,
    sourcePath:     `flags.${MODULE_ID}._REL_PATH_`
  },

  // Build directories
  build: {
    sourceDirs: ["data"],
    outputDir: "dist",
    tempDir: "build",
    ignoredPacks: [],
    externalMetadataPaths: []
  }
};
