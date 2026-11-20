import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createDemoOrders} from '../public/order-demo.js';

const samples = JSON.parse(await readFile(new URL('../public/order-demo-data.json', import.meta.url), 'utf8'));
const reviewer = {username: '공개 시연', canReviewOrders: true};

function fixture() {
  const storage = new Map();
  const api = () => createDemoOrders({
    getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }, 'orders', () => Promise.resolve(samples));
  return {api, storage};
}

function post(api, path, body, user = reviewer) {
  return api.request('api/orders' + path, {method: 'POST', body: JSON.stringify(body)}, user);
}

function readParts(bytes) {
  const entries = {};
  for (let offset = 0; bytes.readUInt32LE(offset) === 0x04034b50;) {
    const size = bytes.readUInt32LE(offset + 18);
    const nameEnd = offset + 30 + bytes.readUInt16LE(offset + 26);
    const start = nameEnd + bytes.readUInt16LE(offset + 28);
    entries[bytes.toString('utf8', offset + 30, nameEnd)] = bytes.toString('utf8', start, start + size);
    offset = start + size;
  }
  return entries;
}

test('public orders compare the three synthetic document sets and preserve real source locations', async () => {
  const api = fixture().api();
  for (const [scenario, floors, motor] of [
    ['normal', '일치', '일치'], ['conflict', '불일치', '일치'], ['missing', '일치', '누락'],
  ]) {
    const response = await post(api, '', {scenario});
    assert.equal(response.status, 201);
    const {rows} = await response.json();
    const byKey = Object.fromEntries(rows.map(row => [row.key, row]));
    assert.equal(byKey.floors.status, floors);
    assert.deepEqual(byKey.floors.candidates.map(({page, cell}) => page ?? cell), [1, 'B7']);
    assert.equal(byKey.stopCount.status, '일치');
    assert.equal(byKey.voltage.status, '일치');
    assert.equal(byKey.motor.status, motor);
  }
  assert.equal((await post(api, '', {files: []})).status, 400);
  assert.equal((await post(api, '', {scenario: 'normal'}, {...reviewer, canReviewOrders: false})).status, 403);
});

test('public reviews persist in browser storage and only a complete confirmed review yields a final workbook', async () => {
  const {api: open, storage} = fixture();
  const api = open();
  const order = await (await post(api, '', {scenario: 'conflict'})).json();
  const reviewPath = `/${order.id}/review`;
  const exportPath = `api/orders/${order.id}/export`;
  const draft = await api.request(exportPath, {}, reviewer);
  assert.match(decodeURIComponent(draft.headers.get('Content-Disposition')), /검토중-초안\.xlsx$/);
  assert.equal((await post(api, reviewPath, {revision: 0, finalize: true, confirmed: true})).status, 400);
  const decisions = Object.fromEntries(order.rows.map(row => [row.key, {
    candidate: row.candidates.at(-1).id, reason: row.key === 'floors' ? '시연용 16층 <확인>' : '',
  }]));
  const saved = await post(api, reviewPath, {revision: 0, decisions});
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).status, '검토 중');
  const reloaded = open();
  const action = await post(reloaded, reviewPath, {revision: 1, finalize: true, confirmed: true});
  assert.equal(action.status, 200);
  const confirmed = await action.json();
  assert.equal(confirmed.status, '확정');
  assert.equal(confirmed.rows.find(row => row.key === 'floors').decision.value, '16층');
  assert.equal((await post(api, reviewPath, {revision: 1, decisions})).status, 409);
  const download = await reloaded.request(exportPath, {}, reviewer);
  assert.match(decodeURIComponent(download.headers.get('Content-Disposition')), /시연-확정본\.xlsx$/);
  const parts = readParts(Buffer.from(await download.arrayBuffer()));
  assert.match(parts['xl/workbook.xml'], /수주 사양표.*검토 이력/);
  assert.match(parts['xl/worksheets/sheet1.xml'], /16층/);
  assert.match(parts['xl/worksheets/sheet2.xml'], /시연용 16층 &lt;확인&gt;/);
  assert.match(parts['xl/worksheets/sheet2.xml'], /Floors: 15/);
  await reloaded.reset();
  assert.equal(storage.has('orders'), false);
});
