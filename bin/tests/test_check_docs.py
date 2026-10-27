"""Regression checks for documentation omissions and local-link diagnostics."""

from pathlib import Path
import runpy
import tempfile
import unittest

DOCS = runpy.run_path(str(Path(__file__).resolve().parents[1] / "check-docs"))


class DocumentationChecks(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
        return path

    def overview(self):
        self.write("core/example/SKILL.md", "# Example\n")
        self.write("roles/qa.md", "# QA\n")
        self.write("README.md", "[skill](core/example/SKILL.md) [role](roles/qa.md)\n")
        self.write("docs/skill-map.md", "[skill](../core/example/SKILL.md) [role](../roles/qa.md)\n")
        self.write("VERSION", "1.0.0\n")
        return self.write("docs/skill-map.html", '''kstack · v1.0.0 ·
const SKILLS = [
  { n:"/example", href:"../core/example/SKILL.md" },
  { n:"qa", href:"../roles/qa.md" },
];
''')

    def test_complete_catalog_and_links(self):
        self.overview()
        self.assertEqual(DOCS["check_catalog"](self.root), [])

    def test_new_skill_requires_all_overviews(self):
        self.overview()
        self.write("tools/external/new/SKILL.md", "# New\n")
        errors = DOCS["check_catalog"](self.root)
        self.assertEqual(len(errors), 3)
        self.assertTrue(all("missing /new" in e for e in errors))

    def test_duplicate_unknown_and_wrong_target(self):
        path = self.overview()
        text = path.read_text().replace('../roles/qa.md', '../core/example/SKILL.md')
        text = text.replace('\n];', '\n  { n:"qa", href:"../roles/qa.md" },\n  { n:"ghost", href:"missing.md" },\n];')
        path.write_text(text)
        errors = "\n".join(DOCS["check_catalog"](self.root))
        for expected in ("duplicate entry qa", "wrong canonical link for qa", "unknown catalog entry ghost"):
            self.assertIn(expected, errors)

    def test_version_drift(self):
        self.overview()
        self.write("VERSION", "2.0.0\n")
        self.assertIn("header version", "\n".join(DOCS["check_catalog"](self.root)))

    def test_missing_paths_images_and_anchors(self):
        self.write("target.md", "# Found\n")
        path = self.write("guide.md", "[bad](gone.md)\n![image](gone.png)\n[bad anchor](target.md#absent)\n")
        errors = DOCS["check_links"]([path], self.root)
        self.assertEqual(len(errors), 3)
        self.assertIn("guide.md:3: missing anchor", errors[2])

    def test_fences_external_urls_and_encoded_paths(self):
        self.write("space name.md", "# Heading\n# Heading\n")
        path = self.write("guide.md", '''[valid](space%20name.md#heading-1)
[external](https://example.com/unknown)
~~~markdown
[example](missing.md)
```
![example](missing.png)
~~~
''')
        self.assertEqual(DOCS["check_links"]([path], self.root), [])

    def test_html_links_and_ids(self):
        path = self.write("guide.html", '<h1 id="good">Title</h1><a href="#good">ok</a><img src="missing.svg">')
        errors = DOCS["check_links"]([path], self.root)
        self.assertEqual(len(errors), 1)
        self.assertIn("missing.svg", errors[0])

    def test_heading_slug_ignores_fenced_examples(self):
        path = self.write("guide.md", '# Real `API`\n```\n# Fake\n```\n')
        self.assertEqual(DOCS["anchors"](path), {"real-api"})


if __name__ == "__main__":
    unittest.main()
