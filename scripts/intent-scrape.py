import argparse
import json
import re
import sys
from urllib.parse import urlparse


def validate_url(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("URL inválida")
    return value


def normalize_text(value: str) -> str:
    value = re.sub(r"[\t ]+", " ", value or "")
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()[:12000]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("--dynamic", action="store_true")
    args = parser.parse_args()
    url = validate_url(args.url)

    if args.dynamic:
        from scrapling.fetchers import DynamicFetcher
        fetch = getattr(DynamicFetcher, 'get', None) or getattr(DynamicFetcher, 'fetch')
        page = fetch(url, headless=True, network_idle=True)
    else:
        from scrapling.fetchers import Fetcher
        fetch = getattr(Fetcher, 'get', None) or getattr(Fetcher, 'fetch')
        page = fetch(url)

    title = ""
    try:
        title = page.css("title::text").get() or ""
    except Exception:
        pass

    content = ""
    try:
        content = page.markdown(main_content_only=True)
    except Exception:
        try:
            texts = page.css("body *::text").getall()
            content = "\n".join(texts)
        except Exception:
            content = str(page)

    print(json.dumps({"url": url, "title": normalize_text(title)[:500], "content": normalize_text(content)}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
