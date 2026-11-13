"""Measure deterministic shape budgets. Never report these as actual agent usage."""

import json
from pathlib import Path
import sys

import tiktoken

from spike import CATALOG, Spike


def main():
    encoder = tiktoken.get_encoding("o200k_base")

    def size(value):
        text = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return {"tokensProxy": len(encoder.encode(text, disallowed_special=())),
                "utf8Bytes": len(text.encode())}

    s = Spike()
    config = s.call("get_project", {})
    cached = s.call("get_project", {"knownVersion": config["configVersion"]})
    listing = s.call("list_tickets", {})
    work = s.call("get_ticket", {"key": "DEMO-001"})
    receipt = s.call("update_ticket", {"key": "DEMO-001", "expectedVersion": 1,
                     "idempotencyKey": "measure-1", "changes": {"status": "in_review"},
                     "comment": "Ready for review"})
    delta = s.call("list_activity", {"cursor": config["activityCursor"]})
    values = {"catalog": CATALOG, "list20": listing, "ordinaryReceipt": receipt,
              "projectFull": config, "projectNotModified": cached, "workRead": work,
              "singleChange": delta}
    metrics = {name: size(value) for name, value in values.items()}
    budgets = {"catalog": 4000, "list20": 1600, "ordinaryReceipt": 200}
    for name, limit in budgets.items():
        if metrics[name]["tokensProxy"] > limit:
            raise SystemExit(f"Budget failed: {name}: {metrics[name]['tokensProxy']} > {limit}")
    # Count the intended adapter operations; this is not an observed network result.
    report = {"status": "LOCAL_CONTRACT_SPIKE", "tokenizer": "tiktoken==0.14.0/o200k_base",
              "serialization": "json.dumps ensure_ascii=False sort_keys=True separators=(',', ':')",
              "scope": "Synthetic in-process fixtures; no host, transport, D1, model usage or latency measured",
              "tools": 8, "metrics": metrics, "budgetsProxy": budgets,
              "plannedOperations": {"ticketAndRecentComments": 1, "statusAndProgressAtomic": 1},
              "realUsage": None, "latency": None, "superiorityOverLinear": "NOT_DEMONSTRATED"}
    text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    target = Path(__file__).resolve().parents[2] / "docs/benchmarks/b0-spike-results.json"
    if "--check" in sys.argv:
        if not target.exists() or target.read_text() != text:
            raise SystemExit("Results changed; run measure.py and review the updated report.")
        print("OK: reproducible spike report and all three proxy budgets.")
    else:
        target.write_text(text)
        print(text)


if __name__ == "__main__":
    main()
