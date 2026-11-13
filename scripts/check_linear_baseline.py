"""Check arithmetic of published aggregates; no network or private source data."""

from collections import defaultdict
import json
from pathlib import Path
import statistics


def main():
    root = Path(__file__).resolve().parents[1]
    data = json.loads((root / "docs/benchmarks/linear-baseline.json").read_text())
    grouped = defaultdict(list)
    assert len(data["samples"]) == 16
    for sample in data["samples"]:
        group = sample["key"].rsplit("_", 1)[0]
        grouped[group].append(sample)
        assert sample["tool_io_tokens_proxy"] == (
            sample["response_tokens_proxy"] + sample["args_tokens_proxy"]
        )
    for name, summary in data["groups"].items():
        rows = grouped[name]
        timings = [r["ms"] for r in rows]
        assert summary["n"] == len(rows)
        assert summary["median_ms"] == statistics.median(timings)
        assert summary["min_ms"] == min(timings)
        assert summary["max_ms"] == max(timings)
        for field in ["response_tokens_proxy", "args_tokens_proxy", "tool_io_tokens_proxy"]:
            assert all(row[field] == summary[field] for row in rows)
    projection = data["projection"]
    a = projection["linear_compact_normalized_tokens"]
    b = projection["taski_proposed_with_version_tokens"]
    assert round((b - a) / a * 100, 2) == projection["difference_percent"]
    fixtures = root / "experiments/b0/fixtures"
    project = json.loads((fixtures / "project.json").read_text())
    tickets = json.loads((fixtures / "tickets.json").read_text())
    assert len(tickets) == len({t["key"] for t in tickets}) == 20
    members = {m["id"] for m in project["members"]}
    assert all(t["assigneeId"] in members for t in tickets)
    print("OK: 16 historical samples; aggregate arithmetic; 20 neutral fixtures.")


if __name__ == "__main__":
    main()
