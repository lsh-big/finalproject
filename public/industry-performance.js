import { apiFetch, IS_DEMO } from './client.js';

const companyProfiles = [
  { id: 'samil', name: '삼일엘텍', business: '승강기 제어반·인버터', color: '#315ee8' },
  { id: 'daesung', name: '대성아이디에스', business: '승강기·제어반', color: '#087c70' },
  { id: 'mount', name: '마운트지앤디', business: '승강기 전장·부품', color: '#7055a6' },
  { id: 'daemyeong-ulsan', name: '대명엘리베이터(울산)', business: '완성 승강기', color: '#a45a15' }
];
const number = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
const missing = '—';
const currency = value => value == null ? missing : amount(value) + '억 원';
let selectedYear = null;

const amount = value => value == null ? missing : number.format(value);
const percent = value => value == null ? missing : number.format(value) + '%';
const margin = record => record?.revenue > 0 && record.profit != null
  ? record.profit / record.revenue * 100
  : null;
const growth = (current, previous) => previous?.revenue > 0 && current?.revenue != null
  ? (current.revenue / previous.revenue - 1) * 100
  : null;
const hundredMillion = value => Number.isSafeInteger(value) ? value / 100000000 : null;

function disclosedCompanies(records, years) {
  return companyProfiles.map(({ id, name, business, color }) => ({
    id, name, business, color,
    accounts: Object.fromEntries(years.map(year => {
      const record = records?.[id]?.[year];
      return [year, {
        revenue: hundredMillion(record?.revenue),
        previousRevenue: hundredMillion(record?.previousRevenue),
        profit: hundredMillion(record?.profit),
        receipt: /^\d{14}$/.test(record?.receipt) ? record.receipt : null,
        status: record?.status
      }];
    }))
  }));
}

function yearOptions(years) {
  return [...years].reverse().map(year =>
    `<option value="${year}" ${year === selectedYear ? 'selected' : ''}>${year}년</option>`).join('');
}

export function renderIndustryPerformance() {
  return `<div class="industry-performance">
    <div class="industry-controls">
      <p id="performance-source"><strong>OpenDART</strong><span>금융감독원 공시자료를 불러오는 중입니다.</span></p>
      <label>결산연도 <select id="performance-year" disabled><option>조회 중</option></select></label>
    </div>
    <div id="performance-results" aria-busy="true"><p role="status">실적 자료를 불러오는 중입니다.</p></div>
  </div>`;
}

function results(companies, years, year) {
  const rows = companies.map(company => {
    const record = company.accounts[year];
    const previous = { revenue: record?.previousRevenue };
    return { ...company, record, margin: margin(record), growth: growth(record, previous) };
  });
  const [samil] = rows;
  const filedCount = rows.filter(row => row.record?.receipt).length;
  const metrics = [
    ['매출액', amount(samil.record?.revenue), '억원'],
    ['매출 성장률', percent(samil.growth), ''],
    ['영업이익', amount(samil.record?.profit), '억원'],
    ['영업이익률', percent(samil.margin), '']
  ];
  return `<section aria-labelledby="performance-overview">
    <div class="industry-overview-heading">
      <h2 id="performance-overview">삼일엘텍 ${year}년 실적</h2>
      <span>공시 확인 <strong>${filedCount}/${rows.length}개사</strong></span>
    </div>
    <div class="industry-metrics">${metrics.map(([label, value, unit]) =>
      `<article class="panel"><span>${label}</span><strong>${value}${value !== missing && unit ? ` <small>${unit}</small>` : ''}</strong></article>`).join('')}</div>
  </section>
  <div class="industry-charts">
    <section class="panel">
      <div class="panel-heading"><div><h2>연도별 매출 추이</h2><p>${companies.length}개사 전사 매출액 · 억원</p></div></div>
      <div class="industry-chart-body">
        <ul class="industry-legend">${companies.map(({ name, color }) =>
          `<li><span style="background:${color}"></span>${name}</li>`).join('')}</ul>
        ${companies.some(({ accounts }) => years.some(item => accounts[item]?.revenue != null))
          ? '<canvas id="performance-trend" width="540" height="216" aria-hidden="true"></canvas>'
          : '<p class="empty">확인된 매출 자료가 없습니다.</p>'}
        <details class="industry-trend-data">
          <summary>연도별 매출 수치</summary>
          <div class="table-wrap"><table aria-label="연도별 매출액 (억 원)">
            <thead><tr><th scope="col">기업</th>${years.map(item => `<th scope="col">${item}년</th>`).join('')}</tr></thead>
            <tbody>${companies.map(({ name, accounts }) => `<tr><th scope="row">${name}</th>${years.map(item =>
              `<td>${amount(accounts[item]?.revenue)}</td>`).join('')}</tr>`).join('')}</tbody>
          </table></div>
        </details>
      </div>
    </section>
    <section class="panel">
      <div class="panel-heading"><div><h2>영업이익률 비교</h2><p>${year}년 전사 실적 · %</p></div></div>
      ${marginChart(rows, companies, years)}
    </section>
  </div>
  <section class="panel">
    <div class="panel-heading"><div><h2>${year}년 기업별 실적</h2><p>전사 실적 · 개별 재무제표</p></div></div>
    ${companyComparison(rows, year)}
    <p class="industry-table-note">매출 성장률은 같은 결산 기준의 전년 매출과 비교합니다. 확인할 수 없는 수치는 ‘—’로 표시합니다.</p>
  </section>`;
}

function companyComparison(rows, year) {
  const metrics = [
    ['매출액', row => currency(row.record?.revenue)],
    ['영업이익률', row => percent(row.margin)],
    ['영업이익', row => currency(row.record?.profit)],
    ['매출 성장률', row => percent(row.growth)]
  ];
  const reference = row => row.id === 'samil' ? 'industry-reference' : '';
  return `<div class="table-wrap industry-table-wrap"><table class="industry-table">
    <thead><tr><th scope="col">기업 · 주력 사업</th>${metrics.map(([label]) => `<th scope="col">${label}</th>`).join('')}<th scope="col">공시 상태</th><th scope="col">출처</th></tr></thead>
    <tbody>${rows.map(row => `<tr class="${reference(row)}"><th scope="row"><b>${row.name}</b><small>${row.business}</small></th>
      ${metrics.map(([, value]) => `<td>${value(row)}</td>`).join('')}
      <td>${filingStatus(row.record)}</td><td>${sourceLink(row.record, row.name, year)}</td></tr>`).join('')}</tbody>
  </table></div>
  <div class="industry-company-cards">${rows.map(row => `<article class="industry-company-card ${reference(row)}">
    <div class="industry-card-heading"><div><h3>${row.name}</h3><p>${row.business}</p></div>${filingStatus(row.record)}</div>
    <dl>${metrics.map(([label, value]) => `<div><dt>${label}</dt><dd>${value(row)}</dd></div>`).join('')}</dl>
    ${sourceLink(row.record, row.name, year)}
  </article>`).join('')}</div>`;
}

function filingStatus(record) {
  const statuses = {
    confirmed: ['green', '공시 확인'],
    'not-filed': ['', '미공시'],
    'needs-review': ['amber', '수치 확인 필요'],
    stale: ['amber', '이전 조회 자료'],
    unavailable: ['red', '조회 실패']
  };
  const [tone, label] = statuses[record?.status] ?? statuses.unavailable;
  return `<span class="status ${tone}">${label}</span>`;
}

function sourceLink(record, name, year) {
  if (!record?.receipt) return '<span class="industry-no-source">—</span>';
  return `<a class="industry-source-link" href="https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${record.receipt}" target="_blank" rel="noopener noreferrer" aria-label="${name} ${year}년 감사보고서">감사보고서</a>`;
}

function marginChart(rows, companies, years) {
  if (rows.every(row => row.margin === null)) return '<p class="empty">확인된 영업이익률 자료가 없습니다.</p>';
  const values = companies.flatMap(({ accounts }) => years.map(year => margin(accounts[year]) ?? 0));
  const min = Math.floor(Math.min(0, ...values) / 5) * 5;
  const max = Math.ceil(Math.max(5, ...values) / 5) * 5;
  const position = value => (value - min) / (max - min) * 100;
  const zero = position(0);
  return `<div class="industry-bars">
    <div class="industry-bar-axis" aria-hidden="true">${[...new Set([min, 0, max])].map(tick =>
      `<span style="--tick:${position(tick)}%">${percent(tick)}</span>`).join('')}</div>
    ${rows.map(({ name, margin, color }) => {
    const end = position(margin ?? 0);
    return `<div>
      <div class="industry-bar-label"><span>${name}</span><strong>${percent(margin)}</strong></div>
      <div class="industry-bar-track" aria-hidden="true">
        <span style="left:${Math.min(end, zero)}%;width:${Math.abs(end - zero)}%;background:${color}"></span>
        <i style="left:${zero}%"></i>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function drawTrend(canvas, companies, years, year) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  const left = 45;
  const right = canvas.width - 24;
  const top = 17;
  const bottom = canvas.height - 38;
  const revenues = companies.flatMap(({ accounts }) => years.map(item => accounts[item]?.revenue ?? 0));
  const gridStep = Math.max(1, Math.ceil(Math.max(...revenues) / 250)) * 50;
  const ceiling = gridStep * 5;
  const period = years.at(-1) - years[0];
  const x = index => left + (right - left) * (period ? .12 + .76 * (years[index] - years[0]) / period : .5);
  const y = revenue => bottom - (bottom - top) * revenue / ceiling;

  ctx.font = '14px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let tick = 0; tick <= ceiling; tick += gridStep) {
    ctx.strokeStyle = '#e2e9f4';
    ctx.beginPath();
    ctx.moveTo(left, y(tick));
    ctx.lineTo(right, y(tick));
    ctx.stroke();
    ctx.fillStyle = '#576781';
    ctx.fillText(number.format(tick), left - 9, y(tick));
  }

  ctx.textAlign = 'center';
  years.forEach((item, index) => {
    ctx.fillStyle = item === year ? '#244ac0' : '#576781';
    ctx.font = item === year ? 'bold 14px "Segoe UI", sans-serif' : '14px "Segoe UI", sans-serif';
    ctx.fillText(String(item), x(index), bottom + 20);
  });

  for (const { color, accounts } of companies) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    let previous = false;
    years.forEach((item, index) => {
      const revenue = accounts[item]?.revenue;
      if (revenue == null) {
        previous = false;
        return;
      }
      if (previous) ctx.lineTo(x(index), y(revenue));
      else ctx.moveTo(x(index), y(revenue));
      previous = true;
    });
    ctx.stroke();
    years.forEach((item, index) => {
      const revenue = accounts[item]?.revenue;
      if (revenue == null) return;
      ctx.beginPath();
      ctx.arc(x(index), y(revenue), item === year ? 5 : 3.5, 0, 2 * Math.PI);
      ctx.fill();
    });
  }
}

export async function bindIndustryPerformance(root) {
  const filter = root.querySelector('#performance-year');
  const output = root.querySelector('#performance-results');
  const source = root.querySelector('#performance-source');
  let payload;
  try {
    const response = IS_DEMO
      ? await fetch(new URL('./performance-public.json', import.meta.url), { redirect: 'error' })
      : await apiFetch('./api/performance', { cache: 'no-store' });
    if (!response.ok) throw Error('실적 조회 실패');
    payload = await response.json();
  } catch {
    payload = { status: 'unavailable' };
  }
  if (!output.isConnected) return;

  const descriptions = {
    unconfigured: '서버의 OpenDART 인증키 설정을 확인해 주세요.',
    unavailable: 'OpenDART 실적 자료를 불러오지 못했습니다.',
    partial: '일부 자료를 갱신하지 못했습니다. 기업별 공시 상태를 확인하세요.',
    ready: IS_DEMO ? '감사보고서에서 확인해 공개한 실적입니다.' : '감사보고서에서 확인된 최근 결산연도를 표시합니다.'
  };
  const checkedAt = new Date(payload.updatedAt);
  const checkedLabel = Number.isFinite(checkedAt.getTime())
    ? ' 자료 확인일 ' + new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul' }).format(checkedAt) : '';
  source.querySelector('span').textContent = (descriptions[payload.status] ?? descriptions.unavailable) + checkedLabel;
  output.setAttribute('aria-busy', 'false');

  const years = (payload.years ?? []).filter(year => Number.isInteger(year) && year >= 2000 && year <= 9999);
  if (!years.length) {
    filter.innerHTML = '<option>조회 연도 없음</option>';
    output.innerHTML = '<p class="panel empty" role="status">표시할 결산 실적이 없습니다.</p>';
    return;
  }
  if (!years.includes(selectedYear)) selectedYear = years.at(-1);
  filter.innerHTML = yearOptions(years);
  filter.disabled = false;
  const companies = disclosedCompanies(payload.records, years);
  const render = () => {
    output.innerHTML = results(companies, years, selectedYear);
    drawTrend(output.querySelector('#performance-trend'), companies, years, selectedYear);
  };
  filter.addEventListener('change', () => {
    selectedYear = Number(filter.value);
    render();
  });

  render();
}
