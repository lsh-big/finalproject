"""Refresh the public fixtures from the same synthetic documents as the login server."""
import base64
import json
import runpy
from pathlib import Path

root = Path(__file__).resolve().parents[1]
public = root / "public"
worker = runpy.run_path(str(root / "order-files.py"))
fixtures = {}
for scenario in ("normal", "conflict", "missing"):
    fixtures[scenario] = {}
    for kind, extension in (("po", "pdf"), ("tech", "xlsx")):
        raw = worker["demo_file"](scenario, kind)
        (public / f"order-demo-{scenario}-{kind}.{extension}").write_bytes(raw)
        result = worker["main"]({"action": "read", "format": extension, "bytes": base64.b64encode(raw).decode()})
        assert not result["warnings"], f"Unexpected warnings in {scenario} {kind}"
        fixtures[scenario][kind] = result["fragments"]
        if extension == "pdf":
            preview = worker["main"]({"action": "preview", "page": 1, "bytes": base64.b64encode(raw).decode()})
            (public / f"order-demo-{scenario}-po.jpg").write_bytes(base64.b64decode(preview["bytes"]))
(public / "order-demo-data.json").write_text(json.dumps(fixtures, ensure_ascii=False, separators=(",", ":")) + "\n",
                                           encoding="utf-8")
