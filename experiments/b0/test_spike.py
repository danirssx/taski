"""Behavioral checks of the experiment, not production MCP integration tests."""

from copy import deepcopy
import unittest
from unittest.mock import patch

from jsonschema import Draft202012Validator, ValidationError

from spike import CATALOG, ContractError, Spike


class ContractTests(unittest.TestCase):
    def setUp(self):
        self.s = Spike()

    def update(self, **extra):
        return {"key": "DEMO-001", "expectedVersion": 1, "idempotencyKey": "u1", **extra}

    def error(self, code, tool, args, **actor):
        before = deepcopy((self.s.tickets, self.s.events, self.s.replays))
        with self.assertRaises(ContractError) as caught:
            self.s.call(tool, args, **actor)
        self.assertEqual(caught.exception.code, code)
        self.assertEqual(before, (self.s.tickets, self.s.events, self.s.replays))

    def test_eight_valid_tool_schemas_and_invalid_input(self):
        self.assertEqual(len(CATALOG["tools"]), 8)
        for tool in CATALOG["tools"]:
            Draft202012Validator.check_schema(tool["inputSchema"])
            Draft202012Validator.check_schema(tool["outputSchema"])
        for name, args in [("list_tickets", {"limit": 51}), ("get_ticket", {}),
                           ("create_ticket", {"title": "  ", "idempotencyKey": "x"}),
                           ("update_ticket", self.update(changes={"status": "unknown"})),
                           ("get_project", {"secret": "unrecognized"})]:
            with self.subTest(name=name), self.assertRaises(ValidationError):
                self.s.call(name, args)
        self.assertEqual(len(self.s.tickets), 20)
        self.assertEqual(self.s.events, [])

    def test_versioned_project_cache_and_invalidation(self):
        full = self.s.call("get_project", {})
        cached = self.s.call("get_project", {"knownVersion": full["configVersion"]})
        self.assertTrue(cached["notModified"])
        self.assertNotIn("project", cached)
        self.s.project["configVersion"] += 1
        self.assertIn("project", self.s.call("get_project", {"knownVersion": 1}))

    def test_summary_pagination_filters_and_cursor_drift(self):
        args = {"limit": 3, "assigneeId": "dev-a"}
        rows = []
        first = self.s.call("list_tickets", args)
        page = first
        while True:
            rows.extend(page["items"])
            if not page["nextCursor"]:
                break
            page = self.s.call("list_tickets", {**args, "cursor": page["nextCursor"]})
        self.assertEqual(len(rows), 10)
        self.assertEqual(len({r["key"] for r in rows}), 10)
        self.assertTrue(all("description" not in r and "comments" not in r for r in rows))
        self.error("INVALID_CURSOR", "list_tickets", {"cursor": first["nextCursor"]})
        self.s.call("add_comment", self.update(body="Changed"))
        self.error("INVALID_CURSOR", "list_tickets", {**args, "cursor": first["nextCursor"]})

    def test_compound_read_preserves_long_content_and_pages_older_comments(self):
        content = "Contenido completo. " * 3000
        self.s.tickets["DEMO-001"]["description"] = content
        for n in range(7):
            self.s.call("add_comment", self.update(expectedVersion=n + 1,
                        idempotencyKey=f"c{n}", body=f"Progress {n}"))
        page = self.s.call("get_ticket", {"key": "DEMO-001"})
        self.assertEqual(page["ticket"]["description"], content)
        self.assertEqual(len(page["comments"]), 5)
        all_comments = list(page["comments"])
        while page["nextCommentsCursor"]:
            page = self.s.call("get_ticket", {"key": "DEMO-001", "view": "full",
                               "commentsCursor": page["nextCommentsCursor"]})
            all_comments.extend(page["comments"])
        self.assertEqual(len({c["id"] for c in all_comments}), 8)

    def test_compound_update_creates_single_event_and_receipt(self):
        result = self.s.call("update_ticket", self.update(changes={"status": "in_review"},
                             comment="Ready for review"))
        self.assertEqual(result["version"], 2)
        self.assertNotIn("description", result)
        self.assertEqual(len(self.s.events), 1)
        event = self.s.events[0]
        self.assertEqual(event["changes"]["status"], {"before": "todo", "after": "in_review"})
        self.assertEqual(event["changes"]["commentAdded"]["body"], "Ready for review")

    def test_rejected_assignment_and_partial_write_roll_back(self):
        self.error("UNKNOWN_MEMBER", "update_ticket", self.update(
            changes={"status": "in_review", "assigneeId": "missing"}, comment="Must not persist"))
        before = deepcopy((self.s.tickets, self.s.events, self.s.replays))
        with patch("spike.Draft202012Validator") as validator:
            validator.return_value.validate.side_effect = [None, RuntimeError("output failure")]
            with self.assertRaises(RuntimeError):
                self.s.call("update_ticket", self.update(changes={"status": "in_review"}, comment="x"))
        self.assertEqual(before, (self.s.tickets, self.s.events, self.s.replays))

    def test_idempotent_create_assign_and_conflicting_reuse(self):
        args = {"title": "New task", "assigneeId": "dev-b", "idempotencyKey": "create-1"}
        first = self.s.call("create_ticket", args)
        self.assertEqual(first, self.s.call("create_ticket", args))
        self.assertEqual(len(self.s.tickets), 21)
        self.assertEqual(len(self.s.events), 1)
        self.assertEqual(self.s.ticket(first["key"])["assigneeId"], "dev-b")
        self.error("IDEMPOTENCY_CONFLICT", "create_ticket", {**args, "title": "Different"})

    def test_idempotent_update_and_stale_concurrent_write(self):
        args = self.update(changes={"status": "in_review"}, comment="One comment")
        result = self.s.call("update_ticket", args)
        self.assertEqual(result, self.s.call("update_ticket", args))
        self.assertEqual(len(self.s.ticket("DEMO-001")["comments"]), 2)
        self.error("VERSION_CONFLICT", "update_ticket", self.update(
            idempotencyKey="other-client", changes={"title": "Stale"}))

    def test_agent_closure_policy_shared_across_channels_and_scoped_delegation(self):
        for channel in ["mcp", "http", "web"]:
            self.error("REVIEW_REQUIRED", "update_ticket", self.update(
                changes={"status": "done"}, comment="Must not persist"), channel=channel)
        result = self.s.call("update_ticket", self.update(changes={"status": "done"}),
                             authorization="delegation-demo-B0")
        self.assertEqual(result["version"], 2)
        self.assertEqual(self.s.events[0]["actor"]["authorizationRef"], "delegation-demo-B0")
        self.assertFalse(self.s.project["agentsCanComplete"])
        self.s.call("update_ticket", self.update(key="DEMO-002", idempotencyKey="human",
                    changes={"status": "done"}), member="reviewer", kind="person", channel="web")

    def test_incremental_changes_pagination_expiry_and_full_recovery(self):
        cursor = self.s.call("get_project", {})["activityCursor"]
        for n in range(3):
            self.s.call("update_ticket", self.update(key=f"DEMO-{n+1:03}",
                        idempotencyKey=str(n), changes={"highlighted": True}))
        page = self.s.call("list_activity", {"cursor": cursor, "limit": 2})
        self.assertEqual(len(page["items"]), 2)
        self.assertTrue(page["hasMore"])
        last = self.s.call("list_activity", {"cursor": page["nextCursor"], "limit": 2})
        self.assertEqual(len(last["items"]), 1)
        self.assertFalse(last["hasMore"])
        self.assertEqual(self.s.call("list_activity", {"cursor": last["nextCursor"]})["items"], [])
        self.assertNotIn("description", page["items"][0]["changes"])
        self.s.retained_after = 1
        self.error("CURSOR_EXPIRED", "list_activity", {"cursor": cursor})
        self.error("INVALID_CURSOR", "list_activity", {"cursor": "old-epoch:0"})
        project = self.s.call("get_project", {})
        keys = [r["key"] for r in self.s.call("list_tickets", {})["items"]]
        restored = [self.s.call("get_ticket", {"key": key, "view": "full"}) for key in keys]
        self.assertEqual(len(restored), 20)
        self.assertEqual(self.s.call("list_activity", {"cursor": project["activityCursor"]})["items"], [])

    def test_patch_event_and_feedback_identity_preserved(self):
        before = deepcopy(self.s.ticket("DEMO-004"))
        result = self.s.call("update_ticket", self.update(key="DEMO-004", changes={"type": "task"},
                             descriptionPatch={"find": "ficticio", "replace": "neutral"}))
        after = self.s.ticket("DEMO-004")
        self.assertEqual(before["key"], after["key"])
        self.assertEqual(before["comments"], after["comments"])
        self.assertEqual(result["version"], 2)
        self.assertEqual(self.s.events[0]["changes"]["description"],
                         {"patch": {"find": "ficticio", "replace": "neutral"}})
        self.error("PATCH_CONFLICT", "update_ticket", self.update(expectedVersion=1, idempotencyKey="bad-patch",
                   descriptionPatch={"find": "missing", "replace": "x"}))

    def test_manual_pr_link_and_combined_edit(self):
        url = "https://github.com/example/demo/pull/1"
        self.s.call("link_pull_request", self.update(url=url))
        self.assertEqual(self.s.ticket("DEMO-001")["prUrl"], url)
        self.s.call("update_ticket", self.update(expectedVersion=2, idempotencyKey="pr2",
                    changes={"status": "in_review", "prUrl": url}, comment="Review this PR"))
        self.assertEqual(len(self.s.events), 2)


if __name__ == "__main__":
    unittest.main()
