import { IS_DEMO } from './client.js';
import { documentTypes, documentUrl, documentVersions, findDocumentProducts } from './document-domain.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
let query = '';

function fileLinks(record) {
  return `<ul class="document-links">${documentTypes.map(([key, label]) => {
    const document = record.documents[key];
    let url = '';
    try {
      url = documentUrl(document?.url, label);
    } catch {
      // Show an unavailable link if a previously saved value is invalid.
    }
    return `<li><span>${label}</span>${url
      ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer" aria-label="${label} 원본 열기 (${escape(record.revision)})">원본 열기</a>`
      : '<span class="document-missing">미등록</span>'}</li>`;
  }).join('')}</ul>`;
}

function linksInput(types) {
  return types.map(([key, label]) => `<label>${label} 링크<input type="url" name="${key}" maxlength="2000"
    placeholder="https://…" ${key === 'drawing' ? 'required' : ''}></label>`).join('');
}

function approvalForm(ctx) {
  if (ctx.user.role !== 'admin' || !ctx.data.products.length) return '';
  return `<dialog id="document-approval-dialog" aria-labelledby="document-approval-title">
    <form id="document-approval-form">
      <div class="dialog-head"><h2 id="document-approval-title">승인본 등록</h2><button type="button" class="quiet" id="document-approval-close" aria-label="닫기">✕</button></div>
      <div class="form-grid">
        <label class="wide">제품<select name="productId" required>${ctx.data.products.map(product =>
          `<option value="${escape(product.id)}">${escape(product.serial)} · ${escape(product.model)}${product.orderNumber ? ' · ' + escape(product.orderNumber) : ''}</option>`).join('')}</select></label>
        <p class="wide document-metadata" id="document-previous-approval"></p>
        <label>도면 개정번호<input name="revision" maxlength="80" required></label>
        <label>승인일<input type="date" name="approvedOn" value="${escape(ctx.today)}" max="${escape(ctx.today)}" required></label>
        <div class="wide document-link-fields">${linksInput(documentTypes)}</div>
        <label class="wide">변경 내용<textarea name="changeNote" rows="3" maxlength="2000" required></textarea></label>
      </div>
      <p class="helper">승인이 끝난 문서의 원본 링크를 등록하세요. BOM과 검사성적서는 발행 후 같은 개정에 추가할 수 있습니다.</p>
      <p class="ops-error" role="alert"></p>
      <div class="dialog-actions"><button class="primary">현재 승인본으로 등록</button></div>
    </form>
  </dialog>`;
}

function attachmentForm(product, current) {
  const missing = documentTypes.slice(1).filter(([key]) => !current.documents[key]);
  if (!missing.length) return '';
  return `<details class="document-attachment">
    <summary>미등록 문서 추가</summary>
    <form class="document-attachment-form" data-product="${escape(product.id)}" data-current="${escape(current.id)}">
      <div class="document-link-fields">${linksInput(missing)}</div>
      <p class="ops-error" role="alert"></p>
      <button class="quiet">현재 승인본에 추가</button>
    </form>
  </details>`;
}

function approvalDetails(record) {
  return `<p class="document-metadata">승인일 ${escape(record.approvedOn)} · 등록자 ${escape(record.registeredBy)}</p>
    <p class="document-change">${escape(record.changeNote)}</p>${fileLinks(record)}`;
}

function searchResults(ctx) {
  if (!query) return '<p class="panel empty">수주번호 또는 제조번호를 입력하세요.</p>';
  const matches = findDocumentProducts(ctx.data.products, query);
  if (!matches.length) return '<p class="panel empty">일치하는 제품이 없습니다. 수주번호 또는 제조번호를 확인하세요.</p>';
  return matches.map(product => {
    const [current, ...history] = documentVersions(ctx.data, product.id);
    return `<section class="panel document-product">
      <div class="panel-heading"><div><h2>${escape(product.serial)} · ${escape(product.model)}</h2>
        <p>수주번호 ${escape(product.orderNumber || '미등록')}</p></div></div>
      <div class="document-product-body">
        ${current ? `<div class="document-current"><h3>현재 승인본 <strong>${escape(current.revision)}</strong></h3>
          ${approvalDetails(current)}
          ${ctx.user.role === 'admin' ? attachmentForm(product, current) : ''}
        </div>` : '<p class="document-missing">등록된 승인본이 없습니다.</p>'}
        ${history.length ? `<details class="document-history"><summary>이전 승인본 · ${history.length}건</summary>
          ${history.map(record => `<article><h3>${escape(record.revision)}</h3>${approvalDetails(record)}</article>`).join('')}
        </details>` : ''}
      </div>
    </section>`;
  }).join('');
}

export function renderDocuments(ctx) {
  return `<div class="document-workspace">
    ${IS_DEMO ? '<p class="ops-note">시연에서는 가상 번호와 예시 링크를 사용하세요.</p>' : ''}
    <div class="panel document-toolbar">
      <form id="document-search" role="search">
        <label for="document-query">수주번호 또는 제조번호</label>
        <div><input id="document-query" name="query" type="search" maxlength="2000" required
          value="${escape(query)}" placeholder="번호를 정확히 입력하세요"><button class="primary">조회</button></div>
      </form>
      ${ctx.user.role === 'admin' && ctx.data.products.length ? '<div class="document-toolbar-actions"><button type="button" class="quiet" id="document-approval-open">승인본 등록</button><button type="button" class="text-link" data-go="products">제품·수주번호 관리</button></div>' : ''}
    </div>
    <div id="document-results" aria-live="polite">${searchResults(ctx)}</div>
    ${approvalForm(ctx)}
  </div>`;
}

export function bindDocuments(root, ctx) {
  const search = root.querySelector('#document-search');
  const output = root.querySelector('#document-results');
  const dialog = root.querySelector('#document-approval-dialog');
  const approval = root.querySelector('#document-approval-form');
  let saving = false;

  search.addEventListener('submit', event => {
    event.preventDefault();
    query = search.elements.query.value.trim();
    output.innerHTML = searchResults(ctx);
  });

  async function save(form, action, values, product) {
    if (saving) return;
    const previousQuery = query;
    const error = form.querySelector('.ops-error');
    const submit = form.querySelector('button:not([type=button])');
    saving = true;
    submit.disabled = true;
    error.textContent = '';
    try {
      if (product) query = product.serial;
      await ctx.mutate({ ...values, action });
      ctx.toast('승인 문서를 저장했습니다.');
    } catch (failure) {
      query = previousQuery;
      error.textContent = failure.message;
    } finally {
      saving = false;
      submit.disabled = false;
    }
  }

  output.addEventListener('submit', event => {
    const form = event.target.closest('.document-attachment-form');
    if (!form) return;
    event.preventDefault();
    save(form, 'attach-documents', {
      ...Object.fromEntries(new FormData(form)),
      productId: form.dataset.product,
      currentId: form.dataset.current
    });
  });

  if (!dialog) return;
  const updatePrevious = () => {
    const [current] = documentVersions(ctx.data, approval.elements.productId.value);
    root.querySelector('#document-previous-approval').textContent =
      current ? '현재 승인본 ' + current.revision + ' · ' + current.approvedOn : '현재 승인본 미등록';
  };
  approval.elements.productId.onchange = updatePrevious;
  root.querySelector('#document-approval-open').onclick = () => {
    const matches = findDocumentProducts(ctx.data.products, query);
    if (matches.length === 1) approval.elements.productId.value = matches[0].id;
    updatePrevious();
    dialog.showModal();
  };
  root.querySelector('#document-approval-close').onclick = () => dialog.close();
  approval.addEventListener('submit', event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(approval));
    const product = ctx.data.products.find(item => item.id === values.productId);
    const [current] = documentVersions(ctx.data, values.productId);
    save(approval, 'approve-documents', { ...values, currentId: current?.id ?? '' }, product);
  });
}
