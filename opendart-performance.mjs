import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import path from 'node:path';

const companies = [
  { id: 'samil', code: '00538132' },
  { id: 'daesung', code: '01753613' },
  { id: 'mount', code: '01641071' },
  { id: 'daemyeong-ulsan', code: '00917551' }
];
const cacheVersion = 3;
const cacheDuration = 24 * 60 * 60 * 1000;
const maxDocumentBytes = 16 * 1024 * 1024;
const seoulYear = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' });

function auditXml(bytes) {
  const zip = Buffer.from(bytes);
  if (zip.length < 30 || zip.readUInt32LE(0) !== 0x04034b50 || zip.readUInt16LE(8) !== 8) {
    throw new Error('OpenDART 감사보고서 압축 형식을 확인할 수 없습니다.');
  }
  const start = 30 + zip.readUInt16LE(26) + zip.readUInt16LE(28);
  return inflateRawSync(zip.subarray(start), { maxOutputLength: maxDocumentBytes }).toString('utf8');
}

const text = value => value.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/g, ' ').trim();

function won(value) {
  const amount = text(value).replace(/[\s,]/g, '').replace(/^\((\d+)\)$/, '-$1');
  if (!/^-?\d+$/.test(amount) || !Number.isSafeInteger(Number(amount))) return null;
  return Number(amount);
}

function account(document, code, label) {
  const matches = [];
  for (const row of document.matchAll(/<TR\b[^>]*>([\s\S]*?)<\/TR>/gi)) {
    const cells = [...row[1].matchAll(/<TE\b([^>]*)>([\s\S]*?)<\/TE>/gi)]
      .filter(([, attributes]) => attributes.includes(`ACODE="${code}"`));
    const value = column => cells.find(([, attributes]) => attributes.includes(`ADELIM="${column}"`))?.[2] ?? '';
    const name = text(value(0)).replace(/\s/g, '');
    if (!label.test(name)) continue;
    const sign = name.includes('영업손실') && !name.includes('영업이익') ? -1 : 1;
    const amounts = [won(value(2)), won(value(4))].map(amount => sign === -1 && amount !== null ? -Math.abs(amount) : amount);
    matches.push(amounts);
  }
  return matches.length === 1 ? matches[0] : [null, null];
}

export function readAuditPerformance(document, year) {
  const start = document.search(/<TITLE\b[^>]*>\s*손\s*익\s*계\s*산\s*서\s*<\/TITLE>/i);
  if (start < 0) return null;
  const section = document.slice(start).split(/<\/SECTION-\d+>/i, 1)[0];
  if (!/단위\s*[:：]\s*원(?=\s|[)<])/i.test(section) || !new RegExp(`${year}\\s*년`).test(section)) return null;
  const [revenue, previousRevenue] = account(section, '12100000010000', /매출액(?:\(주석[^)]*\))?$/);
  const [profit] = account(section, '12500000010000', /영업(?:이익|손실)(?:\([^)]*\))?$/);
  return revenue === null && profit === null ? null : { revenue, previousRevenue, profit };
}

export function createOpenDartPerformance(privateDir, request = fetch) {
  const cacheDir = path.join(privateDir, 'opendart-cache');
  const cacheFile = path.join(cacheDir, 'performance.json');
  let inFlight;
  let recent;
  let expires = 0;

  async function refresh() {
    const latestYear = Number(seoulYear.format(new Date())) - 1;
    const earliestYear = latestYear - 3;
    const snapshot = await readFile(cacheFile, 'utf8').then(JSON.parse).catch(() => null);
    const cached = snapshot?.version === cacheVersion ? snapshot : null;
    if (cached?.latestYear === latestYear && Date.now() - Date.parse(cached.updatedAt) < cacheDuration) return cached;
    const key = (process.env.OPENDART_API_KEY || await readFile(path.join(privateDir, 'opendart.key'), 'utf8')
      .catch(error => { if (error.code === 'ENOENT') return ''; throw error; })).trim();
    if (!/^[a-f0-9]{40}$/i.test(key)) return { status: 'unconfigured' };

    async function get(endpoint, params) {
      const url = new URL(endpoint, 'https://opendart.fss.or.kr/api/');
      url.search = new URLSearchParams({ crtfc_key: key, ...params });
      const response = await request(url, { signal: AbortSignal.timeout(10000), redirect: 'error' });
      if (!response.ok) throw new Error('OpenDART 요청에 실패했습니다.');
      return response;
    }

    const filings = await Promise.all(companies.map(async ({ id, code }) => {
      try {
        const response = await get('list.json', {
          corp_code: code, bgn_de: String(earliestYear + 1) + '0101',
          pblntf_detail_ty: 'F001', last_reprt_at: 'Y', page_count: 100
        });
        const result = await response.json();
        const reports = new Map();
        if (result.status === '013') return { id, reports };
        if (result.status !== '000' || !Array.isArray(result.list)) throw new Error('감사보고서 목록을 조회할 수 없습니다.');
        for (const item of result.list) {
          const year = Number(/^(?:\[[^\]]+\]\s*)?감사보고서\s*\((\d{4})\.12\)$/.exec(item.report_nm)?.[1]);
          if (year >= earliestYear && year <= latestYear && /^\d{14}$/.test(item.rcept_no) && !reports.has(year)) {
            reports.set(year, item.rcept_no);
          }
        }
        return { id, reports };
      } catch {
        return { id, reports: null };
      }
    }));

    const reportedYears = filings.flatMap(({ id, reports }) => reports
      ? [...reports.keys()]
      : (cached?.years ?? []).filter(year => year >= earliestYear && cached.records[id]?.[year]?.receipt));
    const years = [...new Set(reportedYears)].sort((a, b) => a - b).slice(-3);
    const records = Object.fromEntries(await Promise.all(filings.map(async ({ id, reports }) => [
      id, Object.fromEntries(await Promise.all(years.map(async year => {
        const receipt = reports?.get(year);
        const previous = cached?.records[id]?.[year];
        const unavailable = () => previous?.receipt
          ? { ...previous, status: 'stale' }
          : { receipt, status: 'unavailable' };
        if (!reports) return [year, unavailable()];
        if (!receipt) return [year, { status: 'not-filed' }];
        if (previous?.receipt === receipt && previous.status === 'confirmed') return [year, previous];
        try {
          const response = await get('document.xml', { rcept_no: receipt });
          const document = auditXml(await response.arrayBuffer());
          const amounts = readAuditPerformance(document, year);
          const status = amounts?.revenue != null && amounts.profit != null ? 'confirmed' : 'needs-review';
          return [year, { ...amounts, receipt, status }];
        } catch {
          return [year, unavailable()];
        }
      })))
    ])));

    const failed = filings.some(({ reports }) => !reports) || Object.values(records).some(company =>
      Object.values(company).some(({ status }) => status === 'stale' || status === 'unavailable'));
    const status = failed
      ? (Object.values(records).some(company => Object.values(company).some(record => record.receipt)) ? 'partial' : 'unavailable')
      : 'ready';
    const result = { version: cacheVersion, status, latestYear, updatedAt: new Date().toISOString(), years, records };
    if (!failed) {
      try {
        const temporary = cacheFile + '.' + process.pid + '.tmp';
        await mkdir(cacheDir, { recursive: true, mode: 0o700 });
        await writeFile(temporary, JSON.stringify(result), { mode: 0o600 });
        await rename(temporary, cacheFile);
      } catch {
        // The current request can still use the data when disk caching is unavailable.
      }
    }
    return result;
  }

  return async () => {
    if (Date.now() < expires) return recent;
    inFlight ??= refresh().catch(() => ({ status: 'unavailable' })).then(result => {
      recent = result;
      expires = result.status === 'ready' ? Date.parse(result.updatedAt) + cacheDuration : Date.now() + 60000;
      return result;
    }).finally(() => { inFlight = undefined; });
    return inFlight;
  };
}
