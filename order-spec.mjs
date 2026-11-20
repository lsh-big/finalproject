export const fields = [
  ['purchaseNumber', '발주번호', '', ['발주 번호', 'Purchase Order', 'PO No.', 'PO#']],
  ['project', '프로젝트명', '', ['프로젝트 명', '현장명', 'Project', 'Project Name']],
  ['quantity', '수량', '대', ['발주 수량', 'Quantity', 'Qty']],
  ['dueDate', '요청 납기', '', ['요청납기', '납기', '납기일', 'Delivery Date', 'Requested Delivery']],
  ['floors', '층수', '층', ['층 수', '건물 층수', '총 층수', '층수(층)', 'Floors', 'Number of Floors']],
  ['stopCount', '정차층 수', '층', ['정차층수', '정차층 수(층)', '정차 층수', '정차 수', '정차수', 'Number of Stops', 'Stop Count']],
  ['stopLabels', '정차층 표기 목록', '', ['정차층 표기', '정차층 목록', '정차층', 'Stop Labels']],
  ['load', '정격하중', 'kg', ['정격 하중', '정격하중(kg)', 'Rated Load']],
  ['speed', '정격속도', 'm/s', ['정격 속도', '정격속도(m/s)', 'Rated Speed']],
  ['voltage', '전원 전압', 'V', ['전원전압', '전압', '전원 전압(V)', 'Supply Voltage', 'Voltage']],
  ['phase', '상수', '상', ['상 수', '전원 상수', '상수(상)', 'Phase']],
  ['frequency', '주파수', 'Hz', ['주파수(Hz)', 'Frequency']],
  ['motor', '모터 용량', 'kW', ['모터용량', '모터 용량(kW)', 'Motor Power', 'Motor Capacity']],
  ['door', '도어 사양', '', ['도어사양', '도어', 'Door Specification']],
  ['options', '고객 요청 옵션', '', ['요청 옵션', '고객 옵션', 'Customer Options']],
].map(([key, label, unit, aliases]) => ({key, label, unit, aliases: [label, ...aliases]}));

const clean = value => String(value ?? '').normalize('NFKC').trim().toLowerCase();
const labelKey = value => clean(value).replace(/\s+/g, ' ').replace(/\s*\(\s*(.*?)\s*\)/g, '($1)');
const aliases = new Map(fields.flatMap(field => field.aliases.map(label => [labelKey(label), field])));
const scalar = {
  quantity: {'': 1, 대: 1, 개: 1, ea: 1, units: 1},
  floors: {'': 1, 층: 1, floors: 1},
  stopCount: {'': 1, 층: 1, 개층: 1, 개: 1, stops: 1},
  load: {'': 1, kg: 1, t: 1000},
  speed: {'': 1, 'm/s': 1, mps: 1, 'm/min': [1, 60]},
  voltage: {'': 1, v: 1, kv: 1000},
  phase: {'': 1, 상: 1, ph: 1, phase: 1, φ: 1},
  frequency: {'': 1, hz: 1, khz: 1000},
  motor: {'': 1, kw: 1, w: [1, 1000]},
};
const emptyMark = /^(?:[-—–?]+|미정|미기재|확인\s*필요|별도\s*협의|추후\s*확정|tbd|n\/?a)$/i;

function scalarValue(text, units, whole) {
  const match = text.match(/^((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*([a-z가-힣φ\s/]*)$/);
  if (!match) return null;
  const unit = match[2].replace(/\s/g, '');
  if (!Object.hasOwn(units, unit) || match[1].length > 30) return null;
  const [factor, divisor] = Array.isArray(units[unit]) ? units[unit] : [units[unit], 1];
  const [integer, decimal = ''] = match[1].replaceAll(',', '').split('.');
  const numerator = BigInt(integer + decimal) * BigInt(factor);
  const denominator = 10n ** BigInt(decimal.length) * BigInt(divisor);
  if (!numerator || (whole && numerator % denominator !== 0n)) return null;
  let left = numerator, right = denominator;
  while (right) [left, right] = [right, left % right];
  return `${numerator / left}/${denominator / left}`;
}

export function normalize(key, value) {
  const text = clean(value);
  if (!text || emptyMark.test(text) || /^[=]/.test(text)) return null;
  if (key === 'dueDate') {
    const match = text.match(/^(\d{4})\s*(?:[.\/-]|년)\s*(\d{1,2})\s*(?:[.\/-]|월)\s*(\d{1,2})\s*[일.]?$/);
    if (!match) return null;
    const date = [match[1], match[2].padStart(2, '0'), match[3].padStart(2, '0')].join('-');
    const parsed = new Date(date);
    return Number.isFinite(+parsed) && parsed.toISOString().startsWith(date) ? date : null;
  }
  if (key === 'stopLabels') {
    const labels = text.replace(/\s*층/g, 'f').split(/[,;/·\s]+/).filter(Boolean).map(label =>
      label.replace(/^지하(\d+)f?$/, 'b$1').replace(/^(\d+)f$/, '$1').replace(/^(b\d+)f$/, '$1'));
    return labels.length && labels.every(label => /^(?:\d+|[a-z]\d*|\d+[a-z])$/.test(label))
      ? JSON.stringify([...new Set(labels)].sort()) : null;
  }
  if (Object.hasOwn(scalar, key)) {
    return scalarValue(text, scalar[key], ['quantity', 'floors', 'stopCount', 'phase'].includes(key));
  }
  return text.replace(/\s+/g, ' ');
}

export function sourceLocation(location) {
  return location.page ? `${location.page}쪽` : `${location.sheet}!${location.cell}`;
}

function extractRule(fragment, nextLine) {
  const match = fragment.text.match(/^(.+?)\s*[:：=]\s*(.*)$/);
  const field = aliases.get(labelKey(match?.[2] === '' ? match[1] : fragment.text));
  if (field && fragment.next != null && !aliases.has(labelKey(fragment.next))) {
    return {field, value: fragment.next, location: {...fragment, cell: fragment.nextCell},
      text: `${fragment.cell} ${fragment.text}\n${fragment.nextCell} ${fragment.next}`,
      uncertain: fragment.uncertain || fragment.nextUncertain};
  }
  if (field && fragment.page && nextLine?.page === fragment.page &&
      normalize(field.key, nextLine.text) !== null &&
      !aliases.has(labelKey(nextLine.text)) && !/[:：=]/.test(nextLine.text) && !extractRule(nextLine)) {
    return {field, value: nextLine.text, location: fragment,
      text: `${fragment.text}\n${nextLine.text}`, uncertain: true};
  }
  const colonField = match && aliases.get(labelKey(match[1]));
  if (colonField && match[2].trim()) {
    return {field: colonField, value: match[2], location: fragment, text: fragment.text, uncertain: fragment.uncertain};
  }
  if (fragment.page && !field) {
    const separators = [...fragment.text.matchAll(/\s+/g)].reverse();
    for (const {index, 0: spaces} of separators) {
      const prefix = aliases.get(labelKey(fragment.text.slice(0, index)));
      if (prefix) return {field: prefix, value: fragment.text.slice(index + spaces.length),
        location: fragment, text: fragment.text, uncertain: fragment.uncertain};
    }
  }
  return null;
}

function candidate(field, value, text, location, uncertain, method) {
  const {page, sheet, cell} = location;
  const normalized = normalize(field.key, value);
  return {key: field.key, value, text, page, sheet, cell, method, normalized,
    needsReview: Boolean(uncertain) || normalized === null};
}

export function localCandidates(fragments) {
  return fragments.flatMap((fragment, index) => {
    const match = extractRule(fragment, fragments[index + 1]);
    return match ? [candidate(match.field, match.value, match.text, match.location, match.uncertain, '로컬 규칙')] : [];
  });
}

export function groundedCandidates(suggestions, fragments) {
  if (!Array.isArray(suggestions)) return [];
  return suggestions.flatMap(proposal => {
    const {key, index, value, quote} = proposal ?? {};
    const field = fields.find(item => item.key === key);
    const fragment = Number.isInteger(index) ? fragments[index] : null;
    if (!field || !fragment || typeof value !== 'string' || !value.trim() ||
        typeof quote !== 'string' || !quote.includes(value)) return [];
    const rule = extractRule(fragment, fragments[index + 1]);
    if (rule && (rule.field.key !== key || rule.value !== value)) return [];
    if (fragment.nextCell && fragment.next?.includes(value) &&
        `${fragment.text}\n${fragment.next}`.includes(quote)) {
      return [candidate(field, value, `${fragment.cell} ${fragment.text}\n${fragment.nextCell} ${fragment.next}`,
        {...fragment, cell: fragment.nextCell}, !rule || fragment.uncertain || fragment.nextUncertain, '외부 AI')];
    }
    if (!fragment.text.includes(quote)) return [];
    // Unknown layouts can be suggested by AI but always require reviewer validation.
    return [candidate(field, value, fragment.text, fragment, fragment.uncertain || !rule, '외부 AI')];
  });
}

export function compare(order) {
  const unread = order.documents.some(document => document.warnings.length);
  return fields.map(({key, label, unit}) => {
    const candidates = order.documents.flatMap(document => document.candidates.filter(item => item.key === key)
      .map(item => ({...item, id: `${document.id}:${item.index}`, document: document.id,
        source: `${document.name} · ${sourceLocation(item)}`})));
    const distinct = new Set(candidates.map(item => item.normalized).filter(value => value !== null));
    let status = '일치';
    if (distinct.size > 1) status = '불일치';
    else if (candidates.some(item => item.needsReview) || (!candidates.length && unread)) status = '확인 필요';
    else if (!candidates.length) status = '누락';
    else if (new Set(candidates.map(item => item.document)).size === 1) status = '단일 출처';
    return {key, label, unit, candidates, status, decision: order.decisions[key] ?? null};
  });
}
