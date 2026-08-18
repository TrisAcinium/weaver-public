#!/usr/bin/env node

const Logger = require('../src/utils/logger');
const loadConfig = require('../src/utils/config-loader');

const CompilerContext = require('../src/compiler/context');
const DiscoveryPhase = require('../src/compiler/phases/discovery-phase');
const SchedulingPhase = require('../src/compiler/phases/scheduling-phase');
const EvaluationPhase = require('../src/compiler/phases/evaluation-phase');
const EmitPhase = require('../src/compiler/phases/emit-phase');

const CONFIG = loadConfig();

class PackCompiler {
  constructor(config) {
    this.config = config;
    this.context = new CompilerContext(config);

    // Backward compatibility
    this.registry = this.context.registry;
  }

  async exec() {
    Logger.section("Initiating compilation process");

    await new DiscoveryPhase(this.context).execute();
    const compilePlan = new SchedulingPhase(this.context).execute();
    new EvaluationPhase(this.context).execute(compilePlan);
    await new EmitPhase(this.context).execute(compilePlan);

    Logger.success("Compilation complete");
  }
}

if (require.main === module) {
  (async () => {
    try {
      await new PackCompiler(CONFIG).exec();
    } catch (err) {
      Logger.error(`💥 [COMPILER CRITICAL EXCEPTION]`, err);
      process.exit(1);
    }
  })();
}

module.exports = PackCompiler;
