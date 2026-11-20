"""Read original document locations and generate order workbooks."""
import base64
import io
import json
import os
import re
import sys
from collections import defaultdict
from contextlib import closing
from datetime import date, datetime
from zipfile import ZipFile

import pypdfium2 as pdfium
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter


def location(page=None, sheet=None, cell=None):
    return {"page": page} if page else {"sheet": sheet, "cell": cell}


def meaningful(text):
    return len(re.findall(r"[A-Za-z0-9가-힣]", text)) >= 15 and text.count("�") <= len(text) * .05


def read_pdf(raw):
    fragments, warnings, modes = [], [], set()
    with pdfium.PdfDocument(raw) as document:
        if len(document) > 50:
            raise ValueError("PDF는 문서당 50쪽까지 등록할 수 있습니다.")
        for index, page in enumerate(document, 1):
            where = location(page=index)
            with closing(page):
                with closing(page.get_textpage()) as text_page:
                    text = text_page.get_text_range()
                low_quality = False
                if meaningful(text):
                    modes.add("PDF 텍스트")
                else:
                    try:
                        with closing(page.render(scale=min(3, 2400 / max(page.get_size())))) as bitmap:
                            ocr_text, confidence = recognize(bitmap.to_pil())
                        if ocr_text.strip():
                            text = ocr_text
                            modes.add("PDF OCR")
                        low_quality = confidence < 80 or not meaningful(ocr_text)
                        if low_quality:
                            warnings.append({"location": where, "message": "OCR 품질이 낮습니다. 원본을 확인하세요."})
                    except (RuntimeError, OSError):
                        low_quality = True
                        warnings.append({"location": where, "message": "텍스트를 읽지 못했습니다. OCR 설정 또는 원본을 확인하세요."})
                if not text.strip():
                    continue
                for line in text.splitlines():
                    if line.strip():
                        fragments.append({**where, "text": line.strip(), "uncertain": low_quality})
    return fragments, warnings, modes


def recognize(image):
    import pytesseract
    from pytesseract import Output

    if os.environ.get("ORDER_TESSERACT_CMD"):
        pytesseract.pytesseract.tesseract_cmd = os.environ["ORDER_TESSERACT_CMD"]
    result = pytesseract.image_to_data(image, lang=os.environ.get("ORDER_OCR_LANG", "kor+eng"),
                                      output_type=Output.DICT, timeout=12)
    lines, confidences = defaultdict(list), []
    for index, word in enumerate(result["text"]):
        if word.strip() and float(result["conf"][index]) >= 0:
            key = tuple(result[name][index] for name in ("block_num", "par_num", "line_num"))
            lines[key].append(word)
            confidences.append(float(result["conf"][index]))
    return "\n".join(" ".join(words) for words in lines.values()), min(confidences, default=0)


def cell_text(value):
    if isinstance(value, (date, datetime)):
        return value.strftime("%Y-%m-%d")
    return str(value).strip()


def read_xlsx(raw):
    with ZipFile(io.BytesIO(raw)) as archive:
        if sum(item.file_size for item in archive.infolist()) > 64 * 1024 * 1024:
            raise ValueError("XLSX의 압축 해제 용량이 너무 큽니다.")
    fragments, warnings = [], []
    with io.BytesIO(raw) as stream:
        workbook = load_workbook(stream, read_only=True, data_only=False, keep_links=False)
        try:
            for sheet in workbook:
                # Ignore declared dimensions, which can omit populated cells.
                sheet.reset_dimensions()
                for row_number, row in enumerate(sheet.iter_rows(), 1):
                    if row_number > 10000 or len(row) > 200:
                        raise ValueError("XLSX는 시트당 10,000행 × 200열까지 지원합니다.")
                    cells = [(column, cell) for column, cell in enumerate(row, 1) if cell.value is not None]
                    for index, (column, cell) in enumerate(cells):
                        following = cells[index + 1][1] if index + 1 < len(cells) else None
                        where = location(sheet=sheet.title, cell=f"{get_column_letter(column)}{row_number}")
                        fragment = {**where, "text": cell_text(cell.value),
                                    "uncertain": cell.data_type in {"f", "e"}}
                        if following:
                            fragment.update(next=cell_text(following.value), nextCell=following.coordinate,
                                            nextUncertain=following.data_type in {"f", "e"})
                        fragments.append(fragment)
                        if len(fragments) > 12000:
                            raise ValueError("XLSX는 값이 있는 셀을 12,000개까지 처리할 수 있습니다.")
        finally:
            workbook.close()
    return fragments, warnings, {"XLSX 셀 읽기"}


DEMO_ROWS = [
    ("발주번호", "Purchase Order", "DEMO-26001"),
    ("프로젝트명", "Project", "Horizon Center"),
    ("수량", "Quantity", "2"),
    ("요청 납기", "Delivery Date", "2027-02-15"),
    ("층수", "Floors", "15"),
    ("정차층 수", "Number of Stops", "14"),
    ("정차층 표기 목록", "Stop Labels", "1F, 2F, 3F, 5F, 6F, 7F, 8F, 9F, 10F, 11F, 12F, 13F, 14F, 15F"),
    ("정격하중", "Rated Load", "1000 kg"),
    ("정격속도", "Rated Speed", "1.75 m/s"),
    ("전원 전압", "Supply Voltage", "380 V"),
    ("상수", "Phase", "3"),
    ("주파수", "Frequency", "60 Hz"),
    ("모터 용량", "Motor Power", "11 kW"),
    ("도어 사양", "Door Specification", "2-panel center opening / 900 x 2100 mm"),
    ("고객 요청 옵션", "Customer Options", "Emergency power, remote monitoring"),
]


def demo_file(scenario, kind):
    rows = [list(row) for row in DEMO_ROWS if scenario != "missing" or row[1] != "Motor Power"]
    for row in rows:
        if row[1] == "Purchase Order":
            row[2] = {"normal": "DEMO-26001", "conflict": "DEMO-26002", "missing": "DEMO-26003"}[scenario]
        if kind == "tech":
            row[2] = {"Supply Voltage": "380V", "Rated Load": "1,000kg", "Delivery Date": "2027.02.15"}.get(row[1], row[2])
            if scenario == "conflict" and row[1] == "Floors":
                row[2] = "16층"
    if kind == "po":
        lines = ["SAMIL ELTEC / DEMO PURCHASE ORDER", "Fictional customer: Horizon Lift (Demo)", "",
                 *(f"{english}: {value}" for _, english, value in rows)]
        return sample_pdf(lines)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "기술 사양"
    sheet.append(["시연용 기술 사양서", "가상 고객 · 호라이즌리프트"])
    sheet.append(["항목", "고객 사양"])
    for korean, _, value in rows:
        sheet.append([korean, value])
    format_sheet(sheet, 2, [24, 75])
    return workbook_bytes(workbook)


def sample_pdf(lines):
    # A compact, text-based demo PDF using a built-in PDF font.
    escaped = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in lines]
    content = ("BT /F1 11 Tf 16 TL 42 790 Td\n" +
               "\n".join(f"({line}) Tj T*" for line in escaped) + "\nET").encode("ascii")
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>",
               b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
               b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
               b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
               f"<< /Length {len(content)} >>\nstream\n".encode() + content + b"\nendstream"]
    output = io.BytesIO()
    output.write(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(output.tell())
        output.write(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = output.tell()
    output.write(b"xref\n0 6\n0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.write(f"{offset:010d} 00000 n \n".encode())
    output.write(f"trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n{xref}\n%%EOF".encode())
    return output.getvalue()


def format_sheet(sheet, header, widths):
    sheet.freeze_panes = f"A{header + 1}"
    sheet.auto_filter.ref = f"A{header}:{get_column_letter(len(widths))}{sheet.max_row}"
    for index, width in enumerate(widths, 1):
        sheet.column_dimensions[get_column_letter(index)].width = width
    for row in sheet.iter_rows():
        for cell in row:
            if isinstance(cell.value, str):
                # Keep source and user-entered strings literal, including formulas.
                cell.data_type = "s"
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            if cell.row == header:
                cell.fill = PatternFill("solid", fgColor="172686")
                cell.font = Font(bold=True, color="FFFFFF")


def workbook_bytes(workbook):
    with io.BytesIO() as output:
        workbook.save(output)
        return output.getvalue()


def export_workbook(order):
    workbook = Workbook()
    spec = workbook.active
    spec.title = "수주 사양표"
    spec.append(["수주번호", order["number"], "진행 상태", order["status"]])
    spec.append(["수주명", order["name"], "고객사", order["customer"]])
    spec.append(["검토자", order["reviewer"], "확정 시각 (KST)", order["confirmedAt"]])
    spec.append(["출력 구분", "확정본" if order["confirmedAt"] else "검토 중 초안"])
    spec.append([])
    spec.append(["항목", "확정값" if order["confirmedAt"] else "저장된 검토값", "추출 상태", "검토 상태", "선택 출처", "수정 사유", "기준 단위"])
    for row in order["rows"]:
        decision = row.get("decision") or {}
        source = decision.get("source") or ""
        spec.append([row["label"], decision.get("value", ""), row["status"],
                     "검토 완료" if decision else "미해결", source, decision.get("reason", ""), row["unit"]])
    format_sheet(spec, 6, [25, 54, 19, 21, 49, 42, 14])
    history = workbook.create_sheet("검토 이력")
    history.append(["수주번호", order["number"], "검토자", order["reviewer"], "확정 시각 (KST)", order["confirmedAt"]])
    history.append(["시각 (KST)", "검토자", "작업", "항목/문서", "이전 값", "새 값", "출처", "사유 / 원문", "추출 방식"])
    for entry in order["history"]:
        history.append([entry.get(key, "") for key in ("at", "by", "action", "label", "before", "value", "source", "reason", "method")])
    for row in order["rows"]:
        for candidate in row["candidates"]:
            history.append(["", "", "추출 후보", row["label"], "", candidate["value"], candidate["source"],
                            candidate["text"], candidate["method"]])
    for document in order["documents"]:
        for warning in document["warnings"]:
            history.append(["", "", "문서 확인 필요", document["name"], "", "", warning["source"],
                            warning["message"], document["method"]])
    format_sheet(history, 2, [27, 18, 21, 28, 29, 38, 45, 65, 30])
    return workbook_bytes(workbook)


def main(request):
    action = request["action"]
    if action == "demo":
        return {"bytes": base64.b64encode(demo_file(request["scenario"], request["kind"])).decode()}
    if action == "export":
        return {"bytes": base64.b64encode(export_workbook(request["order"])).decode()}
    raw = base64.b64decode(request["bytes"])
    if action == "preview":
        with pdfium.PdfDocument(raw) as document:
            with closing(document[request["page"] - 1]) as page:
                with closing(page.render(scale=min(2, 1550 / max(page.get_size())))) as bitmap, io.BytesIO() as output:
                    bitmap.to_pil().convert("RGB").save(output, "JPEG", quality=82)
                    return {"bytes": base64.b64encode(output.getvalue()).decode()}
    reader = read_pdf if request["format"] == "pdf" else read_xlsx
    fragments, warnings, modes = reader(raw)
    if sum(len(item["text"]) for item in fragments) > 450000:
        raise ValueError("문서의 텍스트가 너무 많습니다. 필요한 페이지나 시트만 등록하세요.")
    return {"fragments": fragments, "warnings": warnings, "modes": sorted(modes)}


if __name__ == "__main__":
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        print(json.dumps(main(json.load(sys.stdin)), ensure_ascii=False))
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
    except Exception:
        print(json.dumps({"error": "문서를 열거나 변환할 수 없습니다. 파일 형식과 암호 설정을 확인하세요."}, ensure_ascii=False))
