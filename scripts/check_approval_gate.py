#!/usr/bin/env python3
"""Check deterministic approval gates before paid generation, render, or publishing."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


GATES = ("generation", "render", "publish")


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc


def resolve_run_dir(path: Path) -> Path:
    if path.is_file() and path.name == "production-package.json":
        return path.parent
    return path


def approval_failures(approvals: dict[str, Any], gate: str) -> list[str]:
    failures: list[str] = []
    approval = approvals.get(gate)
    if not isinstance(approval, dict):
        return [f"Missing approval section: {gate}"]

    if approval.get("approved") is not True:
        failures.append(f"{gate} approval is not true")
    if not str(approval.get("approved_by", "")).strip():
        failures.append(f"{gate} approval is missing approved_by")
    if not str(approval.get("approved_at", "")).strip():
        failures.append(f"{gate} approval is missing approved_at")

    return failures


def package_failures(package: dict[str, Any], gate: str) -> list[str]:
    failures: list[str] = []
    qa = package.get("qa", {})
    media_prompts = package.get("media_prompts", {})
    publishing = package.get("publishing_package", {})
    render_manifest = package.get("render_manifest", {})

    if not isinstance(qa, dict):
        return ["package.qa must be an object"]

    if qa.get("status") == "blocked":
        failures.append("qa.status is blocked")

    image_count = len(media_prompts.get("image_prompts", [])) if isinstance(media_prompts, dict) else 0
    video_count = len(media_prompts.get("video_prompts", [])) if isinstance(media_prompts, dict) else 0
    if gate in {"generation", "render", "publish"} and image_count + video_count == 0:
        failures.append("media prompts are empty")

    if gate in {"render", "publish"}:
        if not isinstance(render_manifest, dict) or render_manifest.get("render_ready") is not True:
            failures.append("render_manifest.render_ready must be true")
        title_count = (
            len(publishing.get("title_candidates", [])) if isinstance(publishing, dict) else 0
        )
        if title_count == 0:
            failures.append("publishing title candidates are empty")

    if gate == "publish" and qa.get("publish_readiness") != "ready":
        failures.append("qa.publish_readiness must be ready for publishing")

    return failures


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check a run approval gate.")
    parser.add_argument("path", help="Run directory or production-package.json path.")
    parser.add_argument(
        "--gate",
        choices=GATES,
        required=True,
        help="Gate to check before invoking an external adapter.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    run_dir = resolve_run_dir(Path(args.path))
    package_path = run_dir / "production-package.json"
    approvals_path = run_dir / "approvals.json"

    if not package_path.exists():
        print(f"Package not found: {package_path}", file=sys.stderr)
        return 1
    if not approvals_path.exists():
        print(f"Approvals file not found: {approvals_path}", file=sys.stderr)
        print("Create it from docs/templates/approvals.json before running external adapters.", file=sys.stderr)
        return 1

    try:
        package = load_json(package_path)
        approvals = load_json(approvals_path)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 1

    failures = approval_failures(approvals, args.gate)
    failures.extend(package_failures(package, args.gate))

    if failures:
        print(f"Approval gate failed: {args.gate}")
        for failure in failures:
            print(f" - {failure}")
        return 1

    print(f"Approval gate passed: {args.gate}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
