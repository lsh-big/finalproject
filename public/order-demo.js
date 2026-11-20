import {localCandidates, nowKst, OrderError, orderSummary, presentOrder, reviewOrder} from './order-spec.js';
import {orderWorkbook} from './order-workbook.js';

export const demoScenarios = {
  normal: ['정상', '두 문서의 사양이 일치합니다.'],
  conflict: ['불일치', '층수 15층과 16층을 비교합니다.'],
  missing: ['누락', '두 문서에 모터 용량이 비어 있습니다.'],
};
export const orderKinds = {po: '발주서', tech: '기술 사양서'};
export const sampleName = (scenario, kind) =>
  `시연-${demoScenarios[scenario][0]}-${orderKinds[kind]}.${kind === 'po' ? 'pdf' : 'xlsx'}`;
export function sampleAsset(scenario, kind) {
  const file = {po: 'po.pdf', tech: 'tech.xlsx', preview: 'po.jpg'}[kind];
  return `./order-demo-${scenario}-${file}`;
}

const json = (status, value) => new Response(JSON.stringify(value), {
  status, headers: {'Content-Type': 'application/json; charset=utf-8'},
});
async function fetchSamples() {
  const response = await fetch(new URL('./order-demo-data.json', import.meta.url));
  if (!response.ok) throw new OrderError('시연 문서 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.', 503);
  return response.json();
}

export function createDemoOrders(storage, key, loadSamples = fetchSamples) {
  let queue = Promise.resolve();
  let samples;

  function read() {
    try {
      return JSON.parse(storage.getItem(key) ?? '[]');
    } catch {
      throw new OrderError('저장된 수주 시연을 읽을 수 없습니다. 대시보드에서 시연을 초기화해 주세요.');
    }
  }

  function save(orders) {
    try {
      storage.setItem(key, JSON.stringify(orders));
    } catch {
      throw new OrderError('브라우저 저장 공간이 부족하거나 차단되었습니다. 대시보드에서 시연을 초기화해 주세요.');
    }
  }

  async function create(scenario, user) {
    if (!Object.hasOwn(demoScenarios, scenario)) throw new OrderError('시연 문서 사례를 선택하세요.');
    samples ??= await loadSamples();
    const id = crypto.randomUUID();
    const at = nowKst();
    const documents = Object.entries(orderKinds).map(([kind]) => {
      const format = kind === 'po' ? 'pdf' : 'xlsx';
      return {
        id: kind, name: sampleName(scenario, kind), kind, format, scenario,
        method: kind === 'po' ? '시연 PDF 원문 / 로컬 규칙' : '시연 XLSX 셀 원문 / 로컬 규칙', warnings: [],
        candidates: localCandidates(samples[scenario][kind]).map((item, index) => ({...item, index})),
      };
    });
    return {
      id, number: `DEMO-${id.slice(0, 8).toUpperCase()}`, name: `호라이즌 센터 제어반 · ${demoScenarios[scenario][0]} 시연`,
      customer: '호라이즌리프트 (가상)', status: '검토 중', updatedAt: at, reviewAssignee: user.username,
      revision: 0, reviewer: '', confirmedAt: '', documents, decisions: {},
      history: documents.map(document => ({at, by: user.username, action: '시연 문서 등록', label: document.name,
        value: orderKinds[document.kind], method: document.method})),
    };
  }

  async function handle(path, options, user) {
    const [, , id, action] = path.split('/');
    const method = options.method || 'GET';
    if (method !== 'GET' && !user.canReviewOrders) throw new OrderError('조회 체험 중입니다. 관리 체험으로 전환하세요.', 403);

    if (!id && method === 'POST') {
      const {scenario} = JSON.parse(options.body || '{}');
      const order = await create(scenario, user);
      save([order, ...read()]);
      return json(201, presentOrder(order));
    }

    const orders = read();
    if (!id && method === 'GET') {
      const entries = orders.map(order => orderSummary(order, user.username)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return json(200, {orders: entries, canWrite: user.canReviewOrders});
    }
    const order = orders.find(entry => entry.id === id);
    if (!order) throw new OrderError('수주 건을 찾을 수 없습니다.', 404);
    if (!action && method === 'GET') return json(200, presentOrder(order));
    if (action === 'review' && method === 'POST') {
      const data = JSON.parse(options.body || '{}');
      if (order.confirmedAt || data.revision !== order.revision) {
        throw new OrderError('수주 건이 변경되었거나 확정되었습니다. 목록에서 다시 열어 주세요.', 409);
      }
      if (reviewOrder(order, data, user.username)) save(orders);
      return json(200, presentOrder(order));
    }
    if (action === 'export' && method === 'GET') {
      const filename = `${order.number}-${order.confirmedAt ? '시연-확정본' : '시연-검토중-초안'}.xlsx`;
      return new Response(orderWorkbook(presentOrder(order)), {headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      }});
    }
    throw new OrderError('지원하지 않는 시연 요청입니다.', 404);
  }

  return {
    request(path, options, user) {
      const result = queue.then(() => handle(path, options, user))
        .catch(error => json(error.status ?? 400, {error: error.message}));
      queue = result.then(() => {});
      return result;
    },
    reset() {
      const result = queue.then(() => storage.removeItem(key));
      queue = result.catch(() => {});
      return result;
    },
  };
}
