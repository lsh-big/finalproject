export const documentTypes = [
  ['drawing', '승인 도면'],
  ['bom', 'BOM'],
  ['certificate', '검사성적서']
];

export const documentActions = ['approve-documents', 'attach-documents'];
const approvalDateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });
const normalizeKey = value => String(value ?? '').trim().toUpperCase();

export function findDocumentProducts(products, query) {
  const key = normalizeKey(query);
  return key ? products.filter(product =>
    [product.serial, product.orderNumber].some(number => normalizeKey(number) === key)) : [];
}

export function documentVersions(data, productId) {
  return data.documentPackages.filter(record => record.productId === productId);
}

export function documentUrl(value, label) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || value.length > 2000) throw Error(label + ' 링크를 확인하세요.');
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw Error(label + ' 링크를 확인하세요.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw Error(label + '에는 로그인 정보가 없는 HTTP 또는 HTTPS 링크를 입력하세요.');
  }
  return url.href;
}

export function applyDocumentAction(data, input, user) {
  if (!data.products.some(product => product.id === input.productId)) throw Error('연결할 제품을 선택하세요.');
  const versions = documentVersions(data, input.productId);
  const current = versions[0];
  const now = new Date();
  const registeredAt = now.toISOString();
  if ((input.currentId || '') !== (current?.id ?? '')) {
    throw Error('현재 승인본이 변경되었습니다. 새로고침 후 다시 확인하세요.');
  }

  if (input.action === 'attach-documents') {
    if (!current) throw Error('먼저 승인 도면을 등록하세요.');
    const attachments = {};
    for (const [key, label] of documentTypes.slice(1)) {
      const url = documentUrl(input[key], label);
      if (!url) continue;
      if (current.documents[key]) throw Error(label + '는 이미 등록되어 있습니다. 새 승인본으로 변경을 기록하세요.');
      attachments[key] = { url, registeredAt, registeredBy: user.username };
    }
    if (!Object.keys(attachments).length) throw Error('추가할 BOM 또는 검사성적서 링크를 입력하세요.');
    Object.assign(current.documents, attachments);
    return;
  }

  const revision = typeof input.revision === 'string' ? input.revision.trim() : '';
  const changeNote = typeof input.changeNote === 'string' ? input.changeNote.trim() : '';
  const approvedOn = input.approvedOn;
  if (!revision || revision.length > 80) throw Error('도면 개정번호를 1~80자로 입력하세요.');
  if (!changeNote || changeNote.length > 2000) throw Error('변경 내용을 1~2000자로 입력하세요.');
  if (versions.some(record => normalizeKey(record.revision) === normalizeKey(revision))) throw Error('이미 등록된 도면 개정번호입니다.');
  const date = new Date(typeof approvedOn === 'string' ? approvedOn : '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(approvedOn) || !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== approvedOn || approvedOn > approvalDateFormat.format(now)) {
    throw Error('오늘 이전 또는 오늘의 유효한 승인일을 입력하세요.');
  }
  if (current && approvedOn < current.approvedOn) throw Error('현재 승인본보다 이전 승인일을 등록할 수 없습니다.');

  const documents = {};
  for (const [key, label] of documentTypes) {
    const url = documentUrl(input[key], label);
    if (url) documents[key] = { url, registeredAt, registeredBy: user.username };
  }
  if (!documents.drawing) throw Error('승인 도면 링크를 입력하세요.');
  data.documentPackages.unshift({
    id: globalThis.crypto.randomUUID(),
    productId: input.productId,
    revision,
    approvedOn,
    changeNote,
    documents,
    registeredAt,
    registeredBy: user.username
  });
}
