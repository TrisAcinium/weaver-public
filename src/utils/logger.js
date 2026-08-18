const pino = require('pino');
const pretty = require('pino-pretty');

const logLevel = process.env.LOG_LEVEL || 'trace';
const isTestEnv = 
  process.env.NODE_ENV === 'test' || 
  process.env.npm_lifecycle_event === 'test' || 
  process.argv.some(arg => arg.includes('.test.js') || arg === '--test');

const stream = pretty({
  colorize: true,
  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
  ignore: 'pid,hostname',
  customLevels: 'section:60,success:35,weaver:32,trace:10',
  customColors: 'section:bgCyan,success:green,weaver:magenta,trace:gray,error:red'
});

const logger = pino({
  level: logLevel,
  customLevels: {
    trace: 10,
    weaver: 32,
    success: 35,
    section: 60
  },
}, stream);

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: (msg, err = null) => {
    if (err instanceof Error) console.error(msg, err);
  },
  trace: () => {},
  success: () => {},
  weaver: () => {},
  section: () => {}
};

module.exports = isTestEnv ? silentLogger : {
  info: (msg) => logger.info(msg),
  warn: (msg) => logger.warn(msg),
  error: (msg, err = null) => {
    if (err instanceof Error) {
      logger.error({ err }, msg);
    } else {
      logger.error({ customErr: err }, msg);
    }
  },
  trace: (msg) => logger.trace(msg),
  success: (msg) => logger.success(msg),
  weaver: (type, from, to) => logger.weaver({ type, from, to }, `[${type}] ${from} ➔ ${to}`),
  section: (title) => {
    logger.section(`\n>>> ${title}`);
    logger.section('-'.repeat(60));
  }
};
