describe('logger', () => {
  const loadLogger = () => {
    let logger;
    jest.resetModules();
    jest.isolateModules(() => {
      logger = require('../src/logger');
    });
    return logger;
  };

  const preserveEnv = () => ({
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,
  });

  const restoreEnv = ({ nodeEnv, logLevel }) => {
    if (nodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnv;
    }
    if (logLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = logLevel;
    }
  };

  test('honors LOG_LEVEL when not forced silent', () => {
    const snapshot = preserveEnv();
    process.env.NODE_ENV = 'production';
    process.env.LOG_LEVEL = 'debug';
    const logger = loadLogger();
    expect(logger.level).toBe('debug');
    restoreEnv(snapshot);
  });

  test('forces silent level for tests or explicit silent log level', () => {
    const snapshot = preserveEnv();
    process.env.NODE_ENV = 'test';
    delete process.env.LOG_LEVEL;
    const testLogger = loadLogger();
    expect(testLogger.level).toBe('silent');

    process.env.NODE_ENV = 'production';
    process.env.LOG_LEVEL = 'silent';
    const silentLogger = loadLogger();
    expect(silentLogger.level).toBe('silent');
    restoreEnv(snapshot);
  });
});
