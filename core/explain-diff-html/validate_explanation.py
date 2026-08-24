#!/usr/bin/env python3
"""validate_explanation.py — the hard gate for /explain-diff-html pages.

A generated explanation page is deliverable only if this exits 0. Stdlib only;
no network, no config. Run it as:

    python3 validate_explanation.py /tmp/2026-01-01-explanation-slug.html

Checks (failures block, warnings do not):

  document      doctype, closing </html>, non-empty <title>
  offline       no remote asset, @import, url(https://…), fetch/XHR/WebSocket
  code-blocks   a CSS rule targeting `pre` sets white-space: pre | pre-wrap
  diagrams      no box-drawing characters or ASCII art inside <pre>
  structure     required sections present; every #anchor link resolves
  quiz          exactly 5 well-formed questions, no all/none-of-the-above
  quiz-position correct slot used <3 times and spread over >=3 distinct slots
  quiz-length   correct option is the single longest in at most half the questions
  quiz-leak     no data-correct, no `correct` class, no correctness in aria-label,
                and never only-the-answer rendered in static markup
  a11y          (warn) some :focus or :focus-visible styling exists
"""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser

REQUIRED_SECTION_IDS = ("the-change", "why", "how-it-works", "quiz")

ASSET_URL_ATTRS = {"src", "href", "srcset", "imagesrcset", "data", "poster"}
# srcset/imagesrcset hold a COMMA-SEPARATED candidate list, each entry a URL
# optionally followed by a descriptor ("a.png 1x, https://cdn/b.png 2x").
# Testing the whole attribute with an anchored regex only inspects the first
# candidate, so every later one is unchecked — a remote CDN in position two
# passed the offline gate. Split these before validating.
SRCSET_ATTRS = {"srcset", "imagesrcset"}
LOCAL_URL = re.compile(r"^(#|/|\.{1,2}/|[A-Za-z0-9_\-.]+$|data:|blob:)")
REMOTE_URL = re.compile(r"^(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?//|^https?:", re.I)
BOX_DRAWING = re.compile("[─-▟■-◿⬀-⯿]")
ASCII_ART_LINE = re.compile(r"^[\s|+\-=*/\\_<>^v.'`~]*$")
# The \b belongs to the bare identifiers only. Anchoring it after `fetch\s*\(`
# would never match: `(` and the character after it are both non-word, so there
# is no boundary there and the whole alternative silently never fires.
BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.S)
LINE_COMMENT = re.compile(r"//[^\n]*")


def _normalize_js(src: str) -> str:
    """Strip comments and collapse whitespace for the offline scan only.

    Never use this for anything the reader sees -- it destroys formatting. Its
    single job is to make whitespace- and comment-based spellings of the same
    network call converge before NETWORK_CALL runs.

    Scans character by character tracking string state, because regex
    substitution cannot tell a comment from comment-like text inside a string.
    `const a="/*"; fetch("https://x"); const b="*/";` is valid code whose fetch
    a naive block-comment regex deletes -- the page then PASSES the offline gate
    while fetching at load time. Erasing real calls is the dangerous direction,
    so string contents are preserved verbatim and only true comments removed.
    """
    out = []
    i, n = 0, len(src)
    quote = None  # currently open string delimiter, or None
    while i < n:
        c = src[i]
        if quote:
            out.append(c)
            if c == "\\" and i + 1 < n:      # escape: copy the pair intact
                out.append(src[i + 1])
                i += 2
                continue
            if c == quote:
                quote = None
            i += 1
            continue
        if c in "\"'`":
            quote = c
            out.append(c)
            i += 1
            continue
        if c == "/" and i + 1 < n:
            if src[i + 1] == "*":
                end = src.find("*/", i + 2)
                i = n if end == -1 else end + 2
                out.append(" ")
                continue
            if src[i + 1] == "/":
                end = src.find("\n", i)
                i = n if end == -1 else end
                out.append(" ")
                continue
        out.append(c)
        i += 1
    return re.sub(r"\s+", " ", "".join(out))


NETWORK_CALL = re.compile(
    r"\bfetch\s*\(|\b(?:XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon)\b"
    # ES module loading is a network call the APIs above never mention. Both
    # `import("https://…")` and `import x from "https://…"` fetch at load time,
    # and a page using them passed the offline gate while depending on a CDN.
    r"|\bimport\s*\(\s*['\"](?://|https?:)"
    r"|\bimport\b[^;\n]*?\bfrom\s*['\"](?://|https?:)"
    r"|\bimport\s*['\"](?://|https?:)"
)
CSS_REMOTE_URL = re.compile(r"url\(\s*['\"]?\s*(?://|https?:)", re.I)
CSS_IMPORT = re.compile(r"@import\b", re.I)
CSS_RULE = re.compile(r"([^{}]+)\{([^{}]*)\}", re.S)
PRE_SELECTOR = re.compile(r"(?:^|[\s,>+~])pre(?:$|[\s,:.\[#>+~])")
WHITE_SPACE_DECL = re.compile(r"white-space\s*:\s*(pre|pre-wrap)\s*(?:;|$|!)", re.I)
CATCHALL_OPTION = re.compile(r"\b(?:all|none|any)\s+of\s+the\s+above\b", re.I)
CORRECT_CLASS = re.compile(r"(?:^|[-_])correct(?:$|[-_])|^correct$", re.I)


class Page(HTMLParser):
    """Collects everything the checks need in one pass."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.ids: set[str] = set()
        self.anchor_targets: list[str] = []
        self.pre_blocks: list[str] = []
        self.styles: list[str] = []
        self.scripts: list[str] = []
        self.quiz_json = ""
        self.remote_assets: list[str] = []
        self.inline_handlers: list[str] = []
        self.leak_attrs: list[str] = []
        self.has_viewport = False
        self._stack: list[str] = []
        self._capture: str | None = None
        self._buf: list[str] = []

    # -- helpers ---------------------------------------------------------
    def _flush(self) -> None:
        text = "".join(self._buf)
        if self._capture == "title":
            self.title += text
        elif self._capture == "pre":
            self.pre_blocks.append(text)
        elif self._capture == "style":
            self.styles.append(text)
        elif self._capture == "quiz":
            self.quiz_json += text
        elif self._capture == "script":
            self.scripts.append(text)
        self._buf = []
        self._capture = None

    # -- HTMLParser ------------------------------------------------------
    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        self._stack.append(tag)

        if "id" in a and a["id"]:
            self.ids.add(a["id"])
        for name, value in a.items():
            if name.startswith("on"):
                self.inline_handlers.append(f"<{tag} {name}>")
            if name == "data-correct":
                self.leak_attrs.append(f"<{tag} data-correct>")
            if name == "aria-label" and re.search(r"\bcorrect\b|\bincorrect\b", value, re.I):
                self.leak_attrs.append(f'<{tag} aria-label="{value[:40]}">')
            if name == "class":
                for token in value.split():
                    if CORRECT_CLASS.search(token):
                        self.leak_attrs.append(f"<{tag} class={token}>")

        if tag == "meta" and a.get("name", "").lower() == "viewport":
            self.has_viewport = True

        if tag == "a":
            href = a.get("href", "")
            if href.startswith("#"):
                self.anchor_targets.append(href[1:])
            # Outbound <a href> links are references, not dependencies — allowed.
        else:
            for attr in ASSET_URL_ATTRS & a.keys():
                raw = a[attr] or ""
                if attr in SRCSET_ATTRS:
                    # Each candidate is "<url> [descriptor]"; the URL is the
                    # first whitespace-delimited token of each comma-separated
                    # entry. Validate every one, not just the first.
                    candidates = [
                        part.strip().split()[0]
                        for part in raw.split(",")
                        if part.strip()
                    ]
                else:
                    candidates = [raw.strip()]
                for url in candidates:
                    if url and REMOTE_URL.match(url) and not LOCAL_URL.match(url):
                        self.remote_assets.append(f"<{tag} {attr}={url[:60]}>")

        if tag == "title":
            self._capture = "title"
        elif tag == "pre":
            self._capture = "pre"
        elif tag == "style":
            self._capture = "style"
        elif tag == "script":
            stype = a.get("type", "").lower()
            if stype == "application/json" and a.get("id") == "quiz-data":
                self._capture = "quiz"
            elif not a.get("src"):
                self._capture = "script"

    def handle_endtag(self, tag: str) -> None:
        if tag in ("title", "pre", "style", "script") and self._capture:
            self._flush()
        if tag in self._stack:
            while self._stack and self._stack.pop() != tag:
                pass

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._buf.append(data)


class Report:
    def __init__(self) -> None:
        self.failures: list[tuple[str, str]] = []
        self.warnings: list[tuple[str, str]] = []

    def fail(self, check: str, message: str) -> None:
        self.failures.append((check, message))

    def warn(self, check: str, message: str) -> None:
        self.warnings.append((check, message))


def check_document(raw: str, page: Page, r: Report) -> None:
    if not re.match(r"\s*<!doctype\s+html", raw, re.I):
        r.fail("document", "no <!doctype html> at the top — the page may be a truncated write")
    if "</html>" not in raw.lower():
        r.fail("document", "no closing </html> — the write was truncated")
    if not page.title.strip():
        r.fail("document", "<title> is missing or empty")
    if not page.has_viewport:
        r.warn("document", "no <meta name=viewport> — the page will not scale on a phone")
    for handler in page.inline_handlers[:5]:
        r.warn("document", f"inline event handler {handler} — bind listeners in the script instead")


def check_offline(raw: str, page: Page, r: Report) -> None:
    for asset in page.remote_assets:
        r.fail("offline", f"remote asset {asset} — the page must render with the network off")
    css = "\n".join(page.styles)
    if CSS_IMPORT.search(css):
        r.fail("offline", "@import in a <style> block — inline the rules instead")
    if CSS_REMOTE_URL.search(css):
        r.fail("offline", "url(https://…) in CSS — embed the asset as a data: URI instead")
    for script in page.scripts:
        # Normalize before matching: strip JS comments and collapse newlines, so
        # a valid multiline `import {\n x \n} from "https://…"` and a
        # `import(/* webpackIgnore */ "https://…")` are seen for what they are.
        # Matching the raw text only ever caught the single-line spellings while
        # both of these fetched a remote module at load time.
        hit = NETWORK_CALL.search(_normalize_js(script))
        if hit:
            r.fail("offline", f"network call `{hit.group(0)}` in an inline script")


def check_code_blocks(page: Page, r: Report) -> None:
    if not page.pre_blocks:
        return
    for selectors, body in CSS_RULE.findall("\n".join(page.styles)):
        if PRE_SELECTOR.search(selectors.strip() + " ") and WHITE_SPACE_DECL.search(body):
            return
    r.fail(
        "code-blocks",
        "no CSS rule targeting `pre` sets white-space: pre | pre-wrap — "
        "every code sample collapses to one line for the reader",
    )


def check_diagrams(page: Page, r: Report) -> None:
    for block in page.pre_blocks:
        hit = BOX_DRAWING.search(block)
        if hit:
            r.fail("diagrams", f"box-drawing character {hit.group(0)!r} inside <pre> — draw it in HTML + CSS")
            continue
        for line in block.splitlines():
            stripped = line.strip()
            art_chars = len([c for c in stripped if not c.isspace()])
            if art_chars >= 8 and ASCII_ART_LINE.match(stripped):
                r.fail("diagrams", f"ASCII art inside <pre>: {stripped[:40]!r} — draw it in HTML + CSS")
                break


def check_structure(page: Page, r: Report) -> None:
    for section in REQUIRED_SECTION_IDS:
        if section not in page.ids:
            r.fail("structure", f"required section id #{section} is missing")
    for target in page.anchor_targets:
        if target and target not in page.ids:
            r.fail("structure", f"link to #{target} points at an id that does not exist")


def load_quiz(page: Page, r: Report) -> list[dict] | None:
    if not page.quiz_json.strip():
        r.fail("quiz", 'no <script type="application/json" id="quiz-data"> block')
        return None
    try:
        data = json.loads(page.quiz_json)
    except json.JSONDecodeError as exc:
        r.fail("quiz", f"quiz-data is not valid JSON: {exc}")
        return None
    if not isinstance(data, list):
        r.fail("quiz", "quiz-data must be a JSON array of questions")
        return None
    return data


def check_quiz(quiz: list[dict], r: Report) -> bool:
    if len(quiz) != 5:
        r.fail("quiz", f"expected exactly 5 questions, found {len(quiz)}")
        return False
    ok = True
    for i, q in enumerate(quiz):
        where = f"question {i + 1}"
        if not isinstance(q, dict):
            r.fail("quiz", f"{where} is not an object")
            ok = False
            continue
        if not str(q.get("question", "")).strip():
            r.fail("quiz", f"{where} has an empty `question`")
            ok = False
        options = q.get("options")
        if not isinstance(options, list) or len(options) < 3 or not all(str(o).strip() for o in options):
            r.fail("quiz", f"{where} needs an `options` list of 3+ non-empty strings")
            ok = False
            continue
        for opt in options:
            if CATCHALL_OPTION.search(str(opt)):
                r.fail("quiz", f"{where} uses an all/none-of-the-above option")
                ok = False
        answer = q.get("answer")
        if not isinstance(answer, int) or isinstance(answer, bool) or not 0 <= answer < len(options):
            r.fail("quiz", f"{where} has an `answer` that does not index `options`")
            ok = False
        if not str(q.get("explanation", "")).strip():
            r.fail("quiz", f"{where} has an empty `explanation` — the page must say why")
            ok = False
    return ok


def check_quiz_position(quiz: list[dict], r: Report) -> None:
    answers = [q["answer"] for q in quiz]
    counts: dict[int, int] = {}
    for a in answers:
        counts[a] = counts.get(a, 0) + 1
    worst = max(counts.values())
    if worst >= 3:
        slot = max(counts, key=lambda k: counts[k])
        r.fail("quiz-position", f"slot {slot} is the answer {worst} times — position becomes the answer key")
    if len(counts) < 3:
        r.fail("quiz-position", f"answers use only {len(counts)} distinct slots — spread them over at least 3")


def check_quiz_length(quiz: list[dict], r: Report) -> None:
    longest = 0
    for q in quiz:
        options = [str(o) for o in q["options"]]
        target = len(options[q["answer"]])
        if target > max(len(o) for i, o in enumerate(options) if i != q["answer"]):
            longest += 1
    if longest * 2 > len(quiz):
        r.fail(
            "quiz-length",
            f"the correct option is the single longest in {longest} of {len(quiz)} questions — "
            "the quiz is scoreable without reading the page",
        )


def check_quiz_leak(raw: str, page: Page, quiz: list[dict], r: Report) -> None:
    for attr in page.leak_attrs[:8]:
        r.fail("quiz-leak", f"correctness marker in static markup: {attr}")
    markup = raw
    if page.quiz_json:
        markup = markup.replace(page.quiz_json, "")
    for i, q in enumerate(quiz):
        options = [str(o) for o in q["options"]]
        present = [o for o in options if o.strip() and o.strip() in markup]
        answer_text = options[q["answer"]].strip()
        if present == [answer_text]:
            r.fail("quiz-leak", f"question {i + 1} renders only its correct option in static markup")


def check_a11y(page: Page, r: Report) -> None:
    css = "\n".join(page.styles)
    if ":focus" not in css:
        r.warn("a11y", "no :focus or :focus-visible styling — keyboard users cannot see where they are")


def validate(path: str) -> Report:
    r = Report()
    try:
        with open(path, encoding="utf-8") as fh:
            raw = fh.read()
    except OSError as exc:
        r.fail("document", f"cannot read {path}: {exc}")
        return r

    page = Page()
    page.feed(raw)
    page.close()

    check_document(raw, page, r)
    check_offline(raw, page, r)
    check_code_blocks(page, r)
    check_diagrams(page, r)
    check_structure(page, r)
    check_a11y(page, r)

    quiz = load_quiz(page, r)
    if quiz is not None and check_quiz(quiz, r):
        check_quiz_position(quiz, r)
        check_quiz_length(quiz, r)
        check_quiz_leak(raw, page, quiz, r)
    return r


def main(argv: list[str]) -> int:
    paths = [a for a in argv[1:] if not a.startswith("-")]
    if not paths:
        print("usage: validate_explanation.py PAGE.html [PAGE.html ...]", file=sys.stderr)
        return 2

    failed = False
    for path in paths:
        r = validate(path)
        print(f"== {path}")
        for check, message in r.warnings:
            print(f"  WARN  [{check}] {message}")
        for check, message in r.failures:
            print(f"  FAIL  [{check}] {message}")
        if r.failures:
            failed = True
            print(f"  -> {len(r.failures)} failure(s); the page is not deliverable")
        else:
            print(f"  -> PASS ({len(r.warnings)} warning(s))")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
