import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createOpenDartPerformance } from '../opendart-performance.mjs';

const publicCompanies = ['samil', 'daesung', 'mount', 'daemyeong-ulsan'];
const publicStatuses = new Set(['confirmed', 'not-filed', 'needs-review']);
const privateDir = fileURLToPath(new URL('../.private/', import.meta.url));
const data = await createOpenDartPerformance(privateDir)();
if (data.status !== 'ready' || !data.years?.length || !Number.isFinite(Date.parse(data.updatedAt))) {
  throw Error('OpenDART 조회가 완료되지 않아 기존 공개 실적 파일을 유지합니다.');
}

const won = value => Number.isSafeInteger(value) ? value : null;
const records = Object.fromEntries(publicCompanies.map(company => [company, Object.fromEntries(data.years.map(year => {
  const row = data.records[company]?.[year];
  if (!publicStatuses.has(row?.status)) throw Error('공개할 공시 상태를 확인하세요.');
  if (row.status === 'not-filed') return [year, { status: row.status }];
  if (typeof row.receipt !== 'string' || !/^\d{14}$/.test(row.receipt)) throw Error('공시 접수번호를 확인하세요.');
  return [year, {
    status: row.status,
    receipt: row.receipt,
    revenue: won(row.revenue),
    previousRevenue: won(row.previousRevenue),
    profit: won(row.profit)
  }];
}))]));

const published = { status: 'ready', updatedAt: new Date(data.updatedAt).toISOString(), years: data.years, records };
await writeFile(new URL('../public/performance-public.json', import.meta.url), JSON.stringify(published, null, 2) + '\n');
console.log(`공개 실적 파일 갱신 완료 (${publicCompanies.length}개사, ${data.years.join(', ')}년)`);
