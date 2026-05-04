#!/usr/bin/env python3
"""Check Vercel/Supabase deployment readiness without printing secrets."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_env_files() -> dict[str, str]:
    values: dict[str, str] = {}
    for filename in (".env", ".env.local"):
        path = ROOT / filename
        if not path.exists():
            continue
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def env_value(name: str, file_values: dict[str, str]) -> str:
    return os.environ.get(name, "").strip() or file_values.get(name, "").strip()


def current_branch() -> str:
    try:
        return subprocess.check_output(
            ["git", "branch", "--show-current"],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return ""


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check deployment readiness.")
    parser.add_argument("--target", choices=["local", "vercel"], default="vercel")
    parser.add_argument(
        "--production-branch",
        default="main",
        help="Git branch that Vercel treats as production.",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    file_values = read_env_files()
    storage_mode = env_value("APP_STORAGE_MODE", file_values) or "local"
    branch = current_branch()
    blockers: list[str] = []
    warnings: list[str] = []

    required_files = [
        "docs/DEPLOYMENT.md",
        "docs/templates/supabase-schema.sql",
        "app/api/health/deployment/route.ts",
    ]
    for relative in required_files:
        if not (ROOT / relative).exists():
            blockers.append(f"Missing deployment file: {relative}")

    if args.target == "vercel" and storage_mode == "local":
        blockers.append("APP_STORAGE_MODE=local is not durable on Vercel; use supabase before production operations.")

    if storage_mode == "supabase":
        if not env_value("NEXT_PUBLIC_SUPABASE_URL", file_values):
            blockers.append("NEXT_PUBLIC_SUPABASE_URL is missing")
        if not env_value("SUPABASE_SERVICE_ROLE_KEY", file_values):
            blockers.append("SUPABASE_SERVICE_ROLE_KEY is missing")

    service_key = env_value("SUPABASE_SERVICE_ROLE_KEY", file_values)
    anon_key = env_value("NEXT_PUBLIC_SUPABASE_ANON_KEY", file_values)
    if service_key and service_key == anon_key:
        blockers.append("SUPABASE_SERVICE_ROLE_KEY must not equal NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not env_value("YOUTUBE_API_KEY", file_values):
        warnings.append("YOUTUBE_API_KEY is missing; YouTube Finder needs env or provider settings.")
    if branch and branch != args.production_branch:
        warnings.append(
            f"Current branch is {branch}; Vercel production usually deploys {args.production_branch}."
        )

    print("Deployment readiness")
    print(f"Target: {args.target}")
    print(f"Storage mode: {storage_mode}")
    print(f"Git branch: {branch or 'unknown'}")
    for warning in warnings:
        print(f"WARNING: {warning}")
    if blockers:
        print("BLOCKED:")
        for blocker in blockers:
            print(f" - {blocker}")
        return 1

    print("Deployment readiness passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
