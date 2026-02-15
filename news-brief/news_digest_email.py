#!/usr/bin/env python3
"""Build and email a daily category synthesis digest."""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import smtplib
import ssl
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

CONFIG_PATH = Path("docs/news-brief/config.json")
USER_AGENT = "Mozilla/5.0 (compatible; NewsDigestBot/1.0)"
MAX_STORIES_PER_SOURCE = 5


def load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def normalize_source(source: str | dict) -> dict:
    if isinstance(source, str):
        return {
            "name": urllib.parse.urlparse(source).netloc,
            "rss": None,
            "website": source,
        }

    website = source.get("website", source.get("rss", ""))
    name = source.get("name") or urllib.parse.urlparse(website).netloc
    return {
        "name": name,
        "rss": source.get("rss"),
        "website": website,
    }


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_feed(feed_xml: str) -> list[dict]:
    root = ET.fromstring(feed_xml)
    items = []
    entries = root.findall(".//item") or root.findall(".//entry")
    for item in entries[:MAX_STORIES_PER_SOURCE]:
        title = (item.findtext("title") or "Untitled story").strip()
        link = (item.findtext("link") or "").strip()
        if not link:
            link_el = item.find("link")
            link = link_el.get("href", "") if link_el is not None else ""
        description = (
            item.findtext("description")
            or item.findtext("summary")
            or item.findtext("content")
            or ""
        )
        description = re.sub(r"<[^>]*>", " ", description)
        description = re.sub(r"\s+", " ", description).strip()
        items.append({"title": title, "link": link, "description": description})
    return items


def discover_feed_links(website_url: str) -> list[str]:
    try:
        html_text = fetch_text(website_url)
    except Exception:
        return []

    links = []
    for href, feed_type in re.findall(r"<link[^>]+href=['\"]([^'\"]+)['\"][^>]*type=['\"]([^'\"]+)['\"][^>]*>", html_text, re.IGNORECASE):
        if any(t in feed_type.lower() for t in ["rss", "atom", "xml"]):
            links.append(urllib.parse.urljoin(website_url, href))

    origin = urllib.parse.urlsplit(website_url)
    base = f"{origin.scheme}://{origin.netloc}" if origin.scheme and origin.netloc else website_url
    links.extend([f"{base}/feed", f"{base}/rss", f"{base}/rss.xml", f"{base}/feed.xml"])

    unique = []
    seen = set()
    for link in links:
        if link and link not in seen:
            seen.add(link)
            unique.append(link)
    return unique


def resolve_feed_url(source: dict) -> str:
    candidates = []
    if source.get("rss"):
        candidates.append(source["rss"])
    if source.get("website"):
        candidates.extend(discover_feed_links(source["website"]))

    for candidate in candidates:
        try:
            items = parse_feed(fetch_text(candidate))
            if items:
                return candidate
        except Exception:
            continue

    raise ValueError(f"No RSS feed found for {source['name']}")


def call_openai_synthesis(category: str, stories: list[dict], api_key: str) -> str:
    story_lines = "\n".join(
        f"- {s['source']}: {s['title']} | {s['description']}" for s in stories
    )
    prompt = (
        "You are preparing a daily news digest email. "
        "Translate non-English content into English first, then write exactly one paragraph "
        "(4-6 sentences) synthesizing the most important developments and shared themes. "
        "Avoid bullet points and avoid listing every headline. "
        f"Category: {category}\nStories:\n{story_lines}"
    )
    payload = json.dumps(
        {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": "Write concise, neutral summaries in English."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": USER_AGENT,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        data = json.loads(response.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"].strip()


def fallback_synthesis(stories: list[dict]) -> str:
    if not stories:
        return "No reliable stories were found for this category in the last 24 hours."
    snippets = [story["title"] for story in stories[:8]]
    joined = "; ".join(snippets)
    return (
        f"Across monitored sources, the day centered on: {joined}. "
        "Taken together, coverage points to several fast-moving developments with overlapping impact "
        "across this category."
    )


def collect_category(category: dict, api_key: str | None) -> dict:
    stories = []
    failed_sources = 0
    for source_input in category.get("sources", []):
        source = normalize_source(source_input)
        try:
            feed_url = resolve_feed_url(source)
            items = parse_feed(fetch_text(feed_url))
            for item in items:
                item["source"] = source["name"]
                stories.append(item)
        except Exception as exc:  # noqa: BLE001
            failed_sources += 1
            print(f"Warning: failed source {source['name']}: {exc}", file=sys.stderr)

    if api_key:
        try:
            synthesis = call_openai_synthesis(category["name"], stories, api_key)
        except Exception as exc:  # noqa: BLE001
            print(f"Warning: OpenAI synthesis failed for {category['name']}: {exc}", file=sys.stderr)
            synthesis = fallback_synthesis(stories)
    else:
        synthesis = fallback_synthesis(stories)

    return {
        "name": category["name"],
        "story_count": len(stories),
        "failed_sources": failed_sources,
        "synthesis": synthesis,
    }


def build_email_html(results: list[dict]) -> str:
    blocks = []
    for result in results:
        blocks.append(
            f"""
            <h2 style=\"margin-bottom:6px;\">{html.escape(result['name'])}</h2>
            <p style=\"color:#5b6780;margin-top:0;\">Analyzed stories: {result['story_count']} | Failed sources: {result['failed_sources']}</p>
            <p style=\"line-height:1.5;\">{html.escape(result['synthesis'])}</p>
            """
        )
    updated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return f"""
    <html><body style=\"font-family:Arial,sans-serif;color:#1f2a44;\">
      <h1>Daily Lead Story Digest</h1>
      <p>Generated: {updated}</p>
      {''.join(blocks)}
    </body></html>
    """


def send_email(subject: str, html_body: str) -> None:
    host = os.environ["SMTP_HOST"]
    port = int(os.environ.get("SMTP_PORT", "465"))
    user = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASSWORD"]
    from_email = os.environ["FROM_EMAIL"]
    to_email = os.environ["TO_EMAIL"]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(host, port, context=context) as server:
        server.login(user, password)
        server.sendmail(from_email, [to_email], msg.as_string())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print digest instead of sending email")
    args = parser.parse_args()

    config = load_config()
    api_key = os.environ.get("OPENAI_API_KEY")

    results = [collect_category(category, api_key) for category in config.get("categories", [])]
    html_body = build_email_html(results)

    if args.dry_run:
        print(html_body)
        return 0

    send_email("Daily Lead Story Digest (3 AM EST)", html_body)
    print("Digest email sent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
