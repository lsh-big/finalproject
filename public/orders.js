import {apiFetch} from './client.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[character]);
const screen = $('#order-screen');
const apiRoot = './api/orders';
const kinds = {po: '발주서', tech: '기술 사양서'};
const demos = {
  normal: ['정상', '두 문서의 사양이 일치합니다.'],
  conflict: ['불일치', '층수 15층과 16층을 비교합니다.'],
  missing: ['누락', '두 문서에 모터 용량이 비어 있습니다.'],
};
const statuses = {'일치': 'good', '확정': 'good', '불일치': 'conflict', '확인 필요': 'warning', '누락': 'missing'};
const issue = row => ['불일치', '누락', '확인 필요'].includes(row.status);
const badge = status => `<span class="order-badge ${statuses[status] ?? ''}">${esc(status)}</span>`;
const time = value => value ? `${value.slice(0, 10)} ${value.slice(11, 19)} KST` : '—';
const locationLabel = item => item.page ? `${item.page}쪽` : `${item.sheet}!${item.cell}`;
const idPath = order => `/${order.id}`;
const desktopSource = matchMedia('(min-width: 1150px)');
const sourceDialog = $('#order-source');
let user;
let filter = 'all';
let renderVersion = 0;
let toastTimer;
let sourceKey = '';
let updateSourceView = null;

async function request(path = '', body) {
  const response = await apiFetch(apiRoot + path, body ? {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
  } : {});
  if (response.status === 401) location.replace('./login.html');
  const result = await response.json();
  if (!response.ok) throw Error(result.error || '요청을 처리하지 못했습니다.');
  return result;
}

function errorMessage(message = '') {
  $('#order-error').hidden = !message;
  $('#order-error').textContent = message;
}

function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3500);
}

function heading(title, description, actions = '') {
  return `<div class="page-top"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>
    <div class="order-actions">${actions}</div></div>`;
}

function summary(title, text, stats) {
  return `<section class="order-summary"><div><h2>${title}</h2><p>${text}</p></div>
    ${stats.map(([label, count]) => `<article><b>${count}</b><span>${label}</span></article>`).join('')}</section>`;
}

function table(headers, rows, styling = '', id = '') {
  const review = styling === 'order-review';
  return `<div class="table-wrap ${review ? 'order-review-wrap' : ''}" tabindex="0" aria-label="${esc(review ? '문서별 사양 비교표' : headers[0])}">
    <table class="${styling}" ${review ? 'role="table"' : ''}><thead ${review ? 'role="rowgroup"' : ''}>
    <tr ${review ? 'role="row"' : ''}>${headers.map(label => `<th scope="col" ${review ? 'role="columnheader"' : ''}>${label}</th>`).join('')}</tr></thead>
    <tbody ${review ? 'role="rowgroup"' : ''} ${id ? `id="${id}"` : ''}>${rows}</tbody></table></div>`;
}

function renderList(orders, mine) {
  const totalPending = orders.filter(order => order.status === '검토 중').length;
  const records = mine ? orders.filter(order => order.mine && order.status === '검토 중') : orders;
  const scopeLink = mine ? '<a class="quiet" href="#list">전체 수주 보기</a>' :
    '<a class="quiet" href="#mine">내 검토 대기</a>';
  screen.innerHTML = heading(mine ? '내 수주 검토 대기' : '수주 목록',
    mine ? '내가 담당하는 검토 중 수주를 확인합니다.' : '승강기 제어반 발주서와 기술 사양서를 검토하고 수주 사양표를 내려받습니다.',
    user.canReviewOrders ? scopeLink + '<a class="primary" href="#new">새 수주 등록</a>' : '') +
    (mine ? '' : summary('제어반 수주 현황', '진행 중인 검토와 확정된 수주를 확인하세요.',
      [['전체 수주', orders.length], ['검토 중', totalPending], ['확정', orders.length - totalPending]])) +
    `<section class="panel">
      <div class="order-list-tools">
        <input type="search" id="order-search" aria-label="수주 검색" placeholder="수주명, 고객사, 수주번호 검색">
        <select id="order-status" aria-label="진행 상태 필터" ${mine ? 'hidden' : ''}><option value="">전체 상태</option><option>검토 중</option><option>확정</option></select>
      </div>
      ${table(['수주번호', '수주명', '고객사', '문서', '미해결', '진행 상태', '최근 변경'], '', 'order-list', 'order-list-rows')}
      <p id="order-list-empty" class="order-empty" hidden></p>
    </section>`;
  function showRows() {
    const query = $('#order-search').value.trim().toLowerCase();
    const status = $('#order-status').value;
    const visible = records.filter(order => (!status || status === order.status) &&
      [order.name, order.customer, order.number].some(value => value.toLowerCase().includes(query)));
    $('#order-list-rows').innerHTML = visible.map(order => `<tr>
      <td>${esc(order.number)}</td><td><a href="#order/${order.id}">${esc(order.name)}</a></td>
      <td>${esc(order.customer)}</td><td>${order.documents}개</td><td>${order.pending}개</td>
      <td>${badge(order.status)}</td><td>${time(order.updatedAt)}</td></tr>`).join('');
    $('#order-list-empty').hidden = visible.length > 0;
    $('#order-list-empty').textContent = records.length ? '검색 조건에 맞는 수주가 없습니다.' :
      mine ? '검토를 기다리는 내 수주가 없습니다.' : '등록된 수주가 없습니다. 새 수주 등록에서 시연용 문서를 불러올 수 있습니다.';
  }
  $('#order-search').oninput = showRows;
  $('#order-status').onchange = showRows;
  showRows();
}

function uploadFields() {
  return `<div class="order-form-grid">
    ${Object.entries(kinds).map(([key, label]) => `<div class="order-sample">
      <label class="order-input" for="files-${key}">${label}
        <input type="file" id="files-${key}" accept=".pdf,.xlsx" multiple></label>
      <ul class="order-staged" id="staged-${key}"></ul></div>`).join('')}
    </div>
    <p class="order-muted">PDF·XLSX · 파일당 8 MB · 한 번에 최대 8개, 총 32 MB</p>
    <label class="order-check"><input type="checkbox" name="allowAI"> 외부 AI 전송 허용 · 문서에서 읽은 텍스트와 셀 내용을 OpenAI에 전송하여 후보값을 추가로 찾습니다.</label>`;
}

function renderNew() {
  screen.innerHTML = heading('새 수주 등록', '수주명과 고객사를 입력하고, 문서 유형별로 원본 파일을 등록하세요.') +
    `<section class="panel order-card"><h2>시연용 문서 양식</h2>
      <p class="order-muted">가상 고객사 호라이즌리프트의 PDF 발주서와 XLSX 기술 사양서입니다. 두 파일을 등록 양식에 담아 확인할 수 있습니다.</p>
      <div class="order-demos">${Object.entries(demos).map(([key, [label, text]]) => `
        <article class="order-sample"><h3>${label} 사례</h3><p class="order-muted">${text}</p>
          <div class="order-actions"><a href="${apiRoot}/demo/${key}/po">발주서 PDF</a><a href="${apiRoot}/demo/${key}/tech">사양서 XLSX</a></div>
          <button type="button" class="quiet" data-sample="${key}" style="margin-top:10px">문서 불러오기</button>
        </article>`).join('')}</div>
      <details class="order-details order-demo-preview"><summary>시연용 발주서 양식 미리보기</summary>
        <img loading="lazy" src="${apiRoot}/demo/normal/po/1" alt="호라이즌리프트 시연용 발주서 PDF 1쪽">
      </details></section>
    <section class="panel order-card"><h2>수주 정보</h2>
      <form id="order-upload-form">
        <div class="order-form-grid order-upload">
          <label class="order-input">수주명<input name="name" maxlength="120" required placeholder="예시 · 호라이즌 센터 제어반"></label>
          <label class="order-input">고객사<input name="customer" maxlength="120" required placeholder="예시 · 호라이즌리프트"></label>
        </div>
        <div class="order-upload">${uploadFields()}</div>
        <button class="primary" type="submit">문서 등록 및 추출</button>
      </form>
    </section>`;
  bindUpload($('#order-upload-form'));
}

function fileBytes(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(Error('선택한 파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

function bindUpload(form, order) {
  const staged = {po: [], tech: []};
  let busy = false;
  function showFiles() {
    for (const kind of Object.keys(staged)) {
      form.querySelector(`#staged-${kind}`).innerHTML = staged[kind].map((file, index) => `<li>
        <span>${esc(file.name)}</span><button type="button" class="order-link" data-remove="${kind}:${index}" aria-label="${esc(file.name)} 제거">제거</button>
      </li>`).join('');
    }
  }
  for (const kind of Object.keys(staged)) {
    form.querySelector(`#files-${kind}`).onchange = event => {
      staged[kind].push(...event.target.files);
      event.target.value = '';
      showFiles();
    };
  }
  form.addEventListener('click', event => {
    const selection = event.target.dataset.remove;
    if (!selection || busy) return;
    const [kind, index] = selection.split(':');
    staged[kind].splice(Number(index), 1);
    showFiles();
  });
  for (const button of screen.querySelectorAll('[data-sample]')) {
    button.onclick = async () => {
      if (busy) return;
      busy = true;
      button.disabled = true;
      errorMessage();
      const key = button.dataset.sample;
      const label = demos[key][0];
      try {
        const samples = await Promise.all(Object.entries(kinds).map(async ([kind, title]) => {
          const response = await apiFetch(`${apiRoot}/demo/${key}/${kind}`);
          if (!response.ok) throw Error('시연 파일을 불러올 수 없습니다. 문서 처리기 설치를 확인하세요.');
          const blob = await response.blob();
          const extension = kind === 'po' ? 'pdf' : 'xlsx';
          return [kind, new File([blob], `시연-${label}-${title}.${extension}`, {type: blob.type})];
        }));
        for (const [kind, file] of samples) staged[kind].push(file);
        form.elements.name.value ||= `호라이즌 센터 제어반 · ${label} 시연`;
        form.elements.customer.value ||= '호라이즌리프트 (가상)';
        form.elements.allowAI.checked = false;
        showFiles();
        notify('시연 문서를 등록 양식에 담았습니다.');
      } catch (error) {
        errorMessage(error.message);
      } finally {
        busy = false;
        button.disabled = false;
      }
    };
  }
  form.onsubmit = async event => {
    event.preventDefault();
    if (busy) return;
    errorMessage();
    const files = Object.entries(staged).flatMap(([kind, entries]) => entries.map(file => ({kind, file})));
    if (!files.length || files.length > 8 || files.some(({file}) => file.size > 8 * 1024 * 1024) ||
        files.reduce((total, {file}) => total + file.size, 0) > 32 * 1024 * 1024) {
      errorMessage('파일 수와 용량을 확인하세요. PDF 또는 XLSX 문서가 한 개 이상 필요합니다.');
      return;
    }
    const body = {allowAI: form.elements.allowAI.checked};
    if (order) body.revision = order.revision;
    else Object.assign(body, {name: form.elements.name.value, customer: form.elements.customer.value});
    const submit = form.querySelector('[type=submit]');
    const before = submit.textContent;
    busy = true;
    const controls = [...form.querySelectorAll('input, button')];
    controls.forEach(control => { control.disabled = true; });
    submit.textContent = '문서 읽는 중…';
    try {
      body.files = await Promise.all(files.map(async ({kind, file}) => ({kind, name: file.name, bytes: await fileBytes(file)})));
      const result = await request(order ? `${idPath(order)}/documents` : '', body);
      notify('문서를 등록하고 사양 후보를 추출했습니다.');
      if (!form.isConnected) return;
      if (order) renderOrder(result);
      else location.hash = `order/${result.id}`;
    } catch (error) {
      if (form.isConnected) errorMessage(error.message);
    } finally {
      busy = false;
      controls.forEach(control => { control.disabled = false; });
      submit.textContent = before;
    }
  };
}

function reviewCell(row, writable) {
  const current = row.decision;
  if (!writable) return current ? `<b>${esc(current.value)}</b>
    <p class="order-meta">${esc(current.source)}${current.reason ? ` · ${esc(current.reason)}` : ''}</p>` : '—';
  return `<select data-choice aria-label="${esc(row.label)} 확정값">
      <option value="">미선택</option>
      ${row.candidates.map(item => `<option value="${item.id}" ${current?.candidate === item.id ? 'selected' : ''}>
        ${esc(item.value)} · ${esc(item.source)}</option>`).join('')}
      <option value="manual" ${current && !current.candidate ? 'selected' : ''}>직접 입력 / 수정</option>
    </select>
    <input data-value type="text" maxlength="1000" aria-label="${esc(row.label)} 직접 입력" placeholder="값${row.unit ? ` (${esc(row.unit)})` : ''}"
      value="${esc(current && !current.candidate ? current.value : '')}" ${current && !current.candidate ? '' : 'hidden'}>
    <input data-reason type="text" maxlength="1000" aria-label="${esc(row.label)} 검토 사유" placeholder="검토 사유" value="${esc(current?.reason)}" ${current ? '' : 'hidden'}>
    <small class="reviewed ${current ? '' : 'pending'}">${current ? '검토 완료' : '미해결'}</small>`;
}

function renderOrder(order) {
  const writable = user.canReviewOrders && order.status !== '확정';
  const warningCount = order.documents.reduce((sum, entry) => sum + entry.warnings.length, 0);
  const pending = order.rows.filter(row => !row.decision).length;
  const exportName = order.confirmedAt ? '확정본 XLSX 다운로드' : '검토 중 초안 XLSX 다운로드';
  const docUrl = document => `${apiRoot}${idPath(order)}/documents/${document.id}`;
  const sources = new Map();
  const docs = order.documents.map(document => `<article class="order-doc"><h3>${esc(kinds[document.kind])}</h3>
    <a href="${docUrl(document)}">${esc(document.name)}</a><p class="order-meta">${esc(document.method)}</p>
    ${document.warnings.length ? `<ul>${document.warnings.map((warning, index) => {
      const key = `warn-${document.id}-${index}`;
      sources.set(key, {...warning.location, document: document.id, text: warning.message, source: warning.source});
      return `<li><button class="order-link" type="button" data-source="${key}">${esc(locationLabel(warning.location))}</button> · ${esc(warning.message)}</li>`;
    }).join('')}</ul>` : ''}</article>`).join('');
  const rows = order.rows.map(row => {
    const group = new Map();
    for (const item of row.candidates) {
      if (!group.has(item.document)) group.set(item.document, []);
      group.get(item.document).push(item);
      sources.set(item.id, item);
    }
    const cells = order.documents.filter(doc => group.has(doc.id)).map(doc => `<div class="order-candidate">
      <p>${esc(doc.name)}</p>${group.get(doc.id).map(item => `<button class="order-link" type="button" data-source="${item.id}"
          title="${esc(item.source)}">${esc(item.value)} · ${esc(locationLabel(item))}</button>
          ${item.needsReview ? '<small>근거 확인 필요</small>' : ''}`).join('')}</div>`).join('');
    return `<tr role="row" data-field="${row.key}">
      <th scope="row" class="order-field-name" role="rowheader"><strong>${esc(row.label)}</strong>${row.unit ? `<small class="order-unit">${esc(row.unit)}</small>` : ''}</th>
      <td role="cell" class="order-field-candidates">${cells ? `<div class="order-candidates">${cells}</div>` : '<span class="order-meta">추출 후보 없음</span>'}</td>
      <td role="cell" class="order-field-status">${badge(row.status)}</td><td role="cell" class="order-field-value">
        <span class="order-mobile-label" aria-hidden="true">확정값</span>${reviewCell(row, writable)}</td></tr>`;
  }).join('');
  screen.innerHTML = heading(order.name, `${order.number} · ${order.customer}`,
    `${badge(order.status)}<a class="quiet" href="#list">수주 목록</a><a class="primary" href="${apiRoot}${idPath(order)}/export" id="order-export">${exportName}</a>`) +
    summary('수주 사양 검토', order.confirmedAt ? `검토자 ${esc(order.reviewer)} · ${time(order.confirmedAt)}` :
      '원문을 확인하고 항목별 확정값을 지정하세요.',
      [['등록 문서', order.documents.length], ['확인 필요 문서 위치', warningCount], ['미해결 항목', pending]]) +
    `<details class="panel order-card order-details" ${warningCount ? 'open' : ''}>
      <summary>등록 문서 및 추출 방식 · ${order.documents.length}개</summary><div class="order-doc-grid">${docs}</div>
    </details>
    <div class="order-review-layout"><section class="panel order-review-card">
      <form id="review-form">
        <div class="order-table-title">
          <h2>항목별 사양 비교</h2>
          <div class="order-actions"><select id="review-filter" aria-label="사양 상태 필터">
            <option value="all">전체 항목</option><option value="pending">미해결만 보기</option>
            <option value="issues">누락·불일치·확인 필요</option>
            <option value="불일치">불일치</option><option value="누락">누락</option><option value="확인 필요">확인 필요</option>
          </select>${writable ? '<button type="button" class="quiet" id="order-accept-matches">일치 항목 반영</button>' : ''}</div>
        </div>
        ${table(['항목', '문서별 후보값 및 출처', '상태', '확정값'], rows, 'order-review')}
        <p id="review-empty" class="order-empty" hidden>선택한 상태에 해당하는 항목이 없습니다.</p>
        ${writable ? `<div class="order-confirm">
          <p class="order-meta">직접 입력 또는 근거 확인이 필요한 후보를 선택하면 검토 사유를 입력하세요. 초안에는 저장된 검토값이 포함됩니다.</p>
          ${warningCount ? '<label class="order-check"><input type="checkbox" name="readWarnings"> 확인 필요로 표시된 문서 위치의 원본을 검토했습니다.</label>' : ''}
          <label class="order-check"><input type="checkbox" name="confirmed"> 원문과 모든 검토값을 확인했으며 이 사양으로 수주를 확정합니다.</label>
          <div class="order-actions"><button class="quiet" type="submit" value="save">검토값 저장</button>
          <button class="primary" type="submit" value="finalize">담당자 확정</button></div>
        </div>` : ''}
      </form>
    </section>
    <aside id="order-source-panel" class="panel order-source-panel" aria-labelledby="order-source-panel-title" hidden>
      <div class="order-source-head"><h2 id="order-source-panel-title">원문 근거</h2>
        <button class="quiet" type="button" id="order-source-dismiss" aria-label="원문 패널 닫기">닫기</button></div>
      <div class="order-source-body" id="order-source-panel-content"></div>
    </aside></div>
    ${writable ? `<details class="panel order-card order-details order-upload">
      <summary>문서 추가 등록</summary><p class="order-muted">문서를 추가하면 기존 검토값을 이력에 남기고 전체 항목을 다시 검토합니다.</p>
      <form id="order-upload-form">${uploadFields()}<button class="primary" type="submit">추가 문서 등록 및 추출</button></form>
    </details>` : ''}
    <details class="panel order-card order-details order-upload"><summary>검토 이력 · ${order.history.length}건</summary>
      ${table(['시각', '담당자', '작업', '항목 또는 문서', '이전 값', '새 값', '출처 또는 사유'],
        [...order.history].reverse().map(entry => `<tr><td>${time(entry.at)}</td><td>${esc(entry.by)}</td>
          <td>${esc(entry.action)}</td><td>${esc(entry.label)}</td><td>${esc(entry.before)}</td><td>${esc(entry.value)}</td>
          <td>${esc([entry.source, entry.reason].filter(Boolean).join(' · '))}</td></tr>`).join(''))}</details>`;
  $('#order-export').onclick = event => downloadExport(event);
  bindSources(sources, docUrl, order.documents);
  bindReview(order, writable);
  if (writable) bindUpload($('#order-upload-form'), order);
}

function bindSources(sources, docUrl, documents) {
  const panel = $('#order-source-panel');
  const closeButton = $('#order-source-dismiss');
  const buttons = [...screen.querySelectorAll('[data-source]')];
  function closeSource() {
    const trigger = buttons.find(button => button.dataset.source === sourceKey);
    sourceKey = '';
    updateSourceView();
    trigger?.focus({preventScroll: true});
  }
  updateSourceView = (focus = false) => {
    const desktop = desktopSource.matches;
    const item = sources.get(sourceKey);
    for (const button of buttons) {
      button.setAttribute('aria-controls', desktop ? panel.id : sourceDialog.id);
      button.setAttribute('aria-expanded', String(Boolean(item) && button.dataset.source === sourceKey));
    }
    panel.hidden = !item || !desktop;
    if (sourceDialog.open && (desktop || !item)) sourceDialog.close();
    if (!item) return;
    const url = docUrl(documents.find(document => document.id === item.document));
    const target = desktop ? $('#order-source-panel-content') : $('#order-source-content');
    const imageUrl = item.page ? `${url}/${item.page}` : '';
    target.innerHTML = `<p><b>${esc(item.source)}</b></p><pre>${esc(item.text)}</pre>
      <div class="order-actions"><a class="order-button quiet" href="${url}">원본 파일 다운로드</a>
      ${imageUrl ? `<a class="order-link" href="${imageUrl}" target="_blank" rel="noopener">PDF 페이지 크게 보기</a>` : ''}</div>
      ${imageUrl ? `<img src="${imageUrl}" alt="원본 PDF ${item.page}쪽 미리보기">` : ''}`;
    if (!desktop && !sourceDialog.open) sourceDialog.showModal();
    if (desktop && focus) {
      panel.scrollTop = 0;
      if (panel.getBoundingClientRect().top > innerHeight - 100) panel.scrollIntoView({block: 'nearest'});
      closeButton.focus({preventScroll: true});
    }
  };
  closeButton.onclick = closeSource;
  sourceDialog.onclose = () => {
    if (!desktopSource.matches && !sourceDialog.open && sourceKey) closeSource();
  };
  screen.onclick = event => {
    const key = event.target.closest('[data-source]')?.dataset.source;
    if (!key) return;
    if (sourceKey === key) closeSource();
    else {
      sourceKey = key;
      updateSourceView(true);
    }
  };
  panel.onkeydown = event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSource();
    }
  };
  updateSourceView();
}

async function downloadExport(event) {
  event.preventDefault();
  const link = event.currentTarget;
  if (link.getAttribute('aria-busy') === 'true') return;
  link.setAttribute('aria-busy', 'true');
  errorMessage();
  try {
    const response = await fetch(link.href);
    if (response.status === 401) location.replace('./login.html');
    if (!response.ok) throw Error((await response.json()).error || '엑셀 파일을 생성하지 못했습니다.');
    const filename = response.headers.get('Content-Disposition')?.split("UTF-8''")[1];
    const url = URL.createObjectURL(await response.blob());
    const download = document.createElement('a');
    download.href = url;
    download.download = filename ? decodeURIComponent(filename) : '수주-사양표.xlsx';
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (error) {
    errorMessage(error.message);
  } finally {
    link.removeAttribute('aria-busy');
  }
}

function bindReview(order, writable) {
  const form = $('#review-form');
  const rows = new Map([...form.querySelectorAll('[data-field]')].map(element => [element.dataset.field, element]));
  const select = $('#review-filter');
  select.value = filter;
  const applyFilter = () => {
    filter = select.value;
    let shown = 0;
    for (const row of order.rows) {
      const visible = filter === 'all' || (filter === 'pending' && !row.decision) ||
        (filter === 'issues' && issue(row)) || row.status === filter;
      rows.get(row.key).hidden = !visible;
      if (visible) shown++;
    }
    $('#review-empty').hidden = shown > 0;
    $('#review-empty').textContent = filter === 'pending' ? '미해결 항목이 없습니다.' : '선택한 상태에 해당하는 항목이 없습니다.';
  };
  select.onchange = applyFilter;
  applyFilter();
  if (!writable) return;
  const controls = element => ({
    choice: element.querySelector('[data-choice]'),
    value: element.querySelector('[data-value]'),
    reason: element.querySelector('[data-reason]'),
  });
  function update(row, element) {
    const {choice, value, reason} = controls(element);
    if (choice.value === 'manual' && !value.value) value.value = row.decision?.value || '';
    value.hidden = choice.value !== 'manual';
    reason.hidden = !choice.value;
    const selected = row.candidates.find(item => item.id === choice.value);
    reason.placeholder = choice.value === 'manual' || selected?.needsReview ? '검토 사유 (필수)' : '검토 사유 (선택)';
    const hint = element.querySelector('.reviewed');
    hint.textContent = choice.value ? '저장 전' : '미해결';
    hint.classList.add('pending');
  }
  for (const row of order.rows) {
    const element = rows.get(row.key);
    const {choice, value, reason} = controls(element);
    choice.onchange = () => update(row, element);
    value.oninput = reason.oninput = () => {
      element.querySelector('.reviewed').textContent = '저장 전';
      element.querySelector('.reviewed').classList.add('pending');
    };
  }
  $('#order-accept-matches').onclick = () => {
    let count = 0;
    for (const row of order.rows.filter(entry => entry.status === '일치')) {
      const element = rows.get(row.key);
      const {choice} = controls(element);
      if (choice.value) continue;
      choice.value = row.candidates[0].id;
      update(row, element);
      count++;
    }
    notify(count ? `일치 항목 ${count}개를 선택했습니다. 저장하거나 담당자 확정을 누르세요.` : '반영할 일치 항목이 없습니다.');
  };
  form.onsubmit = async event => {
    event.preventDefault();
    errorMessage();
    const decisions = Object.fromEntries(order.rows.map(row => {
      const {choice, value, reason} = controls(rows.get(row.key));
      return [row.key, choice.value ? {candidate: choice.value === 'manual' ? '' : choice.value,
        value: value.value, reason: reason.value} : {clear: true}];
    }));
    const finalize = event.submitter?.value === 'finalize';
    const buttons = [...form.querySelectorAll('button[type=submit]')];
    buttons.forEach(button => { button.disabled = true; });
    try {
      const result = await request(`${idPath(order)}/review`, {
        revision: order.revision, decisions, finalize, confirmed: form.elements.confirmed.checked,
        readWarnings: form.elements.readWarnings?.checked === true,
      });
      if (form.isConnected) renderOrder(result);
      notify(finalize ? '수주를 확정했습니다. 확정본 XLSX를 내려받을 수 있습니다.' : '검토값을 저장했습니다.');
    } catch (error) {
      if (form.isConnected) {
        errorMessage(error.message);
        $('#order-error').scrollIntoView({block: 'nearest'});
      }
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  };
}

async function render() {
  const revision = ++renderVersion;
  const route = location.hash.slice(1) || 'list';
  for (const link of document.querySelectorAll('[data-page]')) {
    if (link.dataset.page === (route === 'new' ? 'new' : 'list')) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  errorMessage();
  sourceKey = '';
  updateSourceView = null;
  if (sourceDialog.open) sourceDialog.close();
  screen.onclick = null;
  screen.innerHTML = '<p>수주 업무를 불러오는 중입니다.</p>';
  filter = 'all';
  try {
    if (route === 'new' && user.canReviewOrders) return renderNew();
    if (/^order\/[0-9a-f-]{36}$/.test(route)) {
      const order = await request(`/${route.slice(6)}`);
      if (revision === renderVersion) renderOrder(order);
    } else {
      const {orders} = await request();
      if (revision === renderVersion) renderList(orders, route === 'mine' && user.canReviewOrders);
    }
  } catch (error) {
    if (revision === renderVersion) {
      screen.innerHTML = '<a class="order-button quiet" href="#list">수주 목록</a>';
      errorMessage(error.message);
    }
  }
}

desktopSource.addEventListener('change', () => updateSourceView?.(Boolean(sourceKey)));

$('#orders-logout').onclick = async () => {
  await apiFetch('./api/logout', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'});
  location.replace('./login.html');
};
const login = await apiFetch('./api/me');
if (login.ok) {
  user = await login.json();
  $('#identity').textContent = `${user.username} · ${user.canReviewOrders ? '수주 검토 담당자' : '조회 사용자'}`;
  $('[data-page="new"]').hidden = !user.canReviewOrders;
  window.addEventListener('hashchange', render);
  await render();
} else {
  location.replace('./login.html');
}
