#!/usr/bin/env python3
"""Lists every field in a page's forms, so a quote or booking can be filled by script.

Usage:  python3 scripts/form-fields.py https://site/get-quote
"""
import sys
import urllib.request
from html.parser import HTMLParser

# Cloudflare blocks requests without a browser user agent.
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"}


class Forms(HTMLParser):
    def __init__(self):
        super().__init__()
        self.step = 0
        self.in_form = False
        self.form_action = ""
        self.fields = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "section" and a.get("data-step"):
            self.step = int(a["data-step"])
        if tag == "form":
            self.in_form = True
            self.form_action = a.get("action", "")
        if not self.in_form:
            return
        if tag in ("input", "select", "textarea"):
            name = a.get("name")
            if not name:
                return
            self.fields.append({
                "step": self.step,
                "tag": tag,
                "name": name,
                "type": a.get("type", "text"),
                "required": "required" in a,
                "value": a.get("value", ""),
                "maxlength": a.get("maxlength", ""),
            })

    def handle_endtag(self, tag):
        if tag == "form":
            self.in_form = False


def main(url):
    request = urllib.request.Request(url, headers=HEADERS)
    html = urllib.request.urlopen(request, timeout=20).read().decode("utf-8", "replace")
    p = Forms()
    p.feed(html)
    print(f"{len(p.fields)} fields in form {p.form_action}\n")
    print(f"{'step':<5}{'name':<26}{'type':<10}{'req':<5}{'value'}")
    print("-" * 78)
    for f in p.fields:
        print(f"{f['step']:<5}{f['name']:<26}{f['type']:<10}{'*' if f['required'] else '':<5}{f['value'][:28]}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787/get-quote")
