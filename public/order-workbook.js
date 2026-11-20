const encoder = new TextEncoder();
const crcTable = Uint32Array.from({length: 256}, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value;
});

// XLSX accepts ZIP entries without compression, which keeps the demo dependency-free.
function zipStored(files) {
  const contents = [];
  const index = [];
  let position = 0;
  let indexLength = 0;
  for (const [path, text] of files) {
    const name = encoder.encode(path), bytes = encoder.encode(text);
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
    crc ^= 0xffffffff;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(12, 0x21, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, bytes.length, true);
    local.setUint32(22, bytes.length, true);
    local.setUint16(26, name.length, true);
    contents.push(new Uint8Array(local.buffer), name, bytes);

    const directory = new DataView(new ArrayBuffer(46));
    directory.setUint32(0, 0x02014b50, true);
    directory.setUint16(4, 20, true);
    directory.setUint16(6, 20, true);
    directory.setUint16(14, 0x21, true);
    directory.setUint32(16, crc, true);
    directory.setUint32(20, bytes.length, true);
    directory.setUint32(24, bytes.length, true);
    directory.setUint16(28, name.length, true);
    directory.setUint32(42, position, true);
    index.push(new Uint8Array(directory.buffer), name);
    position += 30 + name.length + bytes.length;
    indexLength += 46 + name.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, indexLength, true);
  end.setUint32(16, position, true);
  const output = new Uint8Array(position + indexLength + end.byteLength);
  let offset = 0;
  for (const bytes of [...contents, ...index, new Uint8Array(end.buffer)]) {
    output.set(bytes, offset);
    offset += bytes.length;
  }
  return output;
}

const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const spreadsheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const documentRel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const packageRel = 'http://schemas.openxmlformats.org/package/2006/relationships';
const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
const column = index => String.fromCharCode(65 + index);
const xmlText = value => String(value ?? '').replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, '')
  .replace(/[&<>"']/g, symbol => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'})[symbol]);

function sheet(rows, header, widths) {
  return `${xml}<worksheet xmlns="${spreadsheet}">
    <sheetViews><sheetView workbookViewId="0"><pane ySplit="${header}" topLeftCell="A${header + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
    <cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>
    <sheetData>${rows.map((values, row) => `<row r="${row + 1}">${values.map((value, index) =>
      `<c r="${column(index)}${row + 1}" s="${row + 1 === header ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData>
    <autoFilter ref="A${header}:${column(widths.length - 1)}${rows.length}"/>
  </worksheet>`;
}

export function orderWorkbook(order) {
  const metadata = ['수주번호', order.number, '검토자', order.reviewer, '확정 시각 (KST)', order.confirmedAt];
  const spec = [
    ['출력 구분', order.confirmedAt ? '시연용 확정본' : '시연용 검토 중 초안', '진행 상태', order.status],
    ['수주명', order.name, '고객사', order.customer],
    metadata, [],
    ['항목', order.confirmedAt ? '확정값' : '저장된 검토값', '추출 상태', '검토 상태', '선택 출처', '수정 사유', '기준 단위'],
    ...order.rows.map(row => [row.label, row.decision?.value, row.status, row.decision ? '검토 완료' : '미해결',
      row.decision?.source, row.decision?.reason, row.unit]),
  ];
  const history = [
    metadata,
    ['시각 (KST)', '검토자', '작업', '항목 또는 문서', '이전 값', '새 값', '출처', '사유 또는 원문', '추출 방식'],
    ...order.history.map(entry => ['at', 'by', 'action', 'label', 'before', 'value', 'source', 'reason', 'method']
      .map(key => entry[key])),
    ...order.rows.flatMap(row => row.candidates.map(item =>
      ['', '', '추출 후보', row.label, '', item.value, item.source, item.text, item.method])),
  ];
  const workbookParts = [
    ['worksheets/sheet1.xml', 'worksheet', sheet(spec, 5, [23, 54, 20, 22, 45, 36, 16])],
    ['worksheets/sheet2.xml', 'worksheet', sheet(history, 2, [28, 17, 17, 30, 25, 32, 45, 65, 30])],
    ['styles.xml', 'styles', `${xml}<styleSheet xmlns="${spreadsheet}">
      <fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="맑은 고딕"/></font></fonts>
      <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF172686"/><bgColor indexed="64"/></patternFill></fill></fills>
      <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
      <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    </styleSheet>`],
  ];
  return zipStored([
    ['[Content_Types].xml', `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Override PartName="/xl/workbook.xml" ContentType="${mime}.sheet.main+xml"/>
      ${workbookParts.map(([path, type]) => `<Override PartName="/xl/${path}" ContentType="${mime}.${type}+xml"/>`).join('')}
    </Types>`],
    ['_rels/.rels', `${xml}<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${documentRel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${xml}<workbook xmlns="${spreadsheet}" xmlns:r="${documentRel}"><bookViews><workbookView/></bookViews>
      <sheets><sheet name="수주 사양표" sheetId="1" r:id="rId1"/><sheet name="검토 이력" sheetId="2" r:id="rId2"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${xml}<Relationships xmlns="${packageRel}">
      ${workbookParts.map(([path, type], index) => `<Relationship Id="rId${index + 1}" Type="${documentRel}/${type}" Target="${path}"/>`).join('')}
    </Relationships>`],
    ...workbookParts.map(([path, , content]) => [`xl/${path}`, content]),
  ]);
}
