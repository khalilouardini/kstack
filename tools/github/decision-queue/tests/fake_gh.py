#!/usr/bin/env python3
"""Serve GitHub CLI responses from a fixture and record every invocation."""

import json
import os
from pathlib import Path
import re
import sys


def main():
    args = sys.argv[1:]
    state = json.loads(Path(os.environ["QUEUE_TEST_FIXTURE"]).read_text())
    write = args[:2] in (["pr", "merge"], ["pr", "close"], ["pr", "comment"])
    stdin = sys.stdin.read() if args[:2] == ["pr", "comment"] else None
    cwd = Path.cwd()
    with Path(os.environ["QUEUE_TEST_CALLS"]).open("a") as calls:
        calls.write(json.dumps({
            "args": args,
            "write": write,
            "token": os.environ.get("GH_TOKEN"),
            "stdin": stdin,
            "in_checkout": any((path / ".git").exists() for path in (cwd, *cwd.parents)),
        }) + "\n")

    if args[:2] == ["auth", "token"]:
        login = args[args.index("--user") + 1]
        if not state.get("no_token"):
            print("stub-token-for-" + login)
            return 0
        print("fixture token unavailable", file=sys.stderr)
        return 1
    if args[:2] == ["api", "user"]:
        token = os.environ.get("GH_TOKEN", "")
        print(state.get("actor", token.removeprefix("stub-token-for-")))
        return 0
    if args[:2] == ["api", "graphql"]:
        if "--paginate" in args:
            print(json.dumps([{
                "data": {"repository": {"pullRequests": {
                    "nodes": state["rows"],
                    "pageInfo": {"hasNextPage": False, "endCursor": None},
                }}},
            }]))
            return 0
        number = next(
            int(match[1]) for arg in args if (match := re.fullmatch(r"(?:n|number)=(\d+)", arg))
        )
        row = next(row for row in state["rows"] if row["number"] == number)
        current = {
            "state": "OPEN",
            **row,
            **state.get("current", {}).get(str(number), {}),
        }
        print(json.dumps({"data": {"repository": {"pullRequest": current}}}))
        return 0
    if len(args) > 1 and args[0] == "api" and (
        match := re.fullmatch(r"repos/[^/]+/[^/]+/issues/(\d+)/comments", args[1])
    ):
        comments = state.get("comments", {}).get(match[1], [])
        print(json.dumps(comments if "--slurp" in args else [item for page in comments for item in page]))
        return 0
    if args[:2] == ["pr", "checks"]:
        result = state.get("checks", {}).get(args[2], [{"name": "lint + tests", "bucket": "pass"}])
        if isinstance(result, dict):
            print(json.dumps(result["checks"]))
            return result["exit_code"]
        if result is None:
            print("no checks reported", file=sys.stderr)
            return 1
        print(json.dumps(result))
        return 0
    if args[:2] == ["pr", "view"]:
        row = next(row for row in state["rows"] if row["number"] == int(args[2]))
        current = state.get("current", {}).get(args[2], {})
        print(json.dumps({"headRefOid": current.get("headRefOid", row["headRefOid"])}))
        return 0
    if write:
        return state.get("write_exit_code", 0)
    print("Unexpected gh command: " + repr(args), file=sys.stderr)
    return 97


if __name__ == "__main__":
    sys.exit(main())
