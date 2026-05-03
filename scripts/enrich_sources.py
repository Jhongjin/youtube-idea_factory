#!/usr/bin/env python3
"""Enrich manual YouTube seed sources with no-key oEmbed metadata."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OEMBED_URL = "https://www.youtube.com/oembed"


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch_oembed(url: str, timeout: int) -> dict:
    query = urlencode({"url": url, "format": "json"})
    request = Request(
        f"{OEMBED_URL}?{query}",
        headers={"User-Agent": "youtube-idea-factory/0.1"},
    )
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def source_rows(sources: list[dict]) -> str:
    lines = [
        "| Rank | URL | Video ID | Title | Channel | Reason | Transcript |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for source in sources:
        values = [
            str(source.get("rank", "")),
            str(source.get("url", "")),
            str(source.get("video_id", "")),
            str(source.get("title", "")),
            str(source.get("channel", "")),
            str(source.get("inclusion_reason", "")),
            str(source.get("transcript_status", "")),
        ]
        escaped = [value.replace("\n", " ").replace("|", "\\|") for value in values]
        lines.append("| " + " | ".join(escaped) + " |")
    return "\n".join(lines)


def update_research_markdown(run_dir: Path, sources: list[dict]) -> None:
    research_path = run_dir / "01-research.md"
    if not research_path.exists():
        return

    content = research_path.read_text(encoding="utf-8")
    marker = "## Source Videos"
    next_marker = "\n## Research Summary"
    if marker not in content or next_marker not in content:
        return

    before = content.split(marker, 1)[0]
    after = content.split(next_marker, 1)[1]
    updated = f"{before}{marker}\n\n{source_rows(sources)}\n{next_marker}{after}"
    research_path.write_text(updated, encoding="utf-8")


def enrich_run(run_dir: Path, timeout: int) -> tuple[int, list[str]]:
    sources_path = run_dir / "sources.json"
    package_path = run_dir / "production-package.json"

    if not sources_path.exists():
        raise FileNotFoundError(f"Missing sources.json: {sources_path}")
    if not package_path.exists():
        raise FileNotFoundError(f"Missing production-package.json: {package_path}")

    sources = load_json(sources_path)
    package = load_json(package_path)
    if not isinstance(sources, list):
        raise ValueError("sources.json must contain an array")
    if not isinstance(package, dict):
        raise ValueError("production-package.json must contain an object")

    changed = 0
    failures: list[str] = []

    for source in sources:
        if not isinstance(source, dict):
            continue
        url = str(source.get("url", ""))
        if not url:
            continue
        try:
            metadata = fetch_oembed(url, timeout)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            source["metadata_status"] = "failed"
            failures.append(f"{url}: {exc}")
            continue

        title = str(metadata.get("title", "")).strip()
        author = str(metadata.get("author_name", "")).strip()
        if title and source.get("title") != title:
            source["title"] = title
            changed += 1
        if author and source.get("channel") != author:
            source["channel"] = author
            changed += 1
        source["metadata_status"] = "oembed_enriched"
        source["thumbnail_url"] = metadata.get("thumbnail_url", "")

    package["sources"] = sources
    write_json(sources_path, sources)
    write_json(package_path, package)
    update_research_markdown(run_dir, sources)

    return changed, failures


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enrich run source metadata with YouTube oEmbed.")
    parser.add_argument("run", help="Run id or path to a run directory.")
    parser.add_argument("--timeout", type=int, default=15, help="HTTP timeout in seconds.")
    return parser.parse_args(argv)


def resolve_run_dir(value: str) -> Path:
    candidate = Path(value)
    if candidate.exists():
        return candidate.resolve()
    return (ROOT / "runs" / value).resolve()


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    run_dir = resolve_run_dir(args.run)
    if not run_dir.exists():
        print(f"Run not found: {run_dir}", file=sys.stderr)
        return 1

    changed, failures = enrich_run(run_dir, args.timeout)
    print(f"Run: {run_dir.name}")
    print(f"Updated fields: {changed}")
    if failures:
        print("Metadata failures:")
        for failure in failures:
            print(f" - {failure}")
    return 0 if not failures else 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

