const DataRegistry = require('../compiler/registry');
const TagResolver = require('../template-engine/resolver');
const DependencyScheduler = require('../compiler/scheduler');
const IoHandler = require('../vfs/io-handler');
const PreNormalizer = require('../compiler/pre-normalizer');
const PostNormalizer = require('../compiler/post-normalizer');

class CompilerContext {
  constructor(config) {
    this.config = config;

    this.registry = new DataRegistry(config);
    this.resolver = new TagResolver(config, this.registry, config.MODULE_ID);
    this.scheduler = new DependencyScheduler(config, this.registry);
    this.io = new IoHandler(config);
    this.preNormalizer = new PreNormalizer(config);
    this.postNormalizer = new PostNormalizer(config);

    this.tasks = [];
  }
}

module.exports = CompilerContext;
