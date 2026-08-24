# KStack visual guide

KStack has two independent dimensions:

1. **Workflow phase** — when a skill is useful: decide, build, review, land, or
   operate.
2. **Capability tier** — what the skill needs: local files, a scope contract,
   GitHub, or Linear.

The [`/stack` router](../router/stack/SKILL.md) matches a request to one skill.
It names the route and stops; the selected skill does the work.

> Mermaid diagrams below render directly on GitHub. For filtering by trigger
> phrase or dependency, open the [interactive skill map](skill-map.html) in a
> browser after cloning the repository.

## How the router works

```mermaid
flowchart TD
    request[Request] --> project{A project routing rule matches?}
    project -- Yes --> local[Use the project skill]
    project -- No --> stack{A KStack trigger matches?}
    stack -- Yes --> route[Name one KStack skill]
    stack -- No --> direct[Answer directly]
    route --> invoke[Invoke the selected skill]

    classDef decision fill:#f6e6cf,stroke:#b8690c,color:#16292b
    classDef outcome fill:#ddeeec,stroke:#1d6a63,color:#16292b
    class project,stack decision
    class local,route,invoke,direct outcome
```

Project skills take precedence because they know the consuming repository's
domain. A project skill with the same name as a KStack skill shadows it.

## The workflow map

```mermaid
flowchart LR
    request([Request]) --> router["/stack"]
    router --> decide
    router --> build
    router --> review
    router --> land
    router --> operate

    subgraph decide["1 · Decide — before code exists"]
      direction TB
      spec["/spec"]
      next["/next"]
      triage["/triage"]
      intake["/linear-feature-intake"]
      roles["product-manager · tech-lead<br/>designer · qa"]
    end

    subgraph build["2 · Build — while changing code"]
      direction TB
      dispatch["/dispatch-implementation"]
      investigate["/investigate"]
      controls["/careful · /freeze · /unfreeze"]
      explain["/explain-diff-html"]
    end

    subgraph review["3 · Review — once a PR exists"]
      direction TB
      produce["/review-claude-pr"]
      respond["/review-comments"]
      loop["/pr-loop"]
    end

    subgraph land["4 · Land — publish the change"]
      direction TB
      landSkill["/land"]
      human["Human decides whether to merge"]
      landSkill --> human
    end

    subgraph operate["5 · Operate — after delivery"]
      direction TB
      health["/health"]
      retro["/delivery-retro"]
      titles["/session-titles"]
      steward["/linear-steward"]
      audit["/linear-release-audit"]
    end

    classDef route fill:#f6e6cf,stroke:#b8690c,color:#16292b
    classDef phase fill:#ddeeec,stroke:#1d6a63,color:#16292b
    classDef stopStyle fill:#f6dee5,stroke:#a04360,color:#16292b
    class router route
    class spec,next,triage,intake,roles,dispatch,investigate,controls,explain,produce,respond,loop,landSkill,health,retro,titles,steward,audit phase
    class human stopStyle
```

The phases describe **when** to use a skill. They do not imply an automatic
pipeline: KStack deliberately does not chain a decision, implementation,
review, and merge into one unattended action.

## The capability tiers

A skill lives in the least capable tier that can still deliver its core value.
The tiers are not quality levels; they describe dependencies.

```mermaid
flowchart TB
    fresh["Fresh repository"] --> core["Core<br/>git + local filesystem"]
    config[".agents/stack.yml"] --> gates["gates.lint + gates.test"]
    config --> scope["scope_doc"]
    config --> identities["GitHub identities + issue_prefix"]
    config --> workspace["workspace_contract"]

    core --> coreSkills["router · investigate · careful<br/>freeze · unfreeze · explain-diff-html"]
    gates --> gatedCore["land · health"]
    scope --> roleSkills["spec · triage<br/>four role contracts"]
    identities --> githubSkills["review skills · delivery-retro<br/>session-titles"]
    workspace --> linearSkills["next · dispatch-implementation<br/>feature-intake · steward · release-audit"]

    classDef source fill:#f6e6cf,stroke:#b8690c,color:#16292b
    classDef coreStyle fill:#ddeeec,stroke:#1d6a63,color:#16292b
    classDef rolesStyle fill:#ece0f4,stroke:#7a4b9c,color:#16292b
    classDef githubStyle fill:#dceaf5,stroke:#1f5f92,color:#16292b
    classDef linearStyle fill:#f6dee5,stroke:#a04360,color:#16292b
    class fresh,config source
    class core,gates,coreSkills,gatedCore coreStyle
    class scope,roleSkills rolesStyle
    class identities,githubSkills githubStyle
    class workspace,linearSkills linearStyle
```

| Tier | Core dependency | Skills |
|---|---|---|
| Router | Local files | [`/stack`](../router/stack/SKILL.md) |
| Core | Git + local filesystem | [`/investigate`](../core/investigate/SKILL.md), [`/careful`](../core/careful/SKILL.md), [`/freeze`](../core/freeze/SKILL.md), [`/unfreeze`](../core/unfreeze/SKILL.md), [`/explain-diff-html`](../core/explain-diff-html/SKILL.md), [`/land`](../core/land/SKILL.md), [`/health`](../core/health/SKILL.md) |
| Roles | `scope_doc` | [`/spec`](../roles/spec/SKILL.md), [`/triage`](../roles/triage/SKILL.md), [`product-manager`](../roles/product-manager.md), [`tech-lead`](../roles/tech-lead.md), [`designer`](../roles/designer.md), [`qa`](../roles/qa.md) |
| GitHub | `gh` plus configured identities or issue prefix | [`/review-claude-pr`](../tools/github/review-claude-pr/SKILL.md), [`/review-comments`](../tools/github/review-comments/SKILL.md), [`/pr-loop`](../tools/github/pr-loop/SKILL.md), [`/delivery-retro`](../tools/github/delivery-retro/SKILL.md), [`/session-titles`](../tools/github/session-titles/SKILL.md) |
| Linear | Linear workspace + `workspace_contract` | [`/next`](../tools/linear/next/SKILL.md), [`/dispatch-implementation`](../tools/linear/dispatch-implementation/SKILL.md), [`/linear-feature-intake`](../tools/linear/linear-feature-intake/SKILL.md), [`/linear-steward`](../tools/linear/linear-steward/SKILL.md), [`/linear-release-audit`](../tools/linear/linear-release-audit/SKILL.md) |

Missing configuration is a supported state. A skill either asks for the missing
judgment or refuses and names the exact key; it never silently invents a value.

## The decision cluster

```mermaid
flowchart TD
    question{What are you deciding?}
    question -->|A new idea| spec["/spec"]
    question -->|One narrow question| one{Which question?}
    question -->|What to start next| next["/next"]
    question -->|What to do with open work| triage["/triage"]
    question -->|Record an existing verdict| intake["/linear-feature-intake"]

    one -->|Is it in scope?| pm[product-manager]
    one -->|What exists and how long?| tl[tech-lead]
    one -->|What renders it?| design[designer]
    one -->|What proves it works?| qa[qa]

    spec --> gate["product-manager runs first and alone"]
    gate --> verdict{Active-milestone IN?}
    verdict -- No --> rejected["Stop after one role"]
    verdict -- Yes --> fanout["tech-lead + designer, then qa"]

    classDef decision fill:#f6e6cf,stroke:#b8690c,color:#16292b
    classDef action fill:#ece0f4,stroke:#7a4b9c,color:#16292b
    classDef stopStyle fill:#f6dee5,stroke:#a04360,color:#16292b
    class question,one,verdict decision
    class spec,next,triage,intake,pm,tl,design,qa,gate,fanout action
    class rejected stopStyle
```

`/next` and `/triage` are complements: `/next` looks forward at what to start;
`/triage` looks backward at work already left open.

## The review cluster

```mermaid
flowchart LR
    feedback{What stage is the PR in?}
    feedback -->|Needs a review| reviewer["/review-claude-pr<br/>find and publish defects"]
    feedback -->|Has unanswered feedback| responder["/review-comments<br/>fix and reply"]
    feedback -->|Drive both halves unattended| loop["/pr-loop"]
    loop --> reviewer
    loop --> responder
    reviewer --> human["Human review decision"]
    responder --> human

    classDef decision fill:#f6e6cf,stroke:#b8690c,color:#16292b
    classDef github fill:#dceaf5,stroke:#1f5f92,color:#16292b
    classDef humanStyle fill:#f6dee5,stroke:#a04360,color:#16292b
    class feedback decision
    class reviewer,responder,loop github
    class human humanStyle
```

The split preserves two identities: the reviewer publishes findings, while the
bot fixes code and answers existing feedback. `/pr-loop` orchestrates both but
is bounded by a round cap and repeat-finding detection.

## The constraints that shape KStack

- `/land` stops at the pull request; merging is a human decision.
- The scope gate defaults to **OUT** when there is no cited evidence.
- A merged pull request is not evidence that a release gate passed.
- Commits, changed lines, and pull-request counts are never outcome scores.
- Acceptance criteria must name a runnable check or be explicitly classified
  as human judgment.
- Enforcement is labeled honestly as hook-enforced, tool-list-enforced, or
  prompt-level.

For exact routing phrases and tie-break rules, read the canonical
[`/stack` contract](../router/stack/SKILL.md).
