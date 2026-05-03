#!/usr/bin/env python3
"""Validate a Phase 1 YouTube production package without external dependencies."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT_REQUIRED = [
    "run_id",
    "brief",
    "sources",
    "claim_ledger",
    "script_plan",
    "storyboard",
    "media_prompts",
    "publishing_package",
    "qa",
]
BRIEF_REQUIRED = ["topic", "format", "language"]
SOURCE_REQUIRED = ["url", "title", "inclusion_reason"]
SCRIPT_REQUIRED = ["angle", "hook", "outline"]
QA_STATUSES = {"pass", "blocked", "needs_review"}
CLAIM_STATUSES = {"supported", "needs_evidence", "opinion", "high_risk", "do_not_use"}


def add_missing(failures: list[str], obj: dict, keys: list[str], label: str) -> None:
    for key in keys:
        if key not in obj:
            failures.append(f"{label} missing required key: {key}")


def validate_package(package: dict) -> list[str]:
    failures: list[str] = []
    add_missing(failures, package, ROOT_REQUIRED, "package")

    brief = package.get("brief")
    if isinstance(brief, dict):
        add_missing(failures, brief, BRIEF_REQUIRED, "brief")
    else:
        failures.append("brief must be an object")

    sources = package.get("sources")
    if isinstance(sources, list):
        if not sources:
            failures.append("sources must contain at least one source video")
        for index, source in enumerate(sources, start=1):
            if not isinstance(source, dict):
                failures.append(f"sources[{index}] must be an object")
                continue
            add_missing(failures, source, SOURCE_REQUIRED, f"sources[{index}]")
    else:
        failures.append("sources must be an array")

    claim_ledger = package.get("claim_ledger")
    if isinstance(claim_ledger, list):
        for index, claim in enumerate(claim_ledger, start=1):
            if not isinstance(claim, dict):
                failures.append(f"claim_ledger[{index}] must be an object")
                continue
            status = claim.get("status")
            if status not in CLAIM_STATUSES:
                failures.append(f"claim_ledger[{index}] has invalid status: {status}")
    else:
        failures.append("claim_ledger must be an array")

    script_plan = package.get("script_plan")
    if isinstance(script_plan, dict):
        add_missing(failures, script_plan, SCRIPT_REQUIRED, "script_plan")
        if "outline" in script_plan and not isinstance(script_plan["outline"], list):
            failures.append("script_plan.outline must be an array")
    else:
        failures.append("script_plan must be an object")

    storyboard = package.get("storyboard")
    if not isinstance(storyboard, list):
        failures.append("storyboard must be an array")

    media_prompts = package.get("media_prompts")
    if isinstance(media_prompts, dict):
        for key in ("image_prompts", "video_prompts"):
            if key in media_prompts and not isinstance(media_prompts[key], list):
                failures.append(f"media_prompts.{key} must be an array")
    else:
        failures.append("media_prompts must be an object")

    publishing_package = package.get("publishing_package")
    if not isinstance(publishing_package, dict):
        failures.append("publishing_package must be an object")

    qa = package.get("qa")
    if isinstance(qa, dict):
        status = qa.get("status")
        if status not in QA_STATUSES:
            failures.append(f"qa.status must be one of {sorted(QA_STATUSES)}")
        if "blockers" not in qa or not isinstance(qa["blockers"], list):
            failures.append("qa.blockers must be an array")
    else:
        failures.append("qa must be an object")

    return failures


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate a production-package.json file.")
    parser.add_argument(
        "path",
        help="Path to production-package.json or a run directory containing it.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    path = Path(args.path)
    if path.is_dir():
        path = path / "production-package.json"

    if not path.exists():
        print(f"Package not found: {path}", file=sys.stderr)
        return 1

    try:
        package = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON: {exc}", file=sys.stderr)
        return 1

    failures = validate_package(package)
    if failures:
        print("Package validation failed:")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print(f"Package validation passed: {path}")
    print(f"Run id: {package['run_id']}")
    print(f"Sources: {len(package['sources'])}")
    print(f"QA status: {package['qa']['status']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

