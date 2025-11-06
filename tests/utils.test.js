const fs = require('fs');
const path = require('path');

describe('utils', () => {
  let api;
  let logger;

  const clearEnv = () => {
    delete process.env.ACTUAL_SERVER_URL;
    delete process.env.ACTUAL_PASSWORD;
    delete process.env.ACTUAL_SYNC_ID;
    delete process.env.BUDGET_DIR;
    delete process.env.ACTUAL_BUDGET_ENCRYPTION_PASSWORD;
  };

  const loadUtils = () => {
    let utils;
    jest.resetModules();
    jest.isolateModules(() => {
      api = require('@actual-app/api');
      logger = require('../src/logger');
      utils = require('../src/utils');
    });
    return utils;
  };

  const setEnv = (overrides = {}) => {
    process.env.ACTUAL_SERVER_URL =
      overrides.serverURL || 'https://example.test';
    process.env.ACTUAL_PASSWORD = overrides.password || 'pass';
    process.env.ACTUAL_SYNC_ID = overrides.syncId || 'sync-id';
    if (overrides.budgetDir) {
      process.env.BUDGET_DIR = overrides.budgetDir;
    }
    if (overrides.encryptionPassword) {
      process.env.ACTUAL_BUDGET_ENCRYPTION_PASSWORD =
        overrides.encryptionPassword;
    }
  };

  beforeEach(() => {
    clearEnv();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearEnv();
  });

  test('openBudget throws when required env vars missing', async () => {
    const { openBudget } = loadUtils();
    await expect(openBudget()).rejects.toThrow(
      'Missing ACTUAL_SERVER_URL, ACTUAL_PASSWORD, ACTUAL_SYNC_ID',
    );
  });

  test('openBudget initializes budget using absolute directory and encryption password', async () => {
    const absDir = path.join(process.cwd(), 'data', 'abs-budget');
    setEnv({ budgetDir: absDir, encryptionPassword: 'enc' });
    const utils = loadUtils();
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await utils.openBudget();

    expect(mkdirSpy).toHaveBeenCalledWith(absDir, { recursive: true });
    expect(api.init).toHaveBeenCalledWith({
      dataDir: absDir,
      serverURL: 'https://example.test',
      password: 'pass',
    });
    expect(api.downloadBudget).toHaveBeenCalledWith('sync-id', {
      password: 'enc',
    });
    expect(api.sync).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('openBudget handles relative budget directory, download errors, and sync errors', async () => {
    setEnv({ budgetDir: 'relative-bucket' });
    const utils = loadUtils();
    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    api.downloadBudget.mockRejectedValueOnce(new Error('download failed'));
    api.sync
      .mockRejectedValueOnce(new Error('sync failed'))
      .mockResolvedValueOnce();

    await utils.openBudget();
    await utils.openBudget();

    const expectedDir = path.join(process.cwd(), 'relative-bucket');
    expect(mkdirSpy).toHaveBeenCalledWith(expectedDir, { recursive: true });
    expect(api.downloadBudget).toHaveBeenCalledTimes(2);
    expect(api.sync).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls).toEqual([
      ['downloadBudget failed or cached:', 'download failed'],
      ['initial sync failed:', 'sync failed'],
    ]);
  });

  test('closeBudget shuts down the API', async () => {
    const { closeBudget } = loadUtils();
    await closeBudget();
    expect(api.shutdown).toHaveBeenCalledTimes(1);
  });

  test('closeBudget logs shutdown failures', async () => {
    const { closeBudget } = loadUtils();
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    api.shutdown.mockRejectedValueOnce(new Error('boom'));
    await closeBudget();
    expect(api.shutdown).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('shutdown failed:', 'boom');
  });

  test('formatYMD returns zero-padded UTC date', () => {
    const { formatYMD } = loadUtils();
    const date = new Date(Date.UTC(2024, 0, 5, 23, 59, 0));
    expect(formatYMD(date)).toBe('2024-01-05');
    expect(formatYMD('2024-12-31')).toBe('2024-12-31');
  });

  test('parseBool interprets boolean-like values', () => {
    const { parseBool } = loadUtils();
    expect(parseBool(true)).toBe(true);
    expect(parseBool('YES')).toBe(true);
    expect(parseBool('0')).toBe(false);
    expect(parseBool('off')).toBe(false);
    expect(parseBool('unknown')).toBe(false);
    expect(parseBool(null)).toBe(false);
  });
});
