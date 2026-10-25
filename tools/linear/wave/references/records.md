# Wave records

This is the canonical record contract. The JSON Schema block below is mirrored
in the Workflow script because that sandbox cannot read files. Harness case 10
compares every field and type, including nested records, to this block.
Legacy fields remain required; version 2 selection fields are required by the
runtime for new records and optional in the schema for old-record compatibility.
Nullable values explicitly represent absent evidence.
A STOPPED record always has a non-empty stop_reason and evidence. Branch and
worktree in selection are proposed names/absolute paths; only dispatch read-back
proves their existence. New Run A records have schema_version 2 and preserve selection_report plus the
full input in evidence (`Selection snapshot: ...`). Build tracks/plans and
planning_tracks/planning_plans are disjoint. A1 must match the deterministic
helper's membership and scope. Planning-only plans cannot enter approval, even
by explicit issue ID. PLANNING_ONLY has no build command. Legacy records without
schema_version keep their original strict membership. PLAN.worktree must match
the recovered TRACK.worktree in either lane.
TRACK.project (and each SELECT.tracks[].project) is the issue's Linear project
UUID, copied verbatim from one `graph_publication.projects[].project_id`, or
null when the issue has no Linear project. It is never a project name and never
a name with the UUID appended, such as `"MVP 2.1 (1fea30c2-…)"`: the script
compares the string exactly, so any other value matches no publication project
and stops Run A before A2. An exact `project_name` still matches, so Run A
records written before this rule still build.
RUN_A is AWAITING_APPROVAL only when at least one PLAN is PLANNED; if every A4
plan stopped, it is STOPPED with build_command null and `<issue_id>: <stop_reason>`
evidence per plan.
Run ids are caller-supplied Workflow invocation ids; the tool's actual run id is
attached by the invoking skill after return if the tool allocates it itself.

RUN_A.evidence retains full graph publication/admission observations. A build
matches each approved unit's `closure_graph_digest` and `closure_evidence_digest`
against fresh reports, rather than requiring unchanged main/full-graph revisions.
Wave membership is fixed by RUN_A; unrelated additions never enroll new tracks.
A changed or unauditable track produces a STOPPED TRACK_RESULT while independent
siblings continue. If all approved tracks fail admission, return a STOPPED report.
Older records without candidate graph digests require a new plan audit.

Version 2 selection_report retains every assessed outcome, overlap and capacity
reason, including EMPTY runs. Legacy records retain overlaps only in PLAN.risks;
their checkpoint must state that limitation. Accepted PR snapshots are transient
caller inputs; current overlap evidence is retained in the candidate assessment.

Contract files are JSON lists of {literal, files}; SHARED_LITERAL additionally
records the participating issue ids and why agreement is required. Write
<contract_dir>/<wave-id>.json and a test using the consuming repo's own runner:
JSON permits exact strings without Markdown escaping and stdlib parsing.
This publication procedure applies to published-graph waves. With an approved
local graph, `RUN_A.contract` stays null and `RUN_A.literals` is the approved
agreement snapshot; a null contract does not imply an empty literal list.
A4/B1 receive that snapshot. B2 and B4 materialize only its `{literal, files}` projection
in a temporary file outside the repository and checks the built branches; no
separate contract PR, tracked contract file or bookkeeping test is created.

WAVE_REPORT retains every selected track, including unapproved and dropped
tracks. open_questions contains only questions actually checked against sibling
branch tips, with evidence and verified (still current) or stale (superseded).
Questions lacking that check remain explicit in unverified_questions; they
must never acquire a fabricated verification label.

Recovery is a transient caller observation, not approval: each approved track
has exact issue/branch/worktree identity, UTC checked_at, nonempty lookup evidence,
ABSENT with null result, or PR_OPEN with a verified TRACK_RESULT. Existing PRs
are recovered before B1; unavailable evidence is never a missing PR. RUN_A and
WAVE_REPORT are persisted by the caller outside the checkout under the Git common
directory's kstack/waves subtree. Partial runs can recover existing remote PRs.

READMISSION is the read-only B3 observation immediately before a pr-loop.
Always return actual main/head SHAs, checked_at, ancestry/merge-tree exit codes
and a complete fresh admission_report string, including on unchanged main.
Main movement alone is insufficient to detect Linear or human-gate changes.
The script accepts publication on main with equal candidate conditions and drops
obsolete pending flags. No-change retries require evidence refresh, not approval.

FINAL_CHECK observes all final remote heads and same-head review/CI evidence
after B3. Its heads identify issue, PR and branch with head_sha and nullable
reviewed_head_sha; CLEAN requires equality. With a contract, seam is the raw
SEAM result from immutable SHA branch arguments; otherwise it is null. Missing
head evidence or seam rows cannot produce CLEAN. Head movement during observation
requires a fresh check. Final results retain the updated head and both seam phases.
In streaming mode FINAL_CHECK covers remote head and review evidence only;
FINAL_EVIDENCE then checks connected shared obligations with local/remote heads,
base SHA and participant-specific seam rows at the exact reviewed commits.

```json
{
  "TRACK": {
    "type": "object",
    "properties": {
      "issue_id": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "project": {
        "type": [
          "string",
          "null"
        ]
      },
      "milestone": {
        "type": [
          "string",
          "null"
        ]
      },
      "contract_citation": {
        "type": "string"
      },
      "branch": {
        "type": "string"
      },
      "worktree": {
        "type": "string"
      },
      "file_scope": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "integration_order": {
        "type": "integer"
      }
    },
    "required": [
      "issue_id",
      "title",
      "project",
      "milestone",
      "contract_citation",
      "branch",
      "worktree",
      "file_scope",
      "integration_order"
    ],
    "additionalProperties": false
  },
  "SHARED_LITERAL": {
    "type": "object",
    "properties": {
      "literal": {
        "type": "string"
      },
      "files": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "tracks": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "why": {
        "type": "string"
      }
    },
    "required": [
      "literal",
      "files",
      "tracks",
      "why"
    ],
    "additionalProperties": false
  },
  "PLAN": {
    "type": "object",
    "properties": {
      "issue_id": {
        "type": "string"
      },
      "worktree": {
        "type": "string"
      },
      "linear_status_readback": {
        "type": "string"
      },
      "acceptance_criteria_cited": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "files": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "tests": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "risks": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "state": {
        "type": "string",
        "enum": [
          "PLANNED",
          "STOPPED"
        ]
      },
      "stop_reason": {
        "type": [
          "string",
          "null"
        ]
      },
      "evidence": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "branch": {
        "type": "string"
      }
    },
    "required": [
      "issue_id",
      "worktree",
      "linear_status_readback",
      "acceptance_criteria_cited",
      "files",
      "tests",
      "risks",
      "state",
      "stop_reason",
      "evidence",
      "branch"
    ],
    "additionalProperties": false
  },
  "TRACK_RESULT": {
    "type": "object",
    "properties": {
      "issue_id": {
        "type": "string"
      },
      "state": {
        "type": "string",
        "enum": [
          "PR_OPEN",
          "STOPPED"
        ]
      },
      "pr": {
        "type": [
          "string",
          "null"
        ]
      },
      "head_sha": {
        "type": [
          "string",
          "null"
        ]
      },
      "files_touched": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "gates": {
        "type": "object",
        "properties": {
          "lint": {
            "type": "object",
            "properties": {
              "cmd": {
                "type": "string"
              },
              "exit": {
                "type": [
                  "integer",
                  "null"
                ]
              }
            },
            "required": [
              "cmd",
              "exit"
            ],
            "additionalProperties": false
          },
          "test": {
            "type": "object",
            "properties": {
              "cmd": {
                "type": "string"
              },
              "exit": {
                "type": [
                  "integer",
                  "null"
                ]
              },
              "count": {
                "type": [
                  "integer",
                  "null"
                ]
              }
            },
            "required": [
              "cmd",
              "exit",
              "count"
            ],
            "additionalProperties": false
          }
        },
        "required": [
          "lint",
          "test"
        ],
        "additionalProperties": false
      },
      "acceptance_evidence": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "open_questions": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "stop_reason": {
        "type": [
          "string",
          "null"
        ]
      },
      "evidence": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "issue_id",
      "state",
      "pr",
      "head_sha",
      "files_touched",
      "gates",
      "acceptance_evidence",
      "open_questions",
      "stop_reason",
      "evidence"
    ],
    "additionalProperties": false
  },
  "REVIEW_RESULT": {
    "type": "object",
    "properties": {
      "pr": {
        "type": "string"
      },
      "verdict": {
        "type": "string",
        "enum": [
          "CLEAN",
          "BLOCKED",
          "ROUNDS_EXHAUSTED"
        ]
      },
      "rounds": {
        "type": "integer"
      },
      "open_findings": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "model_routing": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "open_questions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "question": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "verified",
                "stale"
              ]
            },
            "evidence": {
              "type": "string"
            }
          },
          "required": [
            "question",
            "status",
            "evidence"
          ],
          "additionalProperties": false
        }
      },
      "reviewed_head": {
        "type": "string"
      },
      "block_reason_code": {
        "type": "string",
        "enum": [
          "SLOT_WAIT_TIMEOUT"
        ]
      }
    },
    "required": [
      "pr",
      "verdict",
      "rounds",
      "open_findings",
      "model_routing",
      "open_questions"
    ],
    "additionalProperties": false
  },
  "READMISSION": {
    "type": "object",
    "properties": {
      "issue_id": {
        "type": "string"
      },
      "pr": {
        "type": "string"
      },
      "state": {
        "type": "string",
        "enum": [
          "OBSERVED",
          "STOPPED"
        ]
      },
      "main_sha": {
        "type": [
          "string",
          "null"
        ]
      },
      "checked_at": {
        "type": [
          "string",
          "null"
        ]
      },
      "ancestor_exit": {
        "type": [
          "integer",
          "null"
        ]
      },
      "merge_tree_exit": {
        "type": [
          "integer",
          "null"
        ]
      },
      "head_sha": {
        "type": [
          "string",
          "null"
        ]
      },
      "admission_report": {
        "type": [
          "string",
          "null"
        ]
      },
      "stop_reason": {
        "type": [
          "string",
          "null"
        ]
      },
      "evidence": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "issue_id",
      "pr",
      "state",
      "main_sha",
      "checked_at",
      "ancestor_exit",
      "merge_tree_exit",
      "head_sha",
      "admission_report",
      "stop_reason",
      "evidence"
    ],
    "additionalProperties": false
  },
  "CONTRACT": {
    "type": "object",
    "properties": {
      "state": {
        "type": "string",
        "enum": [
          "PR_OPEN",
          "STOPPED"
        ]
      },
      "pr": {
        "type": [
          "string",
          "null"
        ]
      },
      "branch": {
        "type": [
          "string",
          "null"
        ]
      },
      "file": {
        "type": [
          "string",
          "null"
        ]
      },
      "stop_reason": {
        "type": [
          "string",
          "null"
        ]
      },
      "evidence": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "state",
      "pr",
      "branch",
      "file",
      "stop_reason",
      "evidence"
    ],
    "additionalProperties": false
  },
  "SELECT": {
    "type": "object",
    "properties": {
      "tracks": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "title": {
              "type": "string"
            },
            "project": {
              "type": [
                "string",
                "null"
              ]
            },
            "milestone": {
              "type": [
                "string",
                "null"
              ]
            },
            "contract_citation": {
              "type": "string"
            },
            "branch": {
              "type": "string"
            },
            "worktree": {
              "type": "string"
            },
            "file_scope": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "integration_order": {
              "type": "integer"
            }
          },
          "required": [
            "issue_id",
            "title",
            "project",
            "milestone",
            "contract_citation",
            "branch",
            "worktree",
            "file_scope",
            "integration_order"
          ],
          "additionalProperties": false
        }
      },
      "sequenced": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "already_active": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "planning_tracks": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "title": {
              "type": "string"
            },
            "project": {
              "type": [
                "string",
                "null"
              ]
            },
            "milestone": {
              "type": [
                "string",
                "null"
              ]
            },
            "contract_citation": {
              "type": "string"
            },
            "branch": {
              "type": "string"
            },
            "worktree": {
              "type": "string"
            },
            "file_scope": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "integration_order": {
              "type": "integer"
            }
          },
          "required": [
            "issue_id",
            "title",
            "project",
            "milestone",
            "contract_citation",
            "branch",
            "worktree",
            "file_scope",
            "integration_order"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "tracks",
      "sequenced",
      "already_active"
    ],
    "additionalProperties": false
  },
  "SCAN": {
    "type": "object",
    "properties": {
      "literals": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "literal": {
              "type": "string"
            },
            "files": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "tracks": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "why": {
              "type": "string"
            }
          },
          "required": [
            "literal",
            "files",
            "tracks",
            "why"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "literals"
    ],
    "additionalProperties": false
  },
  "SEAM": {
    "type": "object",
    "properties": {
      "exit": {
        "type": "integer"
      },
      "table": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "literal": {
              "type": "string"
            },
            "branch": {
              "type": "string"
            },
            "file": {
              "type": "string"
            },
            "state": {
              "type": "string",
              "enum": [
                "PASS",
                "MISMATCH",
                "ERROR",
                "UNCHANGED"
              ]
            },
            "evidence": {
              "type": "string"
            }
          },
          "required": [
            "literal",
            "branch",
            "file",
            "state",
            "evidence"
          ],
          "additionalProperties": false
        }
      },
      "open_questions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "question": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "verified",
                "stale"
              ]
            },
            "evidence": {
              "type": "string"
            }
          },
          "required": [
            "issue_id",
            "question",
            "status",
            "evidence"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "exit",
      "table",
      "open_questions"
    ],
    "additionalProperties": false
  },
  "RUN_A": {
    "type": "object",
    "properties": {
      "state": {
        "type": "string",
        "enum": [
          "AWAITING_APPROVAL",
          "EMPTY",
          "STOPPED",
          "PLANNING_ONLY"
        ]
      },
      "run_id": {
        "type": "string"
      },
      "wave_id": {
        "type": "string"
      },
      "tracks": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "title": {
              "type": "string"
            },
            "project": {
              "type": [
                "string",
                "null"
              ]
            },
            "milestone": {
              "type": [
                "string",
                "null"
              ]
            },
            "contract_citation": {
              "type": "string"
            },
            "branch": {
              "type": "string"
            },
            "worktree": {
              "type": "string"
            },
            "file_scope": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "integration_order": {
              "type": "integer"
            }
          },
          "required": [
            "issue_id",
            "title",
            "project",
            "milestone",
            "contract_citation",
            "branch",
            "worktree",
            "file_scope",
            "integration_order"
          ],
          "additionalProperties": false
        }
      },
      "plans": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "worktree": {
              "type": "string"
            },
            "linear_status_readback": {
              "type": "string"
            },
            "acceptance_criteria_cited": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "files": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "tests": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "risks": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "state": {
              "type": "string",
              "enum": [
                "PLANNED",
                "STOPPED"
              ]
            },
            "stop_reason": {
              "type": [
                "string",
                "null"
              ]
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "branch": {
              "type": "string"
            }
          },
          "required": [
            "issue_id",
            "worktree",
            "linear_status_readback",
            "acceptance_criteria_cited",
            "files",
            "tests",
            "risks",
            "state",
            "stop_reason",
            "evidence",
            "branch"
          ],
          "additionalProperties": false
        }
      },
      "contract": {
        "anyOf": [
          {
            "type": "object",
            "properties": {
              "state": {
                "type": "string",
                "enum": [
                  "PR_OPEN",
                  "STOPPED"
                ]
              },
              "pr": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "branch": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "file": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "stop_reason": {
                "type": [
                  "string",
                  "null"
                ]
              },
              "evidence": {
                "type": "array",
                "items": {
                  "type": "string"
                }
              }
            },
            "required": [
              "state",
              "pr",
              "branch",
              "file",
              "stop_reason",
              "evidence"
            ],
            "additionalProperties": false
          },
          {
            "type": "null"
          }
        ]
      },
      "literals": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "literal": {
              "type": "string"
            },
            "files": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "tracks": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "why": {
              "type": "string"
            }
          },
          "required": [
            "literal",
            "files",
            "tracks",
            "why"
          ],
          "additionalProperties": false
        }
      },
      "sequenced": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "already_active": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "build_command": {
        "type": [
          "string",
          "null"
        ]
      },
      "stop_reason": {
        "type": [
          "string",
          "null"
        ]
      },
      "evidence": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "schema_version": {
        "type": "integer",
        "enum": [
          2
        ]
      },
      "selection_report": {
        "type": "string"
      },
      "planning_tracks": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "title": {
              "type": "string"
            },
            "project": {
              "type": [
                "string",
                "null"
              ]
            },
            "milestone": {
              "type": [
                "string",
                "null"
              ]
            },
            "contract_citation": {
              "type": "string"
            },
            "branch": {
              "type": "string"
            },
            "worktree": {
              "type": "string"
            },
            "file_scope": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "integration_order": {
              "type": "integer"
            }
          },
          "required": [
            "issue_id",
            "title",
            "project",
            "milestone",
            "contract_citation",
            "branch",
            "worktree",
            "file_scope",
            "integration_order"
          ],
          "additionalProperties": false
        }
      },
      "planning_plans": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "worktree": {
              "type": "string"
            },
            "linear_status_readback": {
              "type": "string"
            },
            "acceptance_criteria_cited": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "files": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "tests": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "risks": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "state": {
              "type": "string",
              "enum": [
                "PLANNED",
                "STOPPED"
              ]
            },
            "stop_reason": {
              "type": [
                "string",
                "null"
              ]
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "branch": {
              "type": "string"
            }
          },
          "required": [
            "issue_id",
            "worktree",
            "linear_status_readback",
            "acceptance_criteria_cited",
            "files",
            "tests",
            "risks",
            "state",
            "stop_reason",
            "evidence",
            "branch"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "state",
      "run_id",
      "wave_id",
      "tracks",
      "plans",
      "contract",
      "literals",
      "sequenced",
      "already_active",
      "build_command",
      "stop_reason",
      "evidence"
    ],
    "additionalProperties": false
  },
  "WAVE_REPORT": {
    "type": "object",
    "properties": {
      "state": {
        "type": "string",
        "enum": [
          "COMPLETE",
          "STOPPED"
        ]
      },
      "run_ids": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "wave_id": {
        "type": "string"
      },
      "approved": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "tracks": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "state": {
              "type": "string",
              "enum": [
                "CLEAN",
                "BLOCKED",
                "ROUNDS_EXHAUSTED",
                "STOPPED",
                "SEAM_MISMATCH",
                "NOT_APPROVED"
              ]
            },
            "next_human_action": {
              "type": "string"
            },
            "result": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "issue_id": {
                      "type": "string"
                    },
                    "state": {
                      "type": "string",
                      "enum": [
                        "PR_OPEN",
                        "STOPPED"
                      ]
                    },
                    "pr": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "head_sha": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "files_touched": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "gates": {
                      "type": "object",
                      "properties": {
                        "lint": {
                          "type": "object",
                          "properties": {
                            "cmd": {
                              "type": "string"
                            },
                            "exit": {
                              "type": [
                                "integer",
                                "null"
                              ]
                            }
                          },
                          "required": [
                            "cmd",
                            "exit"
                          ],
                          "additionalProperties": false
                        },
                        "test": {
                          "type": "object",
                          "properties": {
                            "cmd": {
                              "type": "string"
                            },
                            "exit": {
                              "type": [
                                "integer",
                                "null"
                              ]
                            },
                            "count": {
                              "type": [
                                "integer",
                                "null"
                              ]
                            }
                          },
                          "required": [
                            "cmd",
                            "exit",
                            "count"
                          ],
                          "additionalProperties": false
                        }
                      },
                      "required": [
                        "lint",
                        "test"
                      ],
                      "additionalProperties": false
                    },
                    "acceptance_evidence": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "open_questions": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "stop_reason": {
                      "type": [
                        "string",
                        "null"
                      ]
                    },
                    "evidence": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    }
                  },
                  "required": [
                    "issue_id",
                    "state",
                    "pr",
                    "head_sha",
                    "files_touched",
                    "gates",
                    "acceptance_evidence",
                    "open_questions",
                    "stop_reason",
                    "evidence"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "review": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "pr": {
                      "type": "string"
                    },
                    "verdict": {
                      "type": "string",
                      "enum": [
                        "CLEAN",
                        "BLOCKED",
                        "ROUNDS_EXHAUSTED"
                      ]
                    },
                    "rounds": {
                      "type": "integer"
                    },
                    "open_findings": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "model_routing": {
                      "type": "array",
                      "items": {
                        "type": "string"
                      }
                    },
                    "open_questions": {
                      "type": "array",
                      "items": {
                        "type": "object",
                        "properties": {
                          "question": {
                            "type": "string"
                          },
                          "status": {
                            "type": "string",
                            "enum": [
                              "verified",
                              "stale"
                            ]
                          },
                          "evidence": {
                            "type": "string"
                          }
                        },
                        "required": [
                          "question",
                          "status",
                          "evidence"
                        ],
                        "additionalProperties": false
                      }
                    },
                    "reviewed_head": {
                      "type": "string"
                    },
                    "block_reason_code": {
                      "type": "string",
                      "enum": [
                        "SLOT_WAIT_TIMEOUT"
                      ]
                    }
                  },
                  "required": [
                    "pr",
                    "verdict",
                    "rounds",
                    "open_findings",
                    "model_routing",
                    "open_questions"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "null"
                }
              ]
            },
            "evidence": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "issue_id",
            "state",
            "next_human_action",
            "result",
            "review",
            "evidence"
          ],
          "additionalProperties": false
        }
      },
      "seam_check": {
        "type": "object",
        "properties": {
          "state": {
            "type": "string",
            "enum": [
              "PASSED",
              "FAILED",
              "NOT_RUN"
            ]
          },
          "table": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "literal": {
                  "type": "string"
                },
                "branch": {
                  "type": "string"
                },
                "file": {
                  "type": "string"
                },
                "state": {
                  "type": "string",
                  "enum": [
                    "PASS",
                    "MISMATCH",
                    "ERROR",
                    "UNCHANGED"
                  ]
                },
                "evidence": {
                  "type": "string"
                }
              },
              "required": [
                "literal",
                "branch",
                "file",
                "state",
                "evidence"
              ],
              "additionalProperties": false
            }
          },
          "reason": {
            "type": "string"
          }
        },
        "required": [
          "state",
          "table",
          "reason"
        ],
        "additionalProperties": false
      },
      "open_questions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "question": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "verified",
                "stale"
              ]
            },
            "evidence": {
              "type": "string"
            }
          },
          "required": [
            "issue_id",
            "question",
            "status",
            "evidence"
          ],
          "additionalProperties": false
        }
      },
      "unverified_questions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "question": {
              "type": "string"
            },
            "evidence": {
              "type": "string"
            }
          },
          "required": [
            "issue_id",
            "question",
            "evidence"
          ],
          "additionalProperties": false
        }
      },
      "stop_reason": {
        "type": [
          "string",
          "null"
        ]
      },
      "evidence": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "state",
      "run_ids",
      "wave_id",
      "approved",
      "tracks",
      "seam_check",
      "open_questions",
      "unverified_questions",
      "stop_reason",
      "evidence"
    ],
    "additionalProperties": false
  },
  "FINAL_EVIDENCE": {
    "type": "object",
    "properties": {
      "exit": {
        "type": "integer"
      },
      "base_sha": {
        "type": "string"
      },
      "heads": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "branch": {
              "type": "string"
            },
            "head_sha": {
              "type": "string"
            },
            "pr_head_sha": {
              "type": "string"
            }
          },
          "required": [
            "issue_id",
            "branch",
            "head_sha",
            "pr_head_sha"
          ],
          "additionalProperties": false
        }
      },
      "table": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "literal": {
              "type": "string"
            },
            "branch": {
              "type": "string"
            },
            "file": {
              "type": "string"
            },
            "state": {
              "type": "string",
              "enum": [
                "PASS",
                "MISMATCH",
                "ERROR",
                "UNCHANGED"
              ]
            },
            "evidence": {
              "type": "string"
            }
          },
          "required": [
            "literal",
            "branch",
            "file",
            "state",
            "evidence"
          ],
          "additionalProperties": false
        }
      },
      "open_questions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "question": {
              "type": "string"
            },
            "status": {
              "type": "string",
              "enum": [
                "verified",
                "stale"
              ]
            },
            "evidence": {
              "type": "string"
            }
          },
          "required": [
            "issue_id",
            "question",
            "status",
            "evidence"
          ],
          "additionalProperties": false
        }
      },
      "evidence": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "exit",
      "base_sha",
      "heads",
      "table",
      "open_questions",
      "evidence"
    ],
    "additionalProperties": false
  },
  "FINAL_CHECK": {
    "type": "object",
    "properties": {
      "heads": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "issue_id": {
              "type": "string"
            },
            "pr": {
              "type": "string"
            },
            "branch": {
              "type": "string"
            },
            "head_sha": {
              "type": "string"
            },
            "reviewed_head_sha": {
              "type": [
                "string",
                "null"
              ]
            }
          },
          "required": [
            "issue_id",
            "pr",
            "branch",
            "head_sha",
            "reviewed_head_sha"
          ],
          "additionalProperties": false
        }
      },
      "seam": {
        "anyOf": [
          {
            "type": "object",
            "properties": {
              "exit": {
                "type": "integer"
              },
              "table": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "literal": {
                      "type": "string"
                    },
                    "branch": {
                      "type": "string"
                    },
                    "file": {
                      "type": "string"
                    },
                    "state": {
                      "type": "string",
                      "enum": [
                        "PASS",
                        "MISMATCH",
                        "ERROR",
                        "UNCHANGED"
                      ]
                    },
                    "evidence": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "literal",
                    "branch",
                    "file",
                    "state",
                    "evidence"
                  ],
                  "additionalProperties": false
                }
              },
              "open_questions": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "issue_id": {
                      "type": "string"
                    },
                    "question": {
                      "type": "string"
                    },
                    "status": {
                      "type": "string",
                      "enum": [
                        "verified",
                        "stale"
                      ]
                    },
                    "evidence": {
                      "type": "string"
                    }
                  },
                  "required": [
                    "issue_id",
                    "question",
                    "status",
                    "evidence"
                  ],
                  "additionalProperties": false
                }
              }
            },
            "required": [
              "exit",
              "table",
              "open_questions"
            ],
            "additionalProperties": false
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "required": [
      "heads",
      "seam"
    ],
    "additionalProperties": false
  }
}
```
