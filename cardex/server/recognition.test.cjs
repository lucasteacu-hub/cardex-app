const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createMiddleware, recognize } = require('./recognition.cjs');
const { DETAIL_LABELS } = require('../shared/recognition');
const photo = 'data:image/jpeg;base64,/9j/AAAA';
const fixture = () => ({ status: 'identified', make: 'Porsche', model: '911', confidence: 'medium', summary: 'Generation is uncertain.', visualClues: ['Round headlights'], alternatives: [], details: Object.fromEntries(Object.keys(DETAIL_LABELS).map(key => [key, { value: null, basis: 'unknown', confidence: 'unknown' }])) });
const response = result => ({ ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] }) });
const config = { apiKey: 'test-key-not-real', token: 'test-token' };
async function request(middleware, body = { image: photo }, headers = {}) {
  const req = Readable.from([Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]);
  req.url = '/api/recognize'; req.method = 'POST'; req.setTimeout = () => {};
  req.headers = { authorization: 'Bearer test-token', 'content-type': 'application/json', ...headers };
  const result = {};
  const res = { writeHead(status) { result.status = status; }, end(data) { result.body = JSON.parse(data); } };
  await middleware(req, res, () => { throw new Error('Unexpected next'); });
  return result;
}
test('successful scan uses image input, schema, no storage, and server-only credentials', async () => {
  const result = await recognize(photo, { apiKey: config.apiKey, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-key-not-real');
    const body = JSON.parse(options.body);
    assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
    assert.equal(body.input[0].content[1].image_url, photo);
    return response(fixture());
  } });
  assert.equal(result.model, '911'); assert.equal(result.details.engine.value, null);
});
test('no car and ambiguous multi-car results remain unidentified', async () => {
  for (const status of ['no_car', 'multiple_cars']) {
    const value = { ...fixture(), status, make: null, model: null, confidence: 'unknown' };
    assert.equal((await recognize(photo, { apiKey: 'test', fetchImpl: async () => response(value) })).status, status);
  }
});
test('invalid and inconsistent provider details are rejected', async () => {
  const invalid = fixture(); invalid.details.power = { value: '500 hp', basis: 'unknown', confidence: 'high' };
  await assert.rejects(recognize(photo, { apiKey: 'test', fetchImpl: async () => response(invalid) }), e => e.status === 502);
});
test('provider failures, refusal and incomplete output do not become fake identifications', async () => {
  for (const status of [401, 403, 429, 500]) await assert.rejects(recognize(photo, { apiKey: 'test', fetchImpl: async () => ({ ok: false, status }) }), e => e.status >= 400);
  await assert.rejects(recognize(photo, { apiKey: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({status: 'incomplete'}) }) }), e => e.status === 502);
  await assert.rejects(recognize(photo, { apiKey: 'test', fetchImpl: async () => ({ ok: true, json: async () => ({status: 'completed', output: [{type:'message',content:[{type:'refusal'}]}]}) }) }), e => e.status === 422);
});
test('unauthenticated and unconfigured requests never call provider', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return response(fixture()); };
  assert.equal((await request(createMiddleware({getConfig: () => config, fetchImpl}), undefined, {authorization: 'wrong'})).status, 401);
  assert.equal((await request(createMiddleware({getConfig: () => ({token: config.token}), fetchImpl}))).status, 503);
  assert.equal(calls, 0);
});
test('malformed, non-JPEG and oversized requests are rejected without provider calls', async () => {
  let calls = 0; const middleware = createMiddleware({getConfig: () => config, fetchImpl: async () => { calls++; return response(fixture()); }});
  for (const body of ['{bad', {image:'https://example.com/a.jpg'}, {image:'data:image/jpeg;base64,invalid'}]) assert.equal((await request(middleware, body)).status, 400);
  assert.equal((await request(middleware, undefined, {'content-length': String(7 * 1024 * 1024)})).status, 413);
  assert.equal((await request(middleware, 'x'.repeat(6 * 1024 * 1024 + 1))).status, 413);
  assert.equal(calls, 0);
});
test('rate limit caps paid calls and resets after an hour', async () => {
  let time = 0, calls = 0;
  const middleware = createMiddleware({getConfig: () => config, now: () => time, fetchImpl: async () => {calls++; return response(fixture());}});
  for (let i=0;i<30;i++) assert.equal((await request(middleware)).status, 200);
  assert.equal((await request(middleware)).status, 429); assert.equal(calls, 30);
  time = 3600001; assert.equal((await request(middleware)).status, 200);
});
test('concurrent scans do not trigger additional paid requests', async () => {
  let release, started;
  const start = new Promise(resolve => { started = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const middleware = createMiddleware({getConfig: () => config, fetchImpl: async () => { started(); await wait; return response(fixture()); }});
  const first = request(middleware); await start;
  assert.equal((await request(middleware)).status, 429);
  release(); assert.equal((await first).status, 200);
});
