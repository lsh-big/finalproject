import assert from 'node:assert/strict';
import test from 'node:test';
import {compare, groundedCandidates, localCandidates, normalize} from '../public/order-spec.js';

test('order comparison uses exact units and valid dates with independent floor fields', () => {
  for (const [key, left, right] of [
    ['voltage', '380 V', '0.380 kV'],
    ['load', '1,000 kg', '1 t'],
    ['motor', '11.000 kW', '11000 W'],
    ['speed', '1.75 m/s', '105 m/min'],
    ['dueDate', '2027.02.15', '2027년 2월 15일'],
    ['stopLabels', 'B1F, 1F, 2F', '1층 · 지하1층 · 2층'],
  ]) {
    assert.notEqual(normalize(key, left), null);
    assert.equal(normalize(key, left), normalize(key, right));
  }
  assert.notEqual(normalize('speed', '1.1234567890123'), normalize('speed', '1.1234567890124'));
  assert.equal(normalize('dueDate', '2027-02-30'), null);
  assert.equal(normalize('voltage', '380/440 V'), null);
  const candidates = localCandidates([
    {page: 1, text: '층수 15층'},
    {page: 1, text: '정차층 수: 14'},
    {page: 1, text: '전원 전압: 380/440V'},
  ]);
  const technical = localCandidates([
    {sheet: '조건', cell: 'A7', text: '층수', next: '16층', nextCell: 'B7'},
    {sheet: '조건', cell: 'A8', text: '정차층 수', next: '14층', nextCell: 'B8'},
  ]);
  const documents = [candidates, technical].map((items, i) => ({
    id: i, name: i ? '기술.xlsx' : '발주.pdf', warnings: [], candidates: items.map((item, index) => ({...item, index})),
  }));
  const result = Object.fromEntries(compare({documents, decisions: {}}).map(row => [row.key, row]));
  assert.equal(result.floors.status, '불일치');
  assert.deepEqual(result.floors.candidates.map(item => item.source), ['발주.pdf · 1쪽', '기술.xlsx · 조건!B7']);
  assert.equal(result.stopCount.status, '일치');
  assert.equal(result.voltage.status, '확인 필요');
  assert.equal(result.motor.status, '누락');
});

test('AI candidates require verbatim evidence and respect known labels and XLSX coordinates', () => {
  const fragments = [
    {page: 1, text: 'Number of Stops: 14'},
    {page: 2, text: 'Standard motor supplied in 11kW.'},
    {sheet: '전원', cell: 'A4', text: '공급선', next: '380V', nextCell: 'B4'},
  ];
  const result = groundedCandidates([
    {key: 'floors', index: 0, value: '14', quote: 'Number of Stops: 14'},
    {key: 'motor', index: 1, value: '12kW', quote: 'Standard motor supplied in 12kW.'},
    {key: 'motor', index: 1, value: '11kW', quote: 'Standard motor supplied in 11kW.'},
    {key: 'voltage', index: 2, value: '380V', quote: '공급선\n380V'},
  ], fragments);
  assert.deepEqual(result.map(({key, value, page, cell, needsReview}) =>
    [key, value, page ?? cell, needsReview]), [['motor', '11kW', 2, true], ['voltage', '380V', 'B4', true]]);
});
