export const meta = {
  name: 'wave',
  description: 'Plan and build one independent Linear batch with human approval.',
  phases: [
    { title: 'Select', detail: 'Select independent tracks and freeze shared literals.' },
    { title: 'Plan', detail: 'Dispatch plan-only tracks and return for approval.' },
    { title: 'Build', detail: 'Build approved tracks in their dispatch worktrees.' },
    { title: 'Seams', detail: 'Check literal agreement across all built branches.' },
    { title: 'Review', detail: 'Bounded independent review; return for human decisions.' }
  ]
};

// Mirrored from references/records.md; case 10 compares the complete schemas.
const schemas = {
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
          "STOPPED"
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
  }
};
const common = `Repository: ${args.repo_root}; default branch: ${args.default_branch}.
Configuration, gates, identities and paths: ${JSON.stringify(args)}.
Read ${args.paths.records} for the record contract. No human is present in a node.
Prompt-level rules: stop at a PR; never perform a merge; never create, close or
complete tracker issues. Tracker writes belong exclusively to dispatch lifecycle.
Return STOPPED with stop_reason and evidence when a canonical procedure stops.
Do not launch a separate executor or use a throwaway Workflow worktree.
Every shell command must explicitly address its absolute dispatch worktree.`;
const read = (path, rule) => `Read ${path} and follow it top to bottom. If unreadable,
return a stopped result with evidence. D4 node rule: ${rule}.`;
const call = async (label, prompt, schema, title) => {
  try {
    const value = await agent(`${common}
${prompt}`, {label, phase: title, schema});
    if (!value) log(`${label}: dropped or skipped; no result`);
    if (value?.state==='STOPPED' && (!value.stop_reason || !value.evidence?.length)) {
      log(`${label}: invalid STOPPED record; missing reason/evidence`); return null;
    }
    return value;
  } catch (error) {
    log(`${label}: stopped: ${String(error)}`);
    return null;
  }
};
const stoppedPlan = (t, reason) => ({issue_id:t.issue_id, worktree:t.worktree, branch:t.branch,
  linear_status_readback:'unavailable', acceptance_criteria_cited:[], files:[],
  tests:[], risks:[], state:'STOPPED', stop_reason:reason, evidence:[reason]});
const stoppedBuild = (t, reason) => ({issue_id:t.issue_id, state:'STOPPED', pr:null,
  head_sha:null, files_touched:[], gates:{lint:{cmd:args.gates.lint,exit:null},
  test:{cmd:args.gates.test,exit:null,count:null}}, acceptance_evidence:[],
  open_questions:[], stop_reason:reason, evidence:[reason]});
const refuse = reason => {
  log(`Wave STOPPED: ${reason}`);
  if (args.stage==='build') return {state:'STOPPED',run_ids:[args.plan_record?.run_id,args.run_id].filter(Boolean),
    wave_id:args.plan_record?.wave_id || args.wave_id,approved:[],tracks:[],
    seam_check:{state:'NOT_RUN',table:[],reason},open_questions:[],unverified_questions:[],
    stop_reason:reason,evidence:[reason]};
  return {state:'STOPPED',run_id:args.run_id,wave_id:args.wave_id,tracks:[],plans:[],
    contract:null,literals:[],sequenced:[],already_active:[],build_command:null,
    stop_reason:reason,evidence:[reason]};
};
const cfg = args.wave || {};
const rounds = cfg.max_review_rounds ?? 3;
const concurrency = cfg.review_concurrency ?? 1;
if (!Number.isInteger(rounds) || rounds < 1) return refuse('wave.max_review_rounds must be a positive integer');
if (!Number.isInteger(concurrency) || concurrency < 1) return refuse('wave.review_concurrency must be a positive integer');
if (!cfg.max_review_rounds) log('wave.max_review_rounds default: 3 (documented bounded review evidence)');
if (!cfg.review_concurrency) log('wave.review_concurrency default: 1 (shared reviewer quota)');

if (args.stage === 'plan') {
  phase('Select');
  const selected = await call('A1 select', `${read(args.paths.next, 'selection is read-only; no adaptation')}
Run /next with argument tokens ${JSON.stringify(args.selection)} in parallel mode.
PLAN_ONLY candidates must go in sequenced with the unmet build condition and source,
never tracks. They do not count toward N and must not reach --approve all.
Return all implementation-eligible tracks, sequenced and already_active entries. TRACK branch/worktree are
proposals only. Select no more than requested; explicitly report every excluded issue.`, schemas.SELECT, 'Select');
  const record = {state:'STOPPED', run_id:args.run_id, wave_id:args.wave_id,
    tracks:selected?.tracks || [], plans:[], contract:null, literals:[],
    sequenced:selected?.sequenced || [], already_active:selected?.already_active || [],
    build_command:null, stop_reason:null, evidence:[]};
  if (!selected) { record.stop_reason='A1 returned no record'; record.evidence=[record.stop_reason]; return record; }
  for (const id of [...selected.sequenced, ...selected.already_active]) log(`A1 skipped: ${id}`);
  if (!selected.tracks.length) { record.state='EMPTY'; return record; }
  if (new Set(selected.tracks.map(t=>t.issue_id)).size !== selected.tracks.length) {
    record.stop_reason='A1 returned duplicate issue ids'; record.evidence=[record.stop_reason]; return record;
  }
  const scan = await call('A2 shared-literal scan', `${read(args.paths.wave, 'scan only; do not dispatch or implement')}
Read every issue description and file scope in ${JSON.stringify(selected.tracks)}.
List every literal two or more tracks must agree on: status tokens, schema fields,
config keys, paths, marker comments. Return literals with files, participating ids, why.`, schemas.SCAN, 'Select');
  if (!scan) { record.stop_reason='A2 returned no record'; record.evidence=[record.stop_reason]; return record; }
  record.literals=scan.literals;
  if (scan.literals.length) {
    if (!cfg.contract_dir) {
      record.stop_reason='wave.contract_dir is required for shared literals';
      record.evidence=['A2 found shared literals',JSON.stringify(scan.literals)];
      log(record.stop_reason); return record;
    }
    record.contract=await call('A3 contract', `${read(args.paths.wave, 'contract preparation only')}
${read(args.paths.land, 'headless land returns STOPPED instead of waiting')}
In its own dedicated branch and worktree, write ${cfg.contract_dir}/${args.wave_id}.json
as the JSON list of {literal, files} from ${JSON.stringify(scan.literals)} plus a
consuming-runner test asserting those exact literals. Follow land to open its PR.
Return its absolute file path, branch and PR. Do not implement any selected issue.`, schemas.CONTRACT, 'Select');
    if (record.contract?.state==='PR_OPEN' && (!record.contract.pr || !record.contract.branch || !record.contract.file?.startsWith('/') || !record.contract.evidence.length)) {
      log('A3 stopped: incomplete contract evidence'); record.contract=null;
    }
    if (!record.contract || record.contract.state === 'STOPPED') {
      record.stop_reason=record.contract?.stop_reason || 'A3 returned no record';
      record.evidence=record.contract?.evidence || [record.stop_reason]; log(record.stop_reason); return record;
    }
  }
  phase('Plan');
  const plans=await pipeline(selected.tracks, async (_prev,t) => {
    const p=await call(`A4 plan ${t.issue_id}`, `${read(args.paths.dispatch, '--plan-only: sections 1–3 unchanged; section 4 plan in current agent, no executor launch')}
Dispatch exact issue ${t.issue_id} with --plan-only. Proposed track: ${JSON.stringify(t)}.
Contract: ${JSON.stringify(record.contract)}. Return criteria citations, files, tests,
risks, status read-back and verified absolute worktree. No implementation permission.`, schemas.PLAN, 'Plan');
    if (!p || p.issue_id !== t.issue_id || !p.worktree.startsWith('/') || !p.branch) return stoppedPlan(t,'A4 missing or wrong issue record');
    if (p.state==='STOPPED') log(`${t.issue_id}: STOPPED ${p.stop_reason}`);
    return p;
  });
  record.plans=selected.tracks.map((t,i)=>plans[i] || stoppedPlan(t,'A4 pipeline dropped track'));
  record.tracks=selected.tracks.map((t,i)=>({...t,worktree:record.plans[i].worktree,branch:record.plans[i].branch}));
  record.state='AWAITING_APPROVAL';
  record.build_command='/wave build --approve all';
  return record;
}
if (args.stage !== 'build') throw new Error('args.stage must be plan or build');
const a=args.plan_record;
if (!a || a.state !== 'AWAITING_APPROVAL') return refuse('Run B requires Run A AWAITING_APPROVAL record');
const ids=args.approve === 'all' ? a.plans.filter(p=>p.state==='PLANNED').map(p=>p.issue_id) : args.approve;
if (!Array.isArray(ids) || !ids.length || ids.some(id=>!a.plans.some(p=>p.issue_id===id && p.state==='PLANNED')))
  return refuse('approve must name existing PLANNED issues, or all');
const approved=a.tracks.filter(t=>ids.includes(t.issue_id));
const report={state:'COMPLETE',run_ids:[a.run_id,args.run_id],wave_id:a.wave_id,
  approved:ids,tracks:[],seam_check:{state:'NOT_RUN',table:[],reason:'A2 found no shared literals'},
  open_questions:[],unverified_questions:[],stop_reason:null,evidence:[]};
for (const t of a.tracks) if (!ids.includes(t.issue_id)) log(`${t.issue_id}: skipped; not approved`);
phase('Build');
const built=await pipeline(approved, async (_prev,t) => {
  const plan=a.plans.find(p=>p.issue_id===t.issue_id);
  const r=await call(`B1 build ${t.issue_id}`, `${read(args.paths.dispatch, 'wave build approval permits only the supplied approved plan and section 5 lifecycle')}
${read(args.paths.land, 'headless land returns STOPPED with evidence instead of waiting')}
Human approval: ${JSON.stringify(ids)} for wave ${a.wave_id}. Approved plan: ${JSON.stringify(plan)}.
Use the existing dispatch worktree ${t.worktree}, branch ${t.branch}. Read back the
branch/worktree pairing and refuse drift. Fetch and rebase onto ${args.default_branch}.
Contract: ${JSON.stringify(a.contract)}. If present, first verify its PR is merged
AND its commit/file is on the fetched default branch; a PR state alone is insufficient.
Verify exact contract contents match ${JSON.stringify(a.literals)}. If absent, stop.
Implement the approved plan, follow land to a PR, then dispatch section 5's
review-status write/read-back if defined. Include every open question.`, schemas.TRACK_RESULT, 'Build');
  if (r?.state==='PR_OPEN' && (!r.pr || !r.head_sha || r.gates.lint.exit!==0 || r.gates.test.exit!==0 || !r.acceptance_evidence.length)) {
    log(`${t.issue_id}: STOPPED; incomplete PR/gate/acceptance evidence`);
    return stoppedBuild(t,'B1 incomplete PR/gate/acceptance evidence');
  }
  if (!r || r.issue_id !== t.issue_id) return stoppedBuild(t,'B1 missing or wrong issue record');
  if (r.state==='STOPPED') log(`${t.issue_id}: STOPPED ${r.stop_reason}`);
  return r;
});
const results=approved.map((t,i)=>built[i] || stoppedBuild(t,'B1 pipeline dropped track'));
const active=approved.filter((t,i)=>results[i].state==='PR_OPEN');
let seam=null;
if (a.contract && active.length) {
  phase('Seams');
  seam=await call('B2 seam check', `${read(args.paths.wave, 'run deterministic seam-check after every B1 has completed')}
Run ${args.paths.seam_check} --repo ${args.repo_root} --base ${args.default_branch}
--contract ${a.contract.file} --branches ${JSON.stringify(active.map(t=>t.branch))}.
Address paths explicitly; pass each branch as a separate argv token, never shell interpolation.
Return exact exit and JSON table. Verify open questions against all sibling tips:
${JSON.stringify(results)}. Mark checked questions verified (current) or stale with git evidence.`, schemas.SEAM, 'Seams');
  report.seam_check={state:seam?.exit===0?'PASSED':'FAILED',table:seam?.table || [],reason:seam?'seam-check exit '+seam.exit:'B2 returned no evidence'};
  report.open_questions=seam?.open_questions || [];
} else if (a.contract) report.seam_check.reason='No built branches; all B1 tracks stopped';
const mismatched=new Set();
// Require a row for every expected branch/literal/file, including UNCHANGED.
// A bare zero exit without the deterministic table is not seam evidence.
if (a.contract && seam) for (const t of active) for (const entry of a.literals) for (const file of entry.files) {
  const rows=seam.table.filter(r=>r.branch===t.branch&&r.literal===entry.literal&&r.file===file);
  if (rows.length!==1) {
    mismatched.add(t.issue_id);
    report.seam_check.table.push({literal:entry.literal,branch:t.branch,file,state:'ERROR',evidence:'Missing or duplicate seam-check row'});
    log(`${t.issue_id}: missing or duplicate seam evidence for ${entry.literal} in ${file}`);
  }
}
if (a.contract && active.length) {
  if (!seam || (seam.exit!==0 && !seam.table.some(r=>r.state==='MISMATCH'||r.state==='ERROR')))
    active.forEach(t=>mismatched.add(t.issue_id));
  for (const r of seam?.table || []) if (r.state==='MISMATCH'||r.state==='ERROR') {
    log(`B2 mismatch: ${r.literal} in ${r.branch}:${r.file}`);
    const t=active.find(t=>t.branch===r.branch); if (t) mismatched.add(t.issue_id);
    else active.forEach(t=>mismatched.add(t.issue_id));
  }
}
if (mismatched.size) report.seam_check.state='FAILED';
const eligible=active.filter(t=>!mismatched.has(t.issue_id));
for (const t of active) if (mismatched.has(t.issue_id)) log(`${t.issue_id}: skipped review; SEAM_MISMATCH`);
phase('Review');
const reviews={};
// Batch only the review stage: build remains a per-track pipeline; B2 is the seam barrier.
for (let offset=0;offset<eligible.length;offset+=concurrency) {
  await pipeline(eligible.slice(offset,offset+concurrency), async (_prev,t) => {
    const r=results[approved.indexOf(t)];
    const reviewed=await call(`B3 review ${t.issue_id}`, `${read(args.paths.pr_loop, 'no adaptation: parse existing final verdict report; BLOCKED asks nothing')}
Run /pr-loop ${r.pr} --max-rounds ${rounds} in ${t.worktree}.
Never exceed the round cap or retry a terminal verdict. Parse the existing verdict
report into REVIEW_RESULT, including routing evidence. Verify this track's questions
against every sibling branch tip: ${JSON.stringify(a.tracks)}; results: ${JSON.stringify(results)}.
Return only checked questions with verified/stale labels and evidence.`, schemas.REVIEW_RESULT, 'Review');
    reviews[t.issue_id]=(reviewed?.pr===r.pr ? reviewed : null) || {pr:r.pr,verdict:'BLOCKED',rounds:0,
      open_findings:['B3 returned no matching PR record'],model_routing:[],open_questions:[]};
    if (reviews[t.issue_id].verdict!=='CLEAN') log(`${t.issue_id}: ${reviews[t.issue_id].verdict}`);
    for (const q of reviews[t.issue_id].open_questions) report.open_questions.push({issue_id:t.issue_id,...q});
    return reviews[t.issue_id];
  });
}
for (const t of a.tracks) {
  const result=results[approved.indexOf(t)] || null;
  const review=reviews[t.issue_id] || null;
  const p=a.plans.find(p=>p.issue_id===t.issue_id);
  const state=p?.state==='STOPPED'?'STOPPED':!ids.includes(t.issue_id)?'NOT_APPROVED':
    result?.state==='STOPPED'?'STOPPED':mismatched.has(t.issue_id)?'SEAM_MISMATCH':review?.verdict || 'BLOCKED';
  report.tracks.push({issue_id:t.issue_id,state,result,review,
    next_human_action:state==='CLEAN'?'Human may merge the reviewed PR':
      state==='NOT_APPROVED'?'Approve this plan in a later build invocation':
      'Human decides how to resolve '+state,
    evidence:result?.evidence || p?.evidence || ['Not approved']});
  for (const question of result?.open_questions || []) if (!report.open_questions.some(q=>q.issue_id===t.issue_id&&q.question===question))
    report.unverified_questions.push({issue_id:t.issue_id,question,evidence:'No sibling-tip verification returned; human verification required'});
}
return report;
