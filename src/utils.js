require('dotenv').config();
const fs = require('fs');
const path = require('path');
const api = require('@actual-app/api');
const logger = require('./logger');

let hasDownloaded = false;

async function openBudget() {
  const url = process.env.ACTUAL_SERVER_URL;
  const password = process.env.ACTUAL_PASSWORD;
  const syncId = process.env.ACTUAL_SYNC_ID;
  if (!url || !password || !syncId) {
    throw new Error(
      'Missing ACTUAL_SERVER_URL, ACTUAL_PASSWORD, ACTUAL_SYNC_ID',
    );
  }
  const budgetDir = process.env.BUDGET_DIR || './data/budget';
  const abs = path.isAbsolute(budgetDir)
    ? budgetDir
    : path.join(process.cwd(), budgetDir);
  fs.mkdirSync(abs, { recursive: true });
  await api.init({ dataDir: abs, serverURL: url, password });
  const opts = {};
  const enc = process.env.ACTUAL_BUDGET_ENCRYPTION_PASSWORD;
  if (enc) opts.password = enc;
  if (!hasDownloaded) {
    try {
      await api.downloadBudget(syncId, opts);
      hasDownloaded = true;
    } catch (e) {
      logger.warn('downloadBudget failed or cached:', e?.message || e);
    }
  }
  try {
    await api.sync();
  } catch (e) {
    logger.warn('initial sync failed:', e?.message || e);
  }
}

async function closeBudget() {
  try {
    await api.shutdown();
  } catch (e) {
    logger.warn('shutdown failed:', e?.message || e);
  }
}

function formatYMD(d) {
  const date = new Date(d);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

module.exports = { openBudget, closeBudget, formatYMD };
