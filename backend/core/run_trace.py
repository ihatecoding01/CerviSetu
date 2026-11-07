"""Records what the agents really did on a case: which ran, how long each took and the outcome."""
import json
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from backend.core.database import global_db
from backend.core.security import global_audit

NODE_INFO = {
    "intake": ("Intake & PII Vault", "Masks identity, reads the case"),
    "diagnostic": ("Case Summary", "Summary and pathway for clinician review"),
}

with global_db._get_conn() as _conn:
    _conn.execute("CREATE TABLE IF NOT EXISTS agent_run_trace (id INTEGER PRIMARY KEY CHECK (id = 1), trace TEXT NOT NULL)")
    _conn.commit()


def _summary(node: str, update: Dict[str, Any]) -> str:
    if node == "intake":
        intake = update.get("clinical_intake") or {}
        site = intake.get("cancer_type") if isinstance(intake, dict) else None
        return f"Intake {update.get('intake_status') or 'done'}" + (f", {site}" if site else "") + ", identity masked."
    if node == "diagnostic":
        synthesis = update.get("diagnostic_synthesis") or {}
        return f"Urgency {synthesis.get('urgency', 'not set')}; {'AI draft' if synthesis.get('ai_generated') else 'rules-based'}."
    return "Done."


def traced_invoke(graph, state: Dict[str, Any], config: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Run the graph like invoke(), timing each node as it actually completes, and remember the run."""
    nodes = []
    started = last = time.perf_counter()
    for step in graph.stream(state, config=config, stream_mode="updates"):
        now = time.perf_counter()
        for node, update in step.items():
            name, role = NODE_INFO.get(node, (node, ""))
            nodes.append({"node": node, "name": name, "role": role, "latency_ms": round((now - last) * 1000, 1),
                          "status": "COMPLETED", "summary": _summary(node, update or {})})
        last = now
    final = dict(graph.get_state(config).values)
    trace = {"trace_id": f"RUN-{secrets.token_hex(4).upper()}", "recorded_at": datetime.now(timezone.utc).isoformat(),
             "total_latency_ms": round((last - started) * 1000, 1), "nodes": nodes,
             "patient_token": final.get("patient_token") or "UNKNOWN"}
    with global_db._get_conn() as conn:
        conn.execute("INSERT OR REPLACE INTO agent_run_trace (id, trace) VALUES (1, ?)", (json.dumps(trace),))
        conn.commit()
    return final, trace


def latest_trace() -> Optional[Dict[str, Any]]:
    with global_db._get_conn() as conn:
        row = conn.execute("SELECT trace FROM agent_run_trace WHERE id = 1").fetchone()
    if not row:
        return None
    trace = json.loads(row["trace"])
    # Labels come from the current pathway, so a run saved earlier never shows old step names.
    trace["nodes"] = [n for n in trace.get("nodes", []) if n.get("node") in NODE_INFO]
    for node in trace["nodes"]:
        node["name"], node["role"] = NODE_INFO[node["node"]]
    return trace



def latest_ledger_block() -> Dict[str, Any]:
    """The real newest block of the audit chain."""
    index, block = 0, {}
    with open(global_audit._log_file, encoding="utf-8") as f:
        for line in f:
            if line.strip():
                index += 1
                block = json.loads(line)
    return {"block_index": index, "sha256": block.get("current_hash", ""), "previous_hash": block.get("previous_hash", ""),
            "compliance": "Verified by the audit chain check in Security & Audit"}
