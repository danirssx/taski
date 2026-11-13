"""B0 in-memory contract experiment. No MCP transport, auth, D1 or production API."""

from copy import deepcopy
import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent
CATALOG = json.loads((ROOT / "catalog.json").read_text())
TOOLS = {tool["name"]: tool for tool in CATALOG["tools"]}
SUMMARY = ("key", "title", "status", "assigneeId", "highlighted", "version")


class ContractError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


class Spike:
    def __init__(self):
        self.project = json.loads((ROOT / "fixtures/project.json").read_text())
        self.tickets = {t["key"]: t for t in json.loads((ROOT / "fixtures/tickets.json").read_text())}
        self.events = []
        self.replays = {}
        self.epoch = "demo-1"
        self.retained_after = 0

    def cursor(self, seq=None):
        return f"{self.epoch}:{len(self.events) if seq is None else seq}"

    def sequence(self, cursor):
        try:
            epoch, value = cursor.split(":")
            seq = int(value)
        except (ValueError, AttributeError):
            raise ContractError("INVALID_CURSOR") from None
        if epoch != self.epoch or seq < 0 or seq > len(self.events):
            raise ContractError("INVALID_CURSOR")
        if seq < self.retained_after:
            raise ContractError("CURSOR_EXPIRED")
        return seq

    def ticket(self, key):
        if key not in self.tickets:
            raise ContractError("NOT_FOUND")
        return self.tickets[key]

    def call(self, name, args, *, member="dev-a", channel="mcp", kind="agent", authorization=None):
        if name not in TOOLS:
            raise ContractError("UNKNOWN_TOOL")
        tool = TOOLS[name]
        Draft202012Validator(tool["inputSchema"]).validate(args)
        if member not in {m["id"] for m in self.project["members"]}:
            raise ContractError("UNKNOWN_MEMBER")
        if kind not in {"agent", "person"} or channel not in {"mcp", "web", "http"}:
            raise ContractError("INVALID_ACTOR")
        actor = {"memberId": member, "channel": channel, "kind": kind}
        if authorization:
            actor["authorizationRef"] = authorization
        if name in {"get_project", "list_tickets", "get_ticket", "list_activity"}:
            result = getattr(self, name)(**args)
        else:
            # Full rollback is only an experiment for single-process atomic semantics.
            # B3 must implement an actual D1 transaction, not copy this storage model.
            snapshot = deepcopy((self.tickets, self.events, self.replays))
            try:
                result = self.mutate(name, args, actor)
                Draft202012Validator(tool["outputSchema"]).validate(result)
            except Exception:
                self.tickets, self.events, self.replays = snapshot
                raise
        Draft202012Validator(tool["outputSchema"]).validate(result)
        return deepcopy(result)

    def get_project(self, knownVersion=None):
        same = knownVersion == self.project["configVersion"]
        result = {"configVersion": self.project["configVersion"], "notModified": same,
                  "activityCursor": self.cursor()}
        if not same:
            result["project"] = deepcopy(self.project)
        return result

    def list_tickets(self, limit=20, cursor=None, **filters):
        start = 0
        # Cursor binds filters and revision; reject drift rather than silently skip rows.
        signature = json.dumps(filters, sort_keys=True, separators=(",", ":"))
        if cursor:
            try:
                revision, start, saved = json.loads(cursor)
            except (ValueError, TypeError):
                raise ContractError("INVALID_CURSOR") from None
            if (revision != self.cursor() or saved != signature or type(start) is not int
                    or start < 0):
                raise ContractError("INVALID_CURSOR")
        rows = [t for t in sorted(self.tickets.values(), key=lambda t: t["key"])
                if all(t[k] == v for k, v in filters.items())]
        if start > len(rows):
            raise ContractError("INVALID_CURSOR")
        end = start + limit
        return {"items": [{k: t[k] for k in SUMMARY} for t in rows[start:end]],
                "nextCursor": json.dumps([self.cursor(), end, signature], separators=(",", ":"))
                if end < len(rows) else None,
                "activityCursor": self.cursor(), "omitted": ["description", "comments", "history"]}

    def get_ticket(self, key, view="work", commentsLimit=5, commentsCursor=None):
        ticket = self.ticket(key)
        fields = SUMMARY if view == "summary" else tuple(k for k in ticket if k != "comments")
        comments = ticket["comments"]
        end = len(comments)
        if commentsCursor:
            try:
                saved_key, version, end = json.loads(commentsCursor)
            except (ValueError, TypeError):
                raise ContractError("INVALID_CURSOR") from None
            if (saved_key != key or version != ticket["version"] or type(end) is not int
                    or not 0 <= end <= len(comments)):
                raise ContractError("INVALID_CURSOR")
        if view == "summary" or commentsLimit == 0:
            return {"ticket": {k: ticket[k] for k in fields}, "comments": [],
                    "nextCommentsCursor": None, "omitted": ["comments", "history"]
                    + (["description", "area", "type", "prUrl"] if view == "summary" else [])}
        start = max(0, end - commentsLimit)
        return {"ticket": {k: ticket[k] for k in fields}, "comments": comments[start:end],
                "nextCommentsCursor": json.dumps([key, ticket["version"], start], separators=(",", ":"))
                if start else None,
                "omitted": ["history"] + (["olderComments"] if start else [])}

    def list_activity(self, cursor=None, limit=20):
        start = self.sequence(cursor or self.cursor(0))
        end = min(len(self.events), start + limit)
        return {"items": self.events[start:end], "nextCursor": self.cursor(end),
                "hasMore": end < len(self.events)}

    def mutate(self, name, args, actor):
        identity = (actor["memberId"], name, args["idempotencyKey"])
        fingerprint = json.dumps({"args": args, "actor": actor}, sort_keys=True)
        if identity in self.replays:
            previous, result = self.replays[identity]
            if previous != fingerprint:
                raise ContractError("IDEMPOTENCY_CONFLICT")
            return result
        if name == "create_ticket":
            key = f"DEMO-{max(int(k.split('-')[-1]) for k in self.tickets) + 1:03}"
            ticket = {"key": key, "title": args["title"], "description": args.get("description", ""),
                      "status": "todo", "assigneeId": args.get("assigneeId"),
                      "area": args.get("area", "general"), "type": args.get("type", "task"),
                      "highlighted": False, "version": 1, "prUrl": None, "comments": []}
            changes = {k: {"before": None, "after": v} for k, v in ticket.items()
                       if k not in {"key", "version", "comments"}}
        else:
            ticket = deepcopy(self.ticket(args["key"]))
            if ticket["version"] != args["expectedVersion"]:
                raise ContractError("VERSION_CONFLICT")
            updates = deepcopy(args.get("changes", {}))
            if name == "link_pull_request":
                updates["prUrl"] = args["url"]
            patch = args.get("descriptionPatch")
            if patch:
                if "description" in updates or ticket["description"].count(patch["find"]) != 1:
                    raise ContractError("PATCH_CONFLICT")
                updates["description"] = ticket["description"].replace(patch["find"], patch["replace"], 1)
                if len(updates["description"]) > 100000:
                    raise ContractError("CONTENT_TOO_LONG")
            if (updates.get("status") == "done" and actor["kind"] == "agent"
                    and not self.project["agentsCanComplete"] and not actor.get("authorizationRef")):
                raise ContractError("REVIEW_REQUIRED")
            changes = {k: {"before": ticket[k], "after": v}
                       for k, v in updates.items() if ticket[k] != v}
            ticket.update(updates)
            ticket["version"] += 1
            # A patch event avoids echoing both full descriptions.
            if patch and "description" in changes:
                changes["description"] = {"patch": patch}
        if (ticket["assigneeId"] is not None and ticket["assigneeId"] not in
                {m["id"] for m in self.project["members"]}):
            raise ContractError("UNKNOWN_MEMBER")
        if ticket["area"] not in self.project["areas"]:
            raise ContractError("UNKNOWN_AREA")
        comment = args.get("comment") if name == "update_ticket" else args.get("body")
        if comment:
            comment_id = f"c-{len(self.events) + 1}"
            entry = {"id": comment_id, "body": comment, "actorId": actor["memberId"]}
            ticket["comments"].append(entry)
            changes["commentAdded"] = entry
        if not changes:
            raise ContractError("EMPTY_UPDATE")
        self.tickets[ticket["key"]] = ticket
        self.events.append({"seq": len(self.events) + 1, "ticketKey": ticket["key"],
                            "version": ticket["version"], "actor": actor, "changes": changes})
        receipt = {"key": ticket["key"], "url": f"{self.project['baseUrl']}/t/{ticket['key']}",
                   "version": ticket["version"], "changed": list(changes)}
        if comment:
            receipt["commentId"] = comment_id
        self.replays[identity] = (fingerprint, receipt)
        return receipt
