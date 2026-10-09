const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const root = path.resolve(__dirname, '..');
function getToken() {
  const file = path.join(root, '.expo', 'cardex-token');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try { fs.writeFileSync(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  return fs.readFileSync(file, 'utf8').trim();
}
function getConfig() {
  let local = {};
  try { local = JSON.parse(fs.readFileSync(path.join(__dirname, 'credentials.local.json'), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw new Error('Invalid server credentials file'); }
  return { token: getToken(), apiKey: process.env.OPENAI_API_KEY || local.apiKey, model: process.env.OPENAI_MODEL || 'gpt-4.1-mini' };
}
module.exports = { getToken, getConfig };
