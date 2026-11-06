"""Offline tests of the issue-key rule in bin/pr_label_sweep.py (SKILL.md section 2).

Every PR title, body and branch here is synthetic. `ACME` stands for a consuming
repo's issue_prefix. No test calls gh, ruby or the network.

Run `python3 -m unittest discover -s tools/github/pr-label-sweep/tests`, or the
configured `python3 bin/check-stack` gate, which includes this suite.
"""
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "bin" / "pr_label_sweep.py"
_spec = importlib.util.spec_from_file_location("pr_label_sweep", SCRIPT)
sweep = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sweep)

TITLE = "chore: tidy the importer"
BRANCH = "chore/tidy-importer"

# SKILL.md section 2, written out here so a word dropped from the script fails a test.
LINK_WORDS = (
    "close", "closes", "closed", "closing", "fix", "fixes", "fixed", "fixing",
    "resolve", "resolves", "resolved", "resolving", "complete", "completes",
    "completed", "completing", "implement", "implements", "implemented",
    "implementing", "ref", "refs", "references", "part of", "contributes to",
    "towards", "updates",
)
LINK_LABELS = ("Linear", "Issue", "Ticket")

# The only keys are citations: no link line and no Scope heading.
CITATIONS = (
    "Tidies the importer after the outage review.\n"
    "\n"
    "The retry limit was set in the ACME-901 entry and ACME-902 kept it.\n"
)
# The key is declared by one link line. The opening sentence holds a citation.
LINK_LINE = (
    "Stacked on the ACME-903 cleanup.\n"
    "\n"
    "Fixes ACME-101\n"
    "\n"
    "Tests pass.\n"
)
# The key is declared by the first sentence under the Scope heading.
SCOPE = (
    "Tidies the importer.\n"
    "\n"
    "## Scope\n"
    "\n"
    "The retry change for ACME-102 lands here. Nothing else moves.\n"
)


def key(title=TITLE, body=CITATIONS, branch=BRANCH):
    return sweep.pr_key("ACME", title, body, branch)


class Baselines(unittest.TestCase):
    """The bodies the controls vary, unchanged."""

    def test_citations_give_no_key(self):
        self.assertIsNone(key(body=CITATIONS))

    def test_link_line_gives_its_key(self):
        self.assertEqual(key(body=LINK_LINE), "ACME-101")

    def test_scope_first_sentence_gives_its_key(self):
        self.assertEqual(key(body=SCOPE), "ACME-102")


class OneInputControls(unittest.TestCase):
    """Each test varies one input of a baseline and states the new result."""

    def test_renaming_the_scope_heading_gives_no_key(self):
        self.assertIsNone(key(body=SCOPE.replace("## Scope", "## Notes")))

    def test_moving_the_scope_key_to_the_second_sentence_gives_no_key(self):
        body = SCOPE.replace(
            "The retry change for ACME-102 lands here. Nothing else moves.",
            "The retry change lands here. Nothing else moves for ACME-102.",
        )
        self.assertIsNone(key(body=body))

    def test_deleting_the_link_line_gives_no_key(self):
        self.assertIsNone(key(body=LINK_LINE.replace("Fixes ACME-101\n", "")))

    def test_fencing_the_link_line_gives_no_key(self):
        body = LINK_LINE.replace("Fixes ACME-101\n", "```\nFixes ACME-101\n```\n")
        self.assertIsNone(key(body=body))

    def test_an_html_comment_around_the_link_line_gives_no_key(self):
        # The comment markers sit on their own lines. On one line, `<!--` alone stops
        # the line opening with the link word, so stripping comments would go untested.
        body = LINK_LINE.replace("Fixes ACME-101\n", "<!--\nFixes ACME-101\n-->\n")
        self.assertIsNone(key(body=body))

    def test_adding_a_part_of_line_gives_that_key(self):
        self.assertEqual(key(body=CITATIONS + "\nPart of ACME-1\n"), "ACME-1")

    def test_adding_the_same_words_mid_sentence_gives_no_key(self):
        self.assertIsNone(key(body=CITATIONS + "\nThis also fixes ACME-1 on the way.\n"))

    def test_adding_a_branch_key_gives_that_key(self):
        self.assertEqual(key(branch="chore/acme-9-release"), "ACME-9")

    def test_adding_a_title_key_gives_that_key(self):
        self.assertEqual(key(title=f"{TITLE} (ACME-2)"), "ACME-2")

    def test_a_project_id_in_the_title_gives_no_key(self):
        self.assertIsNone(key(title=f"{TITLE} (P-ACME-18)"))

    def test_a_project_id_after_a_link_word_gives_no_key(self):
        self.assertIsNone(key(body="Part of P-ACME-18\n"))

    def test_a_project_id_under_scope_gives_no_key(self):
        self.assertIsNone(key(body="## Scope\n\nThe planning project (P-ACME-18).\n"))

    def test_a_file_stamp_under_scope_gives_no_key(self):
        self.assertIsNone(key(body="## Scope\n\nCopied from acme-20261022T120513Z.\n"))

    def test_bold_and_link_markup_resolves(self):
        body = "- **Part of** [ACME-5](https://tracker.example/ACME-5)\n"
        self.assertEqual(key(body=body), "ACME-5")

    def test_a_label_without_its_colon_gives_no_key(self):
        self.assertIsNone(key(body="Issue ACME-5 stays open.\n"))

    def test_a_label_with_a_bold_colon_resolves(self):
        self.assertEqual(key(body="**Linear:** ACME-5 moved.\n"), "ACME-5")

    def test_a_link_line_outranks_scope(self):
        self.assertEqual(key(body="## Scope\n\nACME-7 is it.\n\nFixes ACME-8\n"), "ACME-8")

    def test_a_title_outranks_a_link_line(self):
        self.assertEqual(key(title=f"{TITLE} (ACME-3)", body="Fixes ACME-8\n"), "ACME-3")

    def test_a_null_body_gives_no_key(self):
        self.assertIsNone(key(body=None))


class Precedence(unittest.TestCase):
    """Title, then link line, then Scope, then branch: remove each winner in turn."""

    TITLE_WITH_KEY = f"{TITLE} (ACME-11)"
    BODY_WITH_BOTH = "## Scope\n\nACME-13 is the work.\n\nFixes ACME-12\n"
    BODY_WITH_SCOPE = "## Scope\n\nACME-13 is the work.\n"
    BRANCH_WITH_KEY = "chore/acme-14-release"

    def test_title_wins_over_all_three(self):
        got = key(self.TITLE_WITH_KEY, self.BODY_WITH_BOTH, self.BRANCH_WITH_KEY)
        self.assertEqual(got, "ACME-11")

    def test_link_line_wins_without_a_title_key(self):
        self.assertEqual(key(TITLE, self.BODY_WITH_BOTH, self.BRANCH_WITH_KEY), "ACME-12")

    def test_scope_wins_without_a_link_line(self):
        self.assertEqual(key(TITLE, self.BODY_WITH_SCOPE, self.BRANCH_WITH_KEY), "ACME-13")

    def test_branch_wins_without_a_declared_body_key(self):
        self.assertEqual(key(TITLE, CITATIONS, self.BRANCH_WITH_KEY), "ACME-14")

    def test_nothing_declared_gives_no_key(self):
        self.assertIsNone(key(TITLE, CITATIONS, BRANCH))

    def test_a_citation_never_outranks_the_branch(self):
        self.assertEqual(key(body=CITATIONS, branch=self.BRANCH_WITH_KEY), "ACME-14")


class Fences(unittest.TestCase):
    """A fence closes only on its own character, at its length or longer, with no text after it."""

    def test_a_shorter_fence_inside_a_longer_fence_stays_fenced(self):
        body = "````markdown\n```text\nFixes ACME-50\n```\n````\n"
        self.assertEqual(key(body=body, branch="chore/acme-51-release"), "ACME-51")

    def test_a_tilde_fence_inside_a_backtick_fence_stays_fenced(self):
        self.assertIsNone(key(body="```\n~~~\nFixes ACME-52\n~~~\n```\n"))

    def test_a_backtick_fence_inside_a_tilde_fence_stays_fenced(self):
        self.assertIsNone(key(body="~~~\n```\nFixes ACME-53\n```\n~~~\n"))

    def test_a_fence_line_with_text_after_it_does_not_close(self):
        self.assertIsNone(key(body="```\n```text\nFixes ACME-54\n```\n"))

    def test_a_longer_fence_closes_a_shorter_one(self):
        self.assertEqual(key(body="```\n`````\nFixes ACME-55\n"), "ACME-55")

    def test_a_link_line_after_the_closing_fence_counts(self):
        self.assertEqual(key(body="````\n```\n````\nFixes ACME-56\n"), "ACME-56")

    def test_a_line_of_inline_code_does_not_open_a_fence(self):
        self.assertEqual(key(body="``` x ```\nFixes ACME-57\n"), "ACME-57")

    def test_a_tilde_fence_may_hold_backticks_in_its_text(self):
        self.assertIsNone(key(body="~~~ `x`\nFixes ACME-58\n~~~\n"))

    def test_an_unclosed_fence_runs_to_the_end_of_the_body(self):
        self.assertIsNone(key(body="```\nFixes ACME-59\n"))

    def test_a_fence_may_be_indented_three_spaces(self):
        self.assertIsNone(key(body="   ```\nFixes ACME-60\n   ```\n"))

    def test_a_fence_indented_four_spaces_does_not_open(self):
        self.assertEqual(key(body="    ```\nFixes ACME-61\n"), "ACME-61")


class KeyPositions(unittest.TestCase):
    """The rest of the section 2 text."""

    def test_every_link_word_opens_a_link_line(self):
        for word in LINK_WORDS:
            with self.subTest(word=word):
                self.assertEqual(key(body=f"{word} ACME-21\n"), "ACME-21")

    def test_every_label_needs_its_colon(self):
        for label in LINK_LABELS:
            with self.subTest(label=label):
                self.assertEqual(key(body=f"{label}: ACME-22\n"), "ACME-22")
                self.assertIsNone(key(body=f"{label} ACME-22\n"))

    def test_a_word_outside_the_list_gives_no_key(self):
        self.assertIsNone(key(body="Addresses ACME-41\n"))

    def test_a_link_word_with_another_word_before_the_key_gives_no_key(self):
        self.assertIsNone(key(body="Fixes the ACME-23 retry\n"))

    def test_the_first_title_key_wins(self):
        self.assertEqual(key(title="ACME-24 and ACME-25"), "ACME-24")

    def test_the_first_link_line_wins(self):
        self.assertEqual(key(body="Fixes ACME-26\nFixes ACME-27\n"), "ACME-26")

    def test_scope_heading_matches_any_level_and_case(self):
        self.assertEqual(key(body="### SCOPE\n\nACME-28 is the work.\n"), "ACME-28")

    def test_only_the_first_scope_heading_counts(self):
        body = "## Scope\n\nNo key here.\n\n## Scope\n\nACME-29 is the work.\n"
        self.assertIsNone(key(body=body))

    def test_a_scope_section_opening_with_a_list_uses_its_first_item(self):
        self.assertEqual(key(body="## Scope\n\n- ACME-30 is the work\n- ACME-31 is not\n"), "ACME-30")
        self.assertIsNone(key(body="## Scope\n\n- The work\n- ACME-31 is not\n"))

    def test_a_scope_section_opening_with_a_numbered_list_uses_its_first_item(self):
        for marker in ("1.", "1)", "12."):
            with self.subTest(marker=marker):
                body = f"## Scope\n\n{marker} ACME-30 is the work\n2. ACME-31 is not\n"
                self.assertEqual(key(body=body), "ACME-30")
        self.assertIsNone(key(body="## Scope\n\n1. The work\n2. ACME-31 is not\n"))

    def test_the_first_sentence_of_a_numbered_item_still_ends_at_its_period(self):
        self.assertIsNone(key(body="## Scope\n\n1. The work lands. ACME-31 follows.\n"))

    def test_a_scope_heading_inside_a_fence_does_not_count(self):
        self.assertIsNone(key(body="```\n## Scope\n\nACME-32 is the work.\n```\n"))

    def test_a_branch_key_needs_no_boundary(self):
        self.assertEqual(key(branch="fix-acme-33"), "ACME-33")

    def test_a_body_key_keeps_its_boundary_after_a_hyphen(self):
        self.assertIsNone(key(body="## Scope\n\nThe fix-acme-34 work.\n"))

    def test_keys_match_case_insensitively_and_come_back_upper_case(self):
        self.assertEqual(key(title="acme-35: tidy"), "ACME-35")
        self.assertEqual(key(body="fixes acme-36\n"), "ACME-36")
        self.assertEqual(key(branch="ACME-37-tidy"), "ACME-37")

    def test_an_unset_prefix_gives_no_key(self):
        self.assertIsNone(sweep.pr_key(None, "ACME-38", "Fixes ACME-38\n", "acme-38"))

    def test_the_prefix_is_matched_literally(self):
        self.assertIsNone(sweep.pr_key("A.ME", "ACME-39", "Fixes ACME-39\n", "acme-39"))
        self.assertEqual(sweep.pr_key("A.ME", "A.ME-40", None, "b"), "A.ME-40")


if __name__ == "__main__":
    unittest.main()
