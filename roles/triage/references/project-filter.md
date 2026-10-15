# Optional Linear project selection

This procedure selects the PR pass only. It grants no tracker writes, kickoff,
review or execution authority. Default triage never reaches Linear.

## Resolve projects and team by the existing procedure

Read `tools/linear/next/references/project-resolution.md` from the physical
stack root and follow it top to bottom with **all issue states**. If unreadable,
stop. It owns configuration/access, canonical team/project IDs, union semantics,
per-row verification and exhaustion; no positional slice of `/next` is used.
Triage scores scope itself; a project container or milestone name never grants
authorization. Lookup or membership failures refuse the requested PR pass.

For triage's backwards inventory, include **all issue states**, including Done,
cancelled and project containers/parents: an open PR may still be linked
to a terminal or container issue. Apply the same exact ID/team verification to
every row; a null project or leaked row fails verification. Keep each project's
membership distinct, deduplicate issue IDs across the union. If child issues
span projects, the parent's project does not confer membership on the children.

## Map verified issues to the complete GitHub PR inventory

Apply **all** GitHub label filters to the complete inventory first. Record each
label-excluded PR as **label-only or both**; project membership was not checked
for it. Do not fetch its body, files or issue mapping just to distinguish those
categories. Resolve requested projects even if no PR survives the labels, so an
invalid project input never looks like a valid empty project report. Only map
PRs that survive the label AND; keep their evidence available for status reads.

Paginate issue attachments/links and relations needed to discover explicit PR
attachments, as well as GitHub closing-issue references when supported. Match
canonical repository and PR number/URL, never a bare number across repos. For
each label-matching open PR in Step 0, inspect the body and complete changed-file
evidence for its **own implementing issue(s)**, including direct implementing links that have
not been attached by the integration. Resolve each candidate issue by canonical
ID and fetch its actual project/team membership; a matching issue-key string
alone is not evidence. A repository-local GitHub issue is not a Linear issue
without an explicit verified mapping.

Select a PR if either holds:

1. The PR is explicitly attached/linked as implementation to an issue whose
   exact project and team IDs were verified in the selected union. Explicit
   attachment to a project container/parent counts too, including when that
   issue is terminal. Preserve the attachment evidence; score scope and possible
   supersession normally rather than excluding containers as a shortcut.
2. The PR directly implements such an issue, established by its implementing
   reference/body **and** changed-file behavior (inspect relevant diff sections
   if unclear). Record the issue, relationship, body/diff links and IDs. A
   closing keyword alone in a copied checklist is not sufficient.

A prerequisite, dependency, quoted plan, related ticket, cross-reference or
"blocked by" mention does **not** establish direct implementation. If it is the
only connection, exclude with that reason; do not import all PRs mentioning an
in-project foundation. Explicit in-project attachments remain selection
boundaries even if scope later yields CLOSE/PARK. Conflicting relationships or
unavailable mapping are not exclusions: stop the requested PR pass and report
UNKNOWN selection coverage with the missing evidence. A positive match on one
project proves union inclusion; negative selection requires complete mapping.
Never call a partial set the complete project backlog.

Report total, selected and excluded once per PR. The two disjoint exclusion
buckets are **label-only or both** (project membership deliberately unexamined)
and **project** (labels matched but no verified project implementation). Sum
these and selected to the full inventory total. List uncertain mappings among
label-matching PRs separately and refuse completeness if any remain. Repeat
project inputs resolve/deduplicate to one union, not separate reports. For
branch/worktree-only invocations, disclose that PR filters were not applied;
do not require tracker access for a pass that does not select PRs.
