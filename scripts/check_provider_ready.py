#!/usr/bin/env python3
"""Check whether a provider role is configured before running an adapter."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROLES = ("llm", "image", "video", "tts", "subtitles", "bgm", "youtube")
NO_KEY_PROVIDERS = ("local", "manual")


def load_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check provider readiness.")
    parser.add_argument("--role", choices=ROLES, required=True, help="Provider role to check.")
    parser.add_argument(
        "--config",
        default="config/provider-settings.local.json",
        help="Path to provider settings JSON.",
    )
    parser.add_argument(
        "--require-key",
        action="store_true",
        help="Require an API key even for Local or Manual providers.",
    )
    return parser.parse_args(argv)


def provider_allows_no_key(provider: str) -> bool:
    provider_lower = provider.lower()
    return any(marker in provider_lower for marker in NO_KEY_PROVIDERS)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    config_path = Path(args.config)

    if not config_path.exists():
        print(f"Provider settings not found: {config_path}", file=sys.stderr)
        print("Configure providers at /settings before running adapters.", file=sys.stderr)
        return 1

    try:
        settings = load_json(config_path)
    except ValueError as exc:
        print(exc, file=sys.stderr)
        return 1

    role = settings.get("roles", {}).get(args.role)
    if not isinstance(role, dict):
        print(f"Provider role missing: {args.role}", file=sys.stderr)
        return 1

    failures: list[str] = []
    provider = str(role.get("provider", "")).strip()
    model = str(role.get("model", "")).strip()
    api_key = str(role.get("apiKey", "")).strip()

    if role.get("enabled") is not True:
        failures.append(f"{args.role} provider is not enabled")
    if not provider:
        failures.append(f"{args.role} provider is empty")
    if not api_key and (args.require_key or not provider_allows_no_key(provider)):
        failures.append(f"{args.role} API key is missing")

    if failures:
        print(f"Provider readiness failed: {args.role}")
        for failure in failures:
            print(f" - {failure}")
        return 1

    model_suffix = f", model={model}" if model else ""
    key_suffix = ", key=present" if api_key else ", key=not required"
    print(f"Provider ready: {args.role} provider={provider}{model_suffix}{key_suffix}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
