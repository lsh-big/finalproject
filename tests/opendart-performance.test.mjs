import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { createOpenDartPerformance, readAuditPerformance } from '../opendart-performance.mjs';

function row(code, label, current, previous) {
  return `<TR><TE ACODE="${code}" ADELIM="0">${label}</TE>
    <TE ACODE="${code}" ADELIM="2">${current}</TE>
    <TE ACODE="${code}" ADELIM="4">${previous}</TE></TR>`;
}

const statement = `<SECTION-2><TITLE>손 익 계 산 서</TITLE>
  <P>2025년 1월 1일부터</P><P>(단위 : 원)</P><TABLE>
  ${row('12100000010000', 'Ⅰ. 매출액(주석16)', '13,743,296,713', '19,739,302,947')}
  ${row('12500000010000', 'Ⅴ. 영업손실', '399,045,546', '(99,000)')}
  </TABLE></SECTION-2>
  <SECTION-2><TITLE>주석</TITLE><TABLE>
  ${row('12100000010000', '매출액', '99', '100')}
  </TABLE></SECTION-2>`;

test('audit figures use the labelled reporting year, won amounts and current and prior columns', () => {
  assert.deepEqual(readAuditPerformance(statement, 2025), {
    revenue: 13743296713,
    previousRevenue: 19739302947,
    profit: -399045546
  });
  assert.equal(readAuditPerformance(statement, 2024), null);
  assert.equal(readAuditPerformance(statement.replace('단위 : 원', '단위 : 천원'), 2025), null);
});

function documentResponse(xml) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(8, 8);
  return new Response(Buffer.concat([header, deflateRawSync(xml)]));
}

test('available reports determine the years and each company retains its own filing status', async t => {
  const privateDir = await mkdtemp(path.join(tmpdir(), 'samil-opendart-'));
  t.after(() => rm(privateDir, { recursive: true, force: true }));
  await writeFile(path.join(privateDir, 'opendart.key'), 'a'.repeat(40));
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date())) - 1;
  const receipt = year => `${year + 1}0401000001`;
  const mountReceipt = `${year + 1}0401000002`;
  let samilUnavailable = false;
  const request = async url => {
    const params = url.searchParams;
    if (url.pathname.endsWith('document.xml')) {
      return documentResponse(params.get('rcept_no') === mountReceipt ? '<DOCUMENT />' : statement.replace('2025년', `${year}년`));
    }
    switch (params.get('corp_code')) {
      case '00538132':
        if (samilUnavailable) throw Error('unavailable');
        return Response.json({ status: '000', list: [{ report_nm: `감사보고서 (${year}.12)`, rcept_no: receipt(year) }] });
      case '01641071':
        return Response.json({ status: '000', list: [{ report_nm: `[기재정정]감사보고서 (${year}.12)`, rcept_no: mountReceipt }] });
      default:
        return Response.json({ status: '013' });
    }
  };

  const result = await createOpenDartPerformance(privateDir, request)();
  assert.deepEqual(result.years, [year]);
  assert.equal(result.records.samil[year].status, 'confirmed');
  assert.equal(result.records.daesung[year].status, 'not-filed');
  assert.equal(result.records.mount[year].status, 'needs-review');
  assert.equal(result.records.mount[year].receipt, mountReceipt);

  const cacheFile = path.join(privateDir, 'opendart-cache', 'performance.json');
  const cached = JSON.parse(await readFile(cacheFile, 'utf8'));
  await writeFile(cacheFile, JSON.stringify({ ...cached, updatedAt: new Date(0).toISOString() }));
  samilUnavailable = true;
  const partial = await createOpenDartPerformance(privateDir, request)();
  assert.equal(partial.status, 'partial');
  assert.deepEqual(partial.records.samil[year], { ...result.records.samil[year], status: 'stale' });
  assert.equal(partial.records.daesung[year].status, 'not-filed');
});
