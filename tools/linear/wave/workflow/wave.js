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
      },
      "reviewed_head": {
        "type": "string"
      },
      "block_reason_code": {
        "type": "string",
        "enum": ["SLOT_WAIT_TIMEOUT"]
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
                      "enum": ["SLOT_WAIT_TIMEOUT"]
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
  }
};
const common = `Repository: ${args.repo_root}; default branch: ${args.default_branch}.
Configuration, gates, identities and paths: ${JSON.stringify({gates:args.gates,identities:args.identities,paths:args.paths,stack_config:args.stack_config,wave:args.wave})}.
Read ${args.paths.records} for the record contract. No human is present in a node.
Prompt-level rules: stop at a PR; never perform a merge; never create, close or
complete tracker issues. Tracker writes belong exclusively to dispatch lifecycle.
Return STOPPED with stop_reason and evidence when a canonical procedure stops.
Do not launch a separate executor or use a throwaway Workflow worktree.
Every shell command must explicitly address its absolute dispatch worktree.`;
const read = (path, rule) => `Read ${path} and follow it top to bottom. If unreadable,
return a stopped result with evidence. D4 node rule: ${rule}.`;
let eventSequence=0;
const event=(kind,label,details={})=>log('WAVE_EVENT '+JSON.stringify({schema_version:1,
  sequence:++eventSequence,run_id:args.run_id,wave_id:args.wave_id,event:kind,label,...details}));
const call = async (label, prompt, schema, title) => {
  event('node_start',label);
  try {
    const value = await agent(`${common}
${prompt}`, {label, phase: title, schema});
    if (!value) log(`${label}: dropped or skipped; no result`);
    if (value?.state==='STOPPED' && (!value.stop_reason || !value.evidence?.length)) {
      event('node_end',label,{status:'INVALID'});
      log(`${label}: invalid STOPPED record; missing reason/evidence`); return null;
    }
    event('node_end',label,{status:value?.state || value?.verdict || (value ? 'RETURNED' : 'MISSING')});
    return value;
  } catch (error) {
    event('node_error',label);
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
const refuse = (reason, evidence=[]) => {
  log(`Wave STOPPED: ${reason}`);
  if (args.stage==='build') return {state:'STOPPED',run_ids:[args.plan_record?.run_id,args.run_id].filter(Boolean),
    wave_id:args.plan_record?.wave_id || args.wave_id,approved:[],tracks:[],
    seam_check:{state:'NOT_RUN',table:[],reason},open_questions:[],unverified_questions:[],
    stop_reason:reason,evidence:[reason,...evidence]};
  return {state:'STOPPED',run_id:args.run_id,wave_id:args.wave_id,tracks:[],plans:[],
    contract:null,literals:[],sequenced:[],already_active:[],build_command:null,
    stop_reason:reason,evidence:[reason]};
};
// BEGIN SHARED SELECTION
// Pure, bounded selection. The Workflow sandbox embeds this function verbatim.
function selectCandidates(input) {
  const fail = message => { throw new Error('selection: ' + message); };
  const text = x => typeof x === 'string' && x.trim().length > 0;
  const positive = x => Number.isSafeInteger(x) && x > 0;
  const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
  const states = ['SATISFIED','UNSATISFIED','UNKNOWN'];
  const checks = ['scope_plan','scope_build','native','plan_graph','build_graph','foundation'];
  const planChecks = ['scope_plan','native','plan_graph'];
  if (!input || input.schema_version !== 2 || input.complete !== true)
    fail('version 2 and a complete considered pool are required');
  if (!text(input.snapshot_id) || !/^[0-9a-f]{40}$/.test(input.source_revision || '') ||
      !Array.isArray(input.command) || input.command.some(x => !text(x)))
    fail('snapshot, skill revision and exact command tokens are required');
  const limit = input.limit ?? 12, budget = input.search_budget ?? 100000;
  if (!positive(input.requested) || !positive(limit) || input.requested > limit)
    fail('requested must be positive and no greater than the explicit selection limit ' + limit);
  if (!positive(budget) || budget > 1000000) fail('search_budget must be 1..1000000');
  if (!Array.isArray(input.candidates) || input.candidates.length > 1000 || !Array.isArray(input.pairs))
    fail('candidates (at most 1000) and pairs are required; never truncate the pool');
  const seen = new Set();
  const candidates = input.candidates.map(c => {
    if (!c || !text(c.issue_id) || seen.has(c.issue_id)) fail('unique issue ids required');
    seen.add(c.issue_id);
    if (![null,'string'].includes(c.project === null ? null : typeof c.project) ||
        !text(c.milestone) || !Number.isSafeInteger(c.priority) || c.priority < 0 ||
        typeof c.active_release !== 'boolean') fail(c.issue_id + ': project, milestone and rank required');
    if (!c.ownership || !['ACTIVE','INACTIVE','UNKNOWN'].includes(c.ownership.state) ||
        !text(c.ownership.source)) fail(c.issue_id + ': cited ownership required');
    for (const key of checks) {
      const check = c.checks?.[key];
      if (!check || !states.includes(check.state) || !text(check.source) || !text(check.detail))
        fail(c.issue_id + ': cited check required: ' + key);
    }
    if (c.file_scope !== null && (!Array.isArray(c.file_scope) || c.file_scope.some(f => !text(f))))
      fail(c.issue_id + ': file_scope must be paths or null');
    if (!Array.isArray(c.external_overlaps) || c.external_overlaps.some(o =>
      !text(o.source) || !text(o.work) || !Array.isArray(o.files) || o.files.some(f => !text(f))))
      fail(c.issue_id + ': cited external overlaps required (empty when verified absent)');
    const reasons = keys => keys.filter(k => c.checks[k].state !== 'SATISFIED').map(k =>
      ({code:k.toUpperCase(), ...c.checks[k]}));
    const planReasons = reasons(planChecks), buildReasons = reasons(checks);
    if (c.ownership.state !== 'INACTIVE') {
      const r = {code:'OWNERSHIP',state:c.ownership.state === 'ACTIVE' ? 'UNSATISFIED' : 'UNKNOWN',
        source:c.ownership.source,detail:c.ownership.state === 'ACTIVE' ? 'Resume existing work' : 'Verify writer ownership'};
      planReasons.push(r); buildReasons.push(r);
    }
    if (!c.file_scope?.length) buildReasons.push({code:'FILE_SCOPE',state:'UNKNOWN',
      source:input.snapshot_id,detail:'Read-only scope mapping required before implementation selection'});
    const state = rs => rs.some(r => r.state === 'UNSATISFIED') ? 'BLOCKED' : rs.length ? 'UNKNOWN' : 'ELIGIBLE';
    return {...c,plan:{state:state(planReasons),reasons:planReasons},
      build:{state:state(buildReasons),reasons:buildReasons},warnings:[...c.external_overlaps]};
  }).sort((a,b) => Number(b.active_release)-Number(a.active_release) || a.priority-b.priority || compare(a.issue_id,b.issue_id));
  const pairs = new Map(), key = (a,b) => JSON.stringify([a,b].sort(compare));
  for (const p of input.pairs) {
    if (!seen.has(p.a) || !seen.has(p.b) || p.a === p.b || pairs.has(key(p.a,p.b)) ||
        !['INDEPENDENT','DEPENDENCY','INCOMPATIBLE','UNKNOWN'].includes(p.relation) || !text(p.source) || !text(p.detail))
      fail('unique, cited candidate pair assessments required');
    pairs.set(key(p.a,p.b),p);
  }
  for (let i=0;i<candidates.length;i++) for (let j=i+1;j<candidates.length;j++) {
    const a=candidates[i],b=candidates[j];
    const files=(a.file_scope || []).filter(f => b.file_scope?.includes(f));
    if (files.length) {
      a.warnings.push({work:b.issue_id,files,source:input.snapshot_id});
      b.warnings.push({work:a.issue_id,files,source:input.snapshot_id});
    }
  }
  const pool=candidates.filter(c => c.build.state === 'ELIGIBLE');
  const conflicts=pool.map(() => new Set());
  for (let i=0;i<pool.length;i++) for (let j=i+1;j<pool.length;j++) {
    const p=pairs.get(key(pool[i].issue_id,pool[j].issue_id));
    if (!p) fail('missing pair assessment: '+pool[i].issue_id+' / '+pool[j].issue_id);
    if (p.relation !== 'INDEPENDENT') { conflicts[i].add(j); conflicts[j].add(i); }
  }
  const activeCount = indices => indices.filter(i => pool[i].active_release).length;
  const better = (a,b) => {
    if (a.length !== b.length) return a.length > b.length;
    if (activeCount(a) !== activeCount(b)) return activeCount(a) > activeCount(b);
    for (let i=0;i<a.length;i++) if (a[i] !== b[i]) return a[i] < b[i];
    return false;
  };
  const target=Math.min(input.requested,pool.length);
  let best=[],visited=0;
  for (let i=0;i<pool.length && best.length<target;i++)
    if (best.every(j => !conflicts[i].has(j))) best.push(i);
  // The first N ranked candidates, when compatible, are the exact best tie too.
  const triviallyOptimal=best.length===target && best.every((n,i) => n===i);
  const pending=triviallyOptimal ? [] : [{chosen:[],remaining:pool.map((_c,i) => i)}];
  while (pending.length && visited<budget) {
    const {chosen,remaining}=pending.pop(); visited++;
    if (better(chosen,best)) best=chosen;
    if (chosen.length===target || chosen.length+remaining.length<best.length || !remaining.length) continue;
    const [next,...rest]=remaining;
    // LIFO explores the preferred include branch first. No clock-dependent result.
    pending.push({chosen,remaining:rest});
    pending.push({chosen:[...chosen,next],remaining:rest.filter(i => !conflicts[next].has(i))});
  }
  const selected=best.map(i => pool[i].issue_id), optimal=pending.length===0;
  const upper=optimal ? best.length : Math.max(best.length,...pending.map(n => Math.min(target,n.chosen.length+n.remaining.length)));
  const planning=candidates.filter(c => c.plan.state==='ELIGIBLE' && c.build.state!=='ELIGIBLE');
  const planningIds=planning.slice(0,input.requested).map(c => c.issue_id);
  const outcomes=candidates.map(c => {
    let disposition=selected.includes(c.issue_id) ? 'SELECTED' :
      c.ownership.state==='ACTIVE' ? 'ACTIVE' : planningIds.includes(c.issue_id) ? 'PLANNING' :
      planning.includes(c) ? 'PLANNING_QUEUED' : c.build.state==='ELIGIBLE' ? 'SEQUENCED' :
      c.plan.state==='BLOCKED' ? 'BLOCKED' : 'UNKNOWN';
    const constraints=selected.filter(id => id!==c.issue_id).map(id => pairs.get(key(id,c.issue_id)))
      .filter(p => p && p.relation!=='INDEPENDENT');
    const reason=disposition==='SEQUENCED' ? (constraints.length ? 'PAIR_CONSTRAINT' :
      selected.length===input.requested ? 'CAPACITY_OR_PRIORITY' : 'SEARCH_BUDGET') : disposition;
    return {issue_id:c.issue_id,project:c.project,milestone:c.milestone,disposition,reason,
      plan:c.plan,build:c.build,constraints,warnings:c.warnings};
  });
  return {schema_version:2,snapshot_id:input.snapshot_id,command:input.command,source_revision:input.source_revision,
    selected_ids:selected,planning_ids:planningIds,outcomes,
    capacity:{requested:input.requested,limit,selected:selected.length,planning:planningIds.length,
      unfilled:input.requested-selected.length,eligible:pool.length,considered:candidates.length,
      optimal,upper_bound:upper,search_visits:visited,
      reason:selected.length===input.requested ? 'FILLED' : !optimal ? 'SEARCH_BUDGET' :
        pool.length<input.requested ? 'INSUFFICIENT_BUILD_CANDIDATES' : 'PAIR_CONSTRAINTS'}};
}
// END SHARED SELECTION
const cfg = args.wave || {};
const streaming=cfg.execution_mode==='streaming';
if (cfg.execution_mode!=null && !['legacy','streaming'].includes(cfg.execution_mode))
  return refuse('wave.execution_mode must be legacy or streaming');
const workers=cfg.worker_concurrency ?? 3;
if (!Number.isSafeInteger(workers) || workers<1) return refuse('wave.worker_concurrency must be a positive integer');
// Queue thunks in the controller, not paid agents waiting for another agent.
const limiter=limit=>{
  let active=0;const queue=[];
  const pump=()=>{while(active<limit && queue.length){
    const job=queue.shift();active++;
    Promise.resolve().then(job.fn).then(job.resolve,job.reject).finally(()=>{active--;pump();});
  }};
  return fn=>new Promise((resolve,reject)=>{queue.push({fn,resolve,reject});pump();});
};
const workerSlot=limiter(workers);
const testSlots=cfg.test_concurrency ?? 1;
if (!Number.isSafeInteger(testSlots) || testSlots<1) return refuse('wave.test_concurrency must be a positive integer');
const slotPath=args.paths.land.replace(/SKILL\.md$/, 'bin/with-slot');
const gateBudget=`Run expensive configured lint/test/build commands under ${slotPath}
--group local-tests --limit ${testSlots} -- <shell> -c <exact configured command>
from the verified worktree. This bounds local processes without changing test scope.
Never fan out full test suites when project/user policy restricts tests to changed files.
Do not hold this permit while waiting for review or CI.\n`;
const rounds = cfg.max_review_rounds ?? 3;
const concurrency = cfg.review_concurrency ?? 1;
if (!Number.isInteger(rounds) || rounds < 1) return refuse('wave.max_review_rounds must be a positive integer');
if (!Number.isInteger(concurrency) || concurrency < 1) return refuse('wave.review_concurrency must be a positive integer');
if (!cfg.max_review_rounds) log('wave.max_review_rounds default: 3 (documented bounded review evidence)');
if (!cfg.review_concurrency) log('wave.review_concurrency default: 1 (shared reviewer quota)');

// Both PR flags share syntax and deduplication; forwarding keeps every occurrence.
const parsePrFlags=(tokens, flag, only=false) => {
  if (!Array.isArray(tokens)) return {error:`${flag}: flags must be argument tokens`};
  const flags=[], numbers=new Set();
  for (let i=0;i<tokens.length;i++) {
    if (tokens[i]!==flag) {
      if (only) return {error:`graph_update_flags accepts only ${flag} pairs`};
      continue;
    }
    const value=tokens[++i];
    if (value===undefined || String(value).startsWith('--'))
      return {error:`${flag} "<missing>": requires a positive PR number`};
    if (!/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value)))
      return {error:`${flag} ${JSON.stringify(value)}: requires a positive PR number`};
    flags.push(flag,value); numbers.add(Number(value));
  }
  return {flags,numbers};
};
// Caller observations are required before selection/build; nodes compare live
// scoped conditions with these observations before writes. Build never inherits flags.
const graphFlag='--accept-graph-update';
const localFlag='--local-graph';
const graphTokens=args.stage==='plan' ? (args.selection || []) : (args.graph_update_flags || []);
if (!Array.isArray(graphTokens)) return refuse('graph flags must be argument tokens');
const prTokens=[];
const indexPath=args.repo_root.replace(/\/+$/,'')+'/orchestration/index.json';
let localIndex=null;
for (let i=0;i<graphTokens.length;i++) {
  if (graphTokens[i]!==localFlag) { prTokens.push(graphTokens[i]); continue; }
  if (localIndex) return refuse(`${localFlag}: supply this flag only once`);
  localIndex=indexPath;
}
const parsedGraph=parsePrFlags(prTokens,graphFlag,args.stage==='build');
if (parsedGraph.error) return refuse(parsedGraph.error);
if (localIndex && parsedGraph.numbers.size) return refuse('choose either an approved local graph or pending graph PRs');
const graphFlags=parsedGraph.flags;
if (localIndex) graphFlags.push(localFlag);
const graphUpdates=new Map();
for (const number of parsedGraph.numbers) {
  const pr=Array.isArray(args.accepted_graph_updates) ? args.accepted_graph_updates.find(p=>p.number===number) : null;
  if (!pr || pr.state!=='OPEN' || pr.base!=='main' || pr.validation_exit!==0 ||
      ![0,1].includes(pr.coverage_exit) ||
      pr.coverage_state!==(pr.coverage_exit===0 ? 'CURRENT' : 'UPDATE_REQUIRED') ||
      !/^[0-9a-f]{40}$/.test(pr.head_sha || '') ||
      typeof pr.url!=='string' || !pr.url || !Array.isArray(pr.project_ids) || !pr.project_ids.length ||
      pr.reviewed_head_sha!==pr.head_sha || typeof pr.review_source!=='string' || !pr.review_source.trim())
    return refuse(`${graphFlag} ${JSON.stringify(String(number))}: missing verified reviewed OPEN graph-update coverage`);
  graphUpdates.set(number,pr);
}
const publication={...args.graph_publication};
delete publication.local_graph;
const validUTC=value => typeof value==='string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().replace('.000Z','Z')===value.replace('.000Z','Z');
if (!publication || !Array.isArray(publication.projects))
  return refuse('graph publication: project coverage evidence required; use an empty projects array for project-less work');
if (publication.projects.length && (!/^[0-9a-f]{40}$/.test(publication.main_sha || '') ||
    !validUTC(publication.checked_at) || !/^\d{4}-\d{2}-\d{2}$/.test(args.date || '') ||
    publication.checked_at.slice(0,10)!==args.date))
  return refuse('graph publication: fresh main and project coverage audit required for the invocation date');
const projectUUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const local=args.approved_local_graph;
const localFields=['index_path','manifest_path','index_digest','manifest_digest','source_revision'];
const sameLocalPins=(a,b)=>!!a && !!b && localFields.every(k=>a[k]===b[k]);
if (localIndex && (!local || local.index_path!==localIndex ||
    !/^orchestration\/[a-z][a-z0-9_-]*\.json$/.test(local.manifest_path || '') ||
    !/^sha256:[0-9a-f]{64}$/.test(local.index_digest || '') ||
    !/^sha256:[0-9a-f]{64}$/.test(local.manifest_digest || '') ||
    !/^[0-9a-f]{40}$/.test(local.source_revision || '') || local.validation_exit!==0 ||
    ![0,1].includes(local.coverage_exit) || local.coverage_state!==(local.coverage_exit===0?'CURRENT':'UPDATE_REQUIRED') ||
    local.checked_at!==publication.checked_at || !publication.projects.length ||
    !Array.isArray(local.project_ids) || !local.project_ids.length ||
    new Set(local.project_ids).size!==local.project_ids.length || local.project_ids.some(id=>!projectUUID.test(id))))
  return refuse('local graph: fresh indexed validation, provenance, digests and complete live coverage audit required');
const localPins=localIndex ? Object.fromEntries(localFields.map(k=>[k,local[k]])) : null;
if (localPins) publication.local_graph=localPins;
const auditedProjects=new Set();
const coverageWarnings=[];
for (const p of publication.projects) {
  if (!p || typeof p.project_id!=='string' || !projectUUID.test(p.project_id) || auditedProjects.has(p.project_id) ||
      typeof p.project_name!=='string' || !p.project_name ||
      typeof p.view_path!=='string' || !p.view_path || p.view_path.startsWith('/') || p.view_path.split('/').includes('..') ||
      !['CURRENT','ACCEPTED_UPDATE','UPDATE_REQUIRED','UNKNOWN','APPROVED_LOCAL'].includes(p.state))
    return refuse('graph publication: invalid or duplicate project evidence');
  auditedProjects.add(p.project_id);
  if (p.state==='APPROVED_LOCAL') {
    if (!localIndex || !local.project_ids.includes(p.project_id))
      return refuse('local graph: explicit approval and matching project audit required');
    if (local.coverage_state==='UPDATE_REQUIRED') coverageWarnings.push(p);
    continue;
  }
  if (p.state==='CURRENT') continue;
  const pr=graphUpdates.get(p.pr_number);
  if (p.state==='ACCEPTED_UPDATE' && pr) {
    if (p.head_sha!==pr.head_sha || !pr.project_ids.includes(p.project_id))
      return refuse(`graph publication: ${p.project_name} does not match the verified graph-update head/project`);
  } else coverageWarnings.push(p);
}
if (localIndex && (publication.projects.some(p=>p.state!=='APPROVED_LOCAL') ||
    local.project_ids.some(id=>!auditedProjects.has(id))))
  return refuse('local graph: all affected project audits must use the approved index');
// Coverage warnings do not determine execution eligibility. Consume the separate
// audited candidate reports; nodes still acquire live evidence before writes.
const admissions=args.graph_admission || [];
const shaDigest=value=>/^sha256:[0-9a-f]{64}$/.test(value || '');
if (!Array.isArray(admissions)) return refuse('graph admission: audit reports must be an array');
// Apply the same build-report validation to live input and Run A's stored input.
// Prior reports use their original invocation date, even when Run B is later.
const validAdmissionReports=(reports,pins,date,transition="build") => Array.isArray(reports) ? reports.filter(r=>
  r && r.schema_version===1 && r.main_sha===pins?.main_sha &&
  validUTC(r.checked_at) && r.checked_at.slice(0,10)===date &&
  shaDigest(r.graph_digest) && shaDigest(r.base_digest) && shaDigest(r.issue_evidence_digest) &&
  r.transition===transition && Array.isArray(r.candidates) &&
  r.evidence?.issues?.complete===true && r.evidence?.request && r.delta &&
  Array.isArray(r.delta.added_nodes) && r.delta.added_nodes.length<=3 &&
  Array.isArray(r.delta.changed_edges) && !r.delta.changed_edges.length
) : [];
// Incomplete unrelated reports and plan-only reports cannot shadow eligible builds.
const validAdmissions=validAdmissionReports(admissions,publication,args.date);
const candidateAdmission=(track,reports=validAdmissions,pins=publication,current=true,transition="build") => {
  if (track.project===null) return {exempt:true};
  if (!/^[0-9a-f]{40}$/.test(pins?.main_sha || '')) return null;
  const projects=Array.isArray(pins?.projects) ? pins.projects.filter(p=>
    p && (p.project_id===track.project || p.project_name===track.project)) : [];
  if (projects.length!==1 || projects[0].state==='UNKNOWN' ||
      !projectUUID.test(projects[0].project_id || '') ||
      !['CURRENT','UPDATE_REQUIRED','ACCEPTED_UPDATE','APPROVED_LOCAL'].includes(projects[0].state) ||
      (projects[0].state==='ACCEPTED_UPDATE' &&
       (!Number.isSafeInteger(projects[0].pr_number) || projects[0].pr_number<1 ||
        !/^[0-9a-f]{40}$/.test(projects[0].head_sha || ''))) ||
      (current && projects[0].state==='ACCEPTED_UPDATE' && !graphUpdates.has(projects[0].pr_number))) return null;
  const matches=reports.flatMap(report=>report.candidates.map(candidate=>({report,candidate})))
    .filter(({candidate:c})=>c && c.project_id===projects[0].project_id && c.identifier===track.issue_id);
  if (matches.length!==1) return null;
  const {report,candidate:c}=matches[0];
  const localProject=projects[0].state==='APPROVED_LOCAL';
  if (localProject && (!sameLocalPins(report.local_graph,pins.local_graph) ||
      (current && !sameLocalPins(report.local_graph,localPins)) ||
      !report.evidence?.local_scope_sources || report.delta.added_nodes.length)) return null;
  if (report.graph_sha!==(localProject ? null : projects[0].state==='ACCEPTED_UPDATE' ? projects[0].head_sha : pins.main_sha) ||
      report.transition!==transition || c.state!=='ELIGIBLE' ||
      typeof c.issue_id!=='string' || !c.issue_id || typeof c.node_id!=='string' || !c.node_id ||
      !['PUBLISHED','LOCAL_RECONCILIATION','APPROVED_LOCAL'].includes(c.mode) ||
      (c.mode==='APPROVED_LOCAL')!==localProject ||
      !Array.isArray(c.closure) || !c.closure.includes(c.node_id) ||
      !shaDigest(c.closure_graph_digest) || !shaDigest(c.closure_evidence_digest) || !Array.isArray(c.unmet) || c.unmet.length ||
      (c.mode==='LOCAL_RECONCILIATION' && !report.delta.added_nodes.some(n=>n.id===c.node_id && n.issue_ref===c.issue_id))) return null;
  return {report,candidate:c};
};
const candidateEligible=track => !!candidateAdmission(track);
// Run A -> B1 and B1 -> B3 must preserve the same candidate conditions.
const candidateChanges=(before,after) => {
  const publishedRepair=before.mode==='LOCAL_RECONCILIATION' && after.mode==='PUBLISHED';
  const comparisons=['issue_id','project_id','node_id'].map(field=>({field,prior:before[field],current:after[field]}));
  for (const field of ['closure_graph_digest','closure_evidence_digest']) {
    const priorField=publishedRepair ? 'published_'+field : field;
    comparisons.push({field,prior_field:priorField,prior:before[priorField],current:after[field]});
  }
  if (!publishedRepair) comparisons.push({field:'mode',prior:before.mode,current:after.mode});
  return comparisons.filter(c=>c.prior!==c.current ||
    (c.prior_field?.startsWith('published_') && !shaDigest(c.prior)));
};
const admissionEvidence='Graph admission evidence: '+JSON.stringify(admissions);
const graphEvidence='Graph publication evidence: '+JSON.stringify(publication);
const projectEvidence=(pins,t)=>t ? {...pins,projects:pins.projects.filter(p=>p.project_id===t.project || p.project_name===t.project)} : pins;
const admissionProjection=(report,t)=>{
  if (!report || !t) return report;
  const c=report.candidates.find(c=>c.identifier===t.issue_id);
  if (!c) return null;
  const closure=new Set(c.closure);
  const nodes=(report.evidence?.request?.nodes || []).filter(n=>closure.has(n.node_id));
  return {projection:true,main_sha:report.main_sha,graph_sha:report.graph_sha,transition:report.transition,
    checked_at:report.checked_at,local_graph:report.local_graph,
    local_scope_sources:report.evidence?.local_scope_sources,candidate:c,nodes,
    events:(report.evidence?.request?.events || []).filter(e=>closure.has(e.node_id)),delta:report.delta,
    note:'Context projection only; full unedited report is retained in the wave audit. Recollect full live evidence before writes.'};
};
const graphContext=(t=null,transition='build')=>`${localIndex ? `Explicit local graph approval from THIS invocation: ${JSON.stringify(graphFlags)}.
Use only this owning local index/manifest: ${JSON.stringify(localPins)}. Re-run indexed
validation, local coverage and graph-admission --local-index ${localIndex} --main-ref <fresh main>
before every transition. Use the saved local scope snapshots for Run A comparison;
re-read full current scope sections, exclusions and original human decisions.
Changed index/manifest/provenance pins require a new plan and human approval.
No graph PR, graph on main or Linear document publication is required or authorized.
The flag approves graph use only, never scope, a human_decision event, a plan or a merge.
Keep native blockers, typed event dependencies, independent tracks and human checkpoints.
` : ''}For work linked to a Linear project, before selection or execution recheck the canonical graph publication gate
against fresh implementation main, the chosen graph source and live evidence for the candidate and its relevant dependency closure.
Project coverage gaps are warnings; never exclude all mapped candidates because an unrelated ticket is missing.
Validated graph publication evidence: ${JSON.stringify(projectEvidence(publication,t))}.
Candidate admission context: ${JSON.stringify(validAdmissionReports(admissions,publication,args.date,transition).map(r=>admissionProjection(r,t)).filter(Boolean))}.
Other missing/incomplete audits do not authorize their candidates; report them separately.
Validated accepted PR snapshots: ${JSON.stringify([...graphUpdates.values()])}.
Re-fetch main and accepted PR heads before writes. An accepted head moving during
this node returns STOPPED before any write; the caller must obtain a new exact-head
review and admission before retrying. If main moved, refresh the candidate audit.
${args.stage==='plan' ? `No Run A approval exists yet. Require live main SHA to equal the
fresh audit's main_sha before writes. Changed or unavailable conditions stop this
planning invocation before contract publication; repeat the plan audit.` :
`Compare this track's closure_graph_digest and closure_evidence_digest with the
explicit Run A approved observations supplied below. For LOCAL_RECONCILIATION to
PUBLISHED only, compare Run A's published_closure_graph_digest and
published_closure_evidence_digest with the current full candidate digests instead.
Require valid saved publication digests; never invent missing evidence. Other mode
changes require a new plan. Unrelated changes preserve
approval; changed scope, prerequisites, acceptance, human gates, policy, mode or
missing fresh evidence returns STOPPED for this track before any write, then
repeat condition analysis and plan approval. Never silently accept a changed condition.`}
Explicit graph bypass tokens from THIS invocation: ${JSON.stringify(graphFlags)}.
Forward only these tokens to composed dispatch/land/review-comments/pr-loop procedures.
Do not inherit a bypass from an earlier plan or approval. Revalidate candidate eligibility
and the exact local delta against fresh main/live issue evidence at every transition;
other scope, dependency and approval gates still apply. Record these SHA pins in
plan risks and execution evidence. Project-less tracks are exempt.\n`;

const graphPrompt=graphContext();
if (args.stage === 'plan') {
  const v2=args.selection_version!==1;
  let assessment=null;
  if (v2) {
    try {
      const snapshot=args.selection_snapshot;
      const tokens=args.selection || [], position=tokens.indexOf('--parallel');
      const raw=position<0 || tokens[position+1]===undefined || tokens[position+1].startsWith('--') ? '3' : tokens[position+1];
      if (!/^[1-9][0-9]*$/.test(raw)) throw new Error('invalid --parallel value');
      if (snapshot?.requested!==Number(raw) || snapshot.limit!==(cfg.selection_limit ?? 12) ||
          JSON.stringify(snapshot.command)!==JSON.stringify(tokens) ||
          snapshot.main_sha!==publication.main_sha || snapshot.checked_at!==publication.checked_at)
        throw new Error('assessment must match invocation count, limit, tokens and fresh publication pins');
      assessment=selectCandidates(snapshot);
    } catch(error) { return refuse(String(error.message)); }
  }

  const accepted = new Map();
  const parsedOverlap=parsePrFlags(args.selection || [],'--accept-overlap');
  if (parsedOverlap.error) return refuse(parsedOverlap.error);
  for (const number of parsedOverlap.numbers) {
    const value=String(number);
    const pr=Array.isArray(args.accepted_prs) ? args.accepted_prs.find(p=>p.number===number) : null;
    if (!pr || pr.state!=='OPEN')
      return refuse(`--accept-overlap ${JSON.stringify(value)}: missing OPEN preflight evidence`);
    if ([pr.title,pr.author,pr.head_sha].some(v=>typeof v!=='string' || !v) ||
        !Number.isInteger(pr.changed_files) ||
        !Array.isArray(pr.files) || pr.files.length!==pr.changed_files ||
        pr.files.some(f=>typeof f.filename!=='string' || !f.filename ||
          (f.previous_filename!==undefined && typeof f.previous_filename!=='string')))
      return refuse(`--accept-overlap ${JSON.stringify(value)}: incomplete preflight diff or metadata`);
    accepted.set(number,pr);
  }
  phase('Select');
  const selected = await call('A1 select', `${graphPrompt}Project coverage warnings (evaluate candidates individually): ${JSON.stringify(coverageWarnings)}.
${read(args.paths.next, 'selection is read-only; no adaptation')}
Run /next with argument tokens ${JSON.stringify(args.selection)} in parallel mode.
Pass every token unchanged, including repeated --accept-overlap flags and values;
/next owns their validation and deduplication.
Also preserve every graph source flag occurrence and apply its admission procedure.
${v2 ? `Version 2 deterministic assessment: ${JSON.stringify(assessment)}.
Return exactly selected_ids in tracks and exactly planning_ids in planning_tracks.
Keep every exclusion and warning in the checkpoint. Planning tracks have no build permission.
Shared file paths are integration warnings, not hard dependencies. Never reinterpret
an ELIGIBLE graph result as plan approval or semantic scope authorization.` :
'PLAN_ONLY candidates must go in sequenced with the unmet build condition and source, never tracks. They do not count toward N and must not reach --approve all.'}
Return all implementation-eligible tracks, sequenced and already_active entries. TRACK branch/worktree are
proposals only. Select no more than requested; explicitly report every excluded issue.
Set each TRACK.project to the issue's Linear project_id copied verbatim from
${JSON.stringify(publication.projects.map(p=>p.project_id))}, or null when the issue has no
Linear project. Never a project name, never a name with the UUID appended:
the script compares the string exactly and stops the run on any other value.`, schemas.SELECT, 'Select');
  const record = {state:'STOPPED', run_id:args.run_id, wave_id:args.wave_id,
    tracks:selected?.tracks || [], plans:[], contract:null, literals:[],
    sequenced:selected?.sequenced || [], already_active:selected?.already_active || [],
    build_command:null, stop_reason:null, evidence:[graphEvidence,admissionEvidence]};
  if (!selected) { record.stop_reason='A1 returned no record'; record.evidence.push(record.stop_reason); return record; }
  const planning=v2 ? selected.planning_tracks : [];
  if (v2) {
    const same=(tracks,ids)=>Array.isArray(tracks) && tracks.length===ids.length &&
      new Set(tracks.map(t=>t.issue_id)).size===ids.length && ids.every(id=>tracks.some(t=>t.issue_id===id));
    if (!same(selected.tracks,assessment.selected_ids) || !same(planning,assessment.planning_ids))
      return refuse('A1 membership differs from deterministic assessment');
    for (const t of [...selected.tracks,...planning]) {
      const c=args.selection_snapshot.candidates.find(c=>c.issue_id===t.issue_id);
      if (c.project!==t.project || c.milestone!==t.milestone ||
          JSON.stringify([...(c.file_scope || [])].sort())!==JSON.stringify([...t.file_scope].sort()))
        return refuse('A1 changed assessed scope or project for '+t.issue_id);
    }
    Object.assign(record,{schema_version:2,selection_report:JSON.stringify(assessment),planning_tracks:planning,planning_plans:[]});
    record.evidence.push('Selection snapshot: '+JSON.stringify(args.selection_snapshot));
    const planReports=validAdmissionReports(admissions,publication,args.date,'plan');
    if (planning.some(t=>!candidateAdmission(t,planReports,publication,true,'plan')))
      return refuse('planning-only candidate lacks eligible plan admission');
  }

  for (const id of [...selected.sequenced, ...selected.already_active]) log(`A1 skipped: ${id}`);
  if (!selected.tracks.length && !planning.length) { record.state='EMPTY'; return record; }
  if (selected.tracks.some(t=>!candidateEligible(t))) {
    record.stop_reason='graph publication: a selected track has no unambiguous eligible candidate audit';
    record.evidence.push(record.stop_reason);
    for (const t of selected.tracks.filter(t=>!candidateEligible(t))) {
      const n=publication.projects.filter(p=>p.project_id===t.project || p.project_name===t.project).length;
      record.evidence.push(`${t.issue_id}: TRACK.project ${JSON.stringify(t.project)} matches ${n} of ${publication.projects.length} graph publication projects`+
        (n===1 ? '; no single ELIGIBLE build candidate' : ''));
    }
    return record;
  }
  if (new Set(selected.tracks.map(t=>t.issue_id)).size !== selected.tracks.length) {
    record.stop_reason='A1 returned duplicate issue ids'; record.evidence.push(record.stop_reason); return record;
  }
  const scan = selected.tracks.length ? await call('A2 shared-literal scan', `${read(args.paths.wave, 'scan only; do not dispatch or implement')}
Read every issue description and file scope in ${JSON.stringify(selected.tracks)}.
List every literal two or more tracks must agree on: status tokens, schema fields,
config keys, paths, marker comments. Return literals with files, participating ids, why.`, schemas.SCAN, 'Select') : {literals:[]};
  if (!scan) { record.stop_reason='A2 returned no record'; record.evidence.push(record.stop_reason); return record; }
  record.literals=scan.literals;
  if (scan.literals.length) {
    if (!cfg.contract_dir) {
      record.stop_reason='wave.contract_dir is required for shared literals';
      record.evidence.push('A2 found shared literals',JSON.stringify(scan.literals));
      log(record.stop_reason); return record;
    }
    record.contract=await call('A3 contract', `${graphPrompt}${read(args.paths.wave, 'contract preparation only')}
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
      record.evidence.push(...(record.contract?.evidence || [record.stop_reason])); log(record.stop_reason); return record;
    }
  }
  phase('Plan');
  const planTracks=[...selected.tracks,...planning];
  const plans=await pipeline(planTracks, async (_prev,t) => workerSlot(async () => {
    const overlaps=[...accepted.values()].map(pr=>({number:pr.number,title:pr.title,
      author:pr.author,head_sha:pr.head_sha,
      files:[...new Set(pr.files.flatMap(f=>[f.filename,f.previous_filename].filter(Boolean)))]
        .filter(file=>t.file_scope.includes(file))})).filter(pr=>pr.files.length);
    const overlapPrompt=!v2 && accepted.size ? `Before dispatch §1 or any workspace/tracker write,
perform a read-only overlap preflight for this track's verified file scope.
Relevant accepted overlaps from caller preflight: ${JSON.stringify(overlaps)}.
The selection-time OPEN gate has passed; do not reapply it to later state changes.
Check current head/state for the caller's accepted_prs snapshots. If a head moved,
refresh its complete diff using next's Accepted file overlaps procedure and
recompute intersections; never use a stale snapshot. Re-fetch only relevant PRs'
full diffs when the head is unchanged. An unrelated accepted PR merging or
closing does not stop this track. If scope-relevant diff evidence cannot be verified,
return STOPPED before any dispatch write. Establish plan files before dispatch;
any scope expansion requires repeating the overlap preflight before writes.
Under risks, list every accepted overlap that touches this plan's files, with
PR number, title, author and exact overlapping files. For MERGED, record the
merge commit and continue; rebase onto ${args.default_branch} before land Step 7
(gates before push). For CLOSED unmerged, record that the active overlap is gone
and continue. For OPEN, record the Pending overlap PR-body requirement: branch
from the default branch, never base on an accepted PR's branch or rebase onto
its head. Before land Step 7, fetch; if it has merged, rebase onto the fetched
default branch and resolve the files. Otherwise keep the PR based on the default
branch and list the PR/files under Pending overlap. Whichever PR merges second
rebases onto the default branch and re-runs the gates before its merge. This is planning only:
record these future build actions as risks; do not rebase during A4.
No intersection means no overlap risk or rebase instruction for this track.
` : '';
    const planningOnly=planning.some(x=>x.issue_id===t.issue_id);
    const stagePrompt=planningOnly ? `Planning-only lane: use PLAN transition admission, not build admission.
Full plan admission observations: ${JSON.stringify(validAdmissionReports(admissions,publication,args.date,'plan').map(r=>admissionProjection(r,t)).filter(Boolean))}.
Produce a read-only plan or decision brief; retain every unmet build condition.
This track cannot enter this wave's build approval; a fresh selection is required.\n` : '';
    const integrationPrompt=v2 ? `Selection warnings and constraints for this track:
${JSON.stringify(assessment.outcomes.find(c=>c.issue_id===t.issue_id))}.
Record overlaps as plan risks. Real dependencies still block. Before merge, rebase
onto current default main, rerun relevant gates and review any changed head.\n` : '';
    const p=await call(`A4 plan ${t.issue_id}`, `${graphContext(t,planningOnly?'plan':'build')}${stagePrompt}${integrationPrompt}${overlapPrompt}${read(args.paths.dispatch, '--plan-only: sections 1–3 unchanged; section 4 plan in current agent, no executor launch')}
Dispatch exact issue ${t.issue_id} with --plan-only ${graphFlags.join(' ')}. Proposed track: ${JSON.stringify(t)}.
Contract: ${JSON.stringify(record.contract)}. Return criteria citations, files, tests,
risks, status read-back and verified absolute worktree. No implementation permission.`, schemas.PLAN, 'Plan');
    if (!p || p.issue_id !== t.issue_id || !p.worktree.startsWith('/') || !p.branch) return stoppedPlan(t,'A4 missing or wrong issue record');
    if (p.state==='STOPPED') log(`${t.issue_id}: STOPPED ${p.stop_reason}`);
    return p;
  }));
  record.plans=selected.tracks.map((t,i)=>plans[i] || stoppedPlan(t,'A4 pipeline dropped track'));
  if (v2) {
    record.planning_plans=planning.map((t,i)=>plans[selected.tracks.length+i] || stoppedPlan(t,'A4 planning lane dropped track'));
    record.planning_tracks=planning.map((t,i)=>({...t,worktree:record.planning_plans[i].worktree,branch:record.planning_plans[i].branch}));
    if (!record.plans.some(p=>p.state==='PLANNED') && record.planning_plans.some(p=>p.state==='PLANNED')) {
      record.state='PLANNING_ONLY';return record;
    }
  }
  record.tracks=selected.tracks.map((t,i)=>({...t,worktree:record.plans[i].worktree,branch:record.plans[i].branch}));
  if (!record.plans.some(p=>p.state==='PLANNED')) {
    record.stop_reason='no PLANNED track; every A4 plan stopped';
    record.evidence.push(...record.plans.map(p=>`${p.issue_id}: ${p.stop_reason}`));
    log(`Wave STOPPED: ${record.stop_reason}`); return record;
  }
  record.state='AWAITING_APPROVAL';
  record.build_command='/wave build --approve all'+(localIndex ? ' --local-graph' : '');
  return record;
}
if (args.stage !== 'build') throw new Error('args.stage must be plan or build');
const a=args.plan_record;
if (!a || a.state !== 'AWAITING_APPROVAL') return refuse('Run B requires Run A AWAITING_APPROVAL record');
if (a.schema_version===2) {
  try {
    const snapshot=JSON.parse(a.evidence.find(e=>e.startsWith('Selection snapshot: ')).slice('Selection snapshot: '.length));
    const assessment=selectCandidates(snapshot);
    if (JSON.stringify(assessment)!==a.selection_report || a.tracks.length!==assessment.selected_ids.length ||
        new Set(a.tracks.map(t=>t.issue_id)).size!==a.tracks.length ||
        a.tracks.some(t=>!assessment.selected_ids.includes(t.issue_id)) ||
        a.plans.some(p=>!assessment.selected_ids.includes(p.issue_id)))
      throw new Error('build membership must remain in the assessed implementation set');
  } catch(error) { return refuse('version 2 selection record invalid: '+error.message); }
}

const ids=args.approve === 'all' ? a.plans.filter(p=>p.state==='PLANNED').map(p=>p.issue_id) : args.approve;
if (!Array.isArray(ids) || !ids.length || ids.some(id=>!a.plans.some(p=>p.issue_id===id && p.state==='PLANNED')))
  return refuse('approve must name existing PLANNED issues, or all');
const approved=a.tracks.filter(t=>ids.includes(t.issue_id));
// Approval belongs to the selected mapped units and their conditions, not a
// repository SHA or the whole project's membership. Isolate affected tracks.
const priorEvidence=a.evidence?.find(e=>e.startsWith('Graph publication evidence: '));
let priorPublication;
try { priorPublication=priorEvidence && JSON.parse(priorEvidence.slice('Graph publication evidence: '.length)); }
catch { return refuse('graph publication: invalid Run A SHA evidence'); }
if ((localIndex || priorPublication?.local_graph) && (!localIndex || !sameLocalPins(priorPublication?.local_graph,localPins)))
  return refuse('local graph: build requires renewed explicit approval of unchanged Run A index/manifest/provenance pins; repeat the plan');
let priorAdmissions;
try { priorAdmissions=JSON.parse(a.evidence?.find(e=>e.startsWith('Graph admission evidence: '))?.slice('Graph admission evidence: '.length)); }
catch { return refuse('graph admission: missing Run A candidate evidence'); }
const priorDate=validUTC(priorPublication?.checked_at) ? priorPublication.checked_at.slice(0,10) : null;
const validPriorAdmissions=validAdmissionReports(priorAdmissions,priorPublication,priorDate);
const priorGraphEvidence='Run A graph publication evidence: '+JSON.stringify(priorPublication);
const priorAdmissionEvidence='Run A graph admission evidence: '+JSON.stringify(priorAdmissions);
const auditTrail=[graphEvidence,admissionEvidence,priorGraphEvidence,priorAdmissionEvidence];
const approvedGraphPrompt=t => t.project===null ? '' : `Run A approved observations for ${t.issue_id}: ${JSON.stringify({
  publication:projectEvidence(priorPublication,t),admission:admissionProjection(candidateAdmission(t,validPriorAdmissions,priorPublication,false)?.report,t)})}.
Run A pinned main ${priorPublication.main_sha}; Run B validated main ${publication.main_sha}.
Verify ${priorPublication.main_sha} is an ancestor of the fetched ${args.default_branch};
if not, return STOPPED before any write. Diff the cited scope sources at the saved
and fresh graph SHAs (or saved/fresh local scope snapshots) and recheck their full relevant sections, including exclusions.
Exact quote equality alone does not prove scope applicability.\n`;
const preflightStops=new Map();
const buildAdmissions=new Map();
for (const t of approved.filter(t=>t.project!==null)) {
  const prior=candidateAdmission(t,validPriorAdmissions,priorPublication,false);
  // Display names may change between runs; the approved canonical project ID
  // binds the current audit without allowing an issue to change projects.
  const current=candidateAdmission(prior ? {...t,project:prior.candidate.project_id} : t);
  if (current) buildAdmissions.set(t.issue_id,current);
  if (!current || !prior)
    preflightStops.set(t.issue_id,`graph publication/admission: ${t.issue_id} has no unambiguous eligible candidate audit for both runs; repeat condition analysis and plan approval`);
  else {
    const changed=candidateChanges(prior.candidate,current.candidate);
    if (changed.length) preflightStops.set(t.issue_id,`graph admission: ${t.issue_id} changed since Run A; ${JSON.stringify({
      prior:{main_sha:prior.report.main_sha,graph_sha:prior.report.graph_sha},
      current:{main_sha:current.report.main_sha,graph_sha:current.report.graph_sha},
      comparisons:changed})}; repeat reconciliation and plan approval`);
  }
}
if (approved.every(t=>preflightStops.has(t.issue_id))) return refuse([...preflightStops.values()].join('; '),auditTrail);
const mainMoved=approved.some(t=>t.project!==null && !preflightStops.has(t.issue_id)) && priorPublication.main_sha!==publication.main_sha;
const mainMove=mainMoved ? `Main moved since Run A: ${priorPublication.main_sha} -> ${publication.main_sha}; approved candidate graph and closure digests unchanged` : null;
const report={state:'COMPLETE',run_ids:[a.run_id,args.run_id],wave_id:a.wave_id,
  approved:ids,tracks:[],seam_check:{state:'NOT_RUN',table:[],reason:'A2 found no shared literals'},
  open_questions:[],unverified_questions:[],stop_reason:null,evidence:[...auditTrail,...(mainMove ? [mainMove] : [])]};
report.evidence.push('Execution budgets: '+JSON.stringify({mode:streaming?'streaming':'legacy',
  workers,reviewers:concurrency,test_slots:testSlots}));
if (mainMove) log(mainMove);
for (const t of a.tracks) if (!ids.includes(t.issue_id)) log(`${t.issue_id}: skipped; not approved`);
phase('Build');
const buildOne=async t => {
  if (preflightStops.has(t.issue_id)) {
    log(`${t.issue_id}: STOPPED ${preflightStops.get(t.issue_id)}`);
    return {...stoppedBuild(t,preflightStops.get(t.issue_id)),evidence:[preflightStops.get(t.issue_id),...auditTrail]};
  }
  const plan=a.plans.find(p=>p.issue_id===t.issue_id);
  const r=await call(`B1 build ${t.issue_id}`, `${graphContext(t)}${approvedGraphPrompt(t)}${read(args.paths.dispatch, 'wave build approval permits only the supplied approved plan and section 5 lifecycle')}
${read(args.paths.land, 'headless land returns STOPPED with evidence instead of waiting')}${gateBudget}
Human approval: ${JSON.stringify(ids)} for wave ${a.wave_id}. Approved plan: ${JSON.stringify(plan)}.
Use the existing dispatch worktree ${t.worktree}, branch ${t.branch}. Read back the
branch/worktree pairing and refuse drift. Fetch and rebase onto ${args.default_branch}.
Contract: ${JSON.stringify(a.contract)}. If present, first verify its PR is merged
AND its commit/file is on the fetched default branch; a PR state alone is insufficient.
Verify exact contract contents match ${JSON.stringify(a.literals)} when a contract is
required. Empty literals with no contract are valid; a required missing contract stops.
Implement the approved plan, follow land to a PR, then dispatch section 5's
review-status write/read-back if defined. Include every open question.`, schemas.TRACK_RESULT, 'Build');
  if (r?.state==='PR_OPEN' && (!r.pr || !r.head_sha || r.gates.lint.exit!==0 || r.gates.test.exit!==0 || !r.acceptance_evidence.length)) {
    log(`${t.issue_id}: STOPPED; incomplete PR/gate/acceptance evidence`);
    return stoppedBuild(t,'B1 incomplete PR/gate/acceptance evidence');
  }
  if (!r || r.issue_id !== t.issue_id) return stoppedBuild(t,'B1 missing or wrong issue record');
  if (r.state==='STOPPED') log(`${t.issue_id}: STOPPED ${r.stop_reason}`);
  return r;
};
const results=new Array(approved.length).fill(null);
const mismatched=new Set();
const legacySeams=async()=>{
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
mismatched.clear();
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

for (const t of active) if (mismatched.has(t.issue_id)) log(`${t.issue_id}: skipped review; SEAM_MISMATCH`);

};
if (streaming) phase('Review');
const reviews={};
const blockedReview=(r,finding)=>({pr:r.pr,verdict:'BLOCKED',rounds:0,open_findings:[finding],model_routing:[],open_questions:[]});
// review_concurrency serializes B3, so a later track's review can start long after
// Run B validated main. A read-only node observes live main first. When main moved,
// the script proceeds only if Run B's main is an ancestor, the PR head merges cleanly
// and a fresh build admission at live main preserves this candidate's conditions.
const readmit=async (t,r) => {
  if (t.project===null) return {prompt:''};
  const current=buildAdmissions.get(t.issue_id);
  const project=publication.projects.find(p=>p.project_id===current.candidate.project_id);
  const ref=localIndex ? `--local-index ${localIndex} --main-ref <live main>` :
    project.state==='ACCEPTED_UPDATE' ? `--ref ${project.head_sha} --main-ref <live main>` : '--ref <live main>';
  const obs=await call(`B3 admission ${t.issue_id}`, `${graphContext(t)}${approvedGraphPrompt(t)}${read(args.paths.wave, 'B3 admission only: read-only observation; never review, fix, push, comment or write the tracker')}
B3 admission for ${t.issue_id}, PR ${r.pr}, worktree ${t.worktree}. Fetch literal main and record
its exact SHA and UTC checked_at. Run B validated main ${publication.main_sha}. If live main equals
it, return OBSERVED with null ancestor_exit, merge_tree_exit and head_sha;
admission_report is null except local mode, which always requires a fresh full local audit.
Otherwise record exact exit codes without interpreting them:
git -C ${t.worktree} merge-base --is-ancestor ${publication.main_sha} <live main> as ancestor_exit, and
git -C ${t.worktree} merge-tree --write-tree <live main> <PR head> as merge_tree_exit, with that PR head as head_sha.
Then follow the publication gate from the physical stack root of ${args.paths.wave}: refresh full live
closure evidence pinned to live main and run graph-admission ${ref}. Keep this track's selected
issue identity and build transition, but refresh node proofs, citation lines and event observations.
For a still-local repair reconstruct the recorded delta against fresh main. If the repair is now
published, audit the published node without the old repairs/proposed overlay; its saved own-closure
digests still bind approval. Recheck every accepted graph PR's OPEN state and reviewed exact head
against ${JSON.stringify([...graphUpdates.values()])}; a moved/merged head stops before review.
Run B candidate context: ${JSON.stringify(admissionProjection(current.report,t))}.
Return the helper's complete JSON output, unedited, as the admission_report string; never copy
digests from Run B's report. Return STOPPED with evidence when a command or evidence is unavailable.`, schemas.READMISSION, 'Review');
  const pins=`Run B validated main ${publication.main_sha}, live main ${obs?.main_sha ?? 'unknown'}`;
  const auditEvidence=`B3 admission observation ${t.issue_id}: ${JSON.stringify(obs)}`;
  const stop=what=>{
    const finding=`B3 admission: ${t.issue_id} ${what} (${pins}); repeat condition analysis and plan approval`;
    log(finding); return {review:blockedReview(r,finding),evidence:finding,auditEvidence};
  };
  if (!obs || obs.issue_id!==t.issue_id || obs.pr!==r.pr) return stop('returned no matching admission record');
  if (obs.state==='STOPPED') return stop(`stopped: ${obs.stop_reason}`);
  if (!/^[0-9a-f]{40}$/.test(obs.main_sha || '') || !validUTC(obs.checked_at) ||
      Date.parse(obs.checked_at)<Date.parse(publication.checked_at)) return stop('returned invalid live main evidence');
  const moved=obs.main_sha!==publication.main_sha;
  if (!moved && !localIndex) return {prompt:'',auditEvidence};
  if (moved && obs.ancestor_exit!==0) return stop('validated main is not an ancestor of live main');
  if (moved && (obs.merge_tree_exit!==0 || !/^[0-9a-f]{40}$/.test(obs.head_sha || ''))) return stop('PR head does not merge cleanly with live main');
  let fresh=null;
  try { fresh=JSON.parse(obs.admission_report); } catch { fresh=null; }
  const livePins={...publication,main_sha:obs.main_sha,checked_at:obs.checked_at};
  const now=candidateAdmission({...t,project:current.candidate.project_id},
    validAdmissionReports([fresh],livePins,obs.checked_at.slice(0,10)),livePins);
  if (!now || Date.parse(now.report.checked_at)<Date.parse(publication.checked_at) ||
      Date.parse(now.report.checked_at)>Date.parse(obs.checked_at) ||
      Date.parse(obs.checked_at)-Date.parse(now.report.checked_at)>3600000)
    return stop('has no eligible build admission at live main');
  const changed=candidateChanges(current.candidate,now.candidate);
  if (changed.length) return stop('closure changed: '+JSON.stringify(changed));
  const evidence=moved ? `B3 admission ${t.issue_id}: main moved ${publication.main_sha} -> ${obs.main_sha}; ancestor, clean merge of ${obs.head_sha}, graph and closure digests unchanged` :
    `B3 admission ${t.issue_id}: fresh local graph pins and candidate conditions unchanged at ${obs.main_sha}`;
  log(evidence);
  return {evidence,auditEvidence,prompt:`${evidence}. For this review node live main ${obs.main_sha} replaces the
validated main_sha in the rule above, and this fresh admission report replaces Run B's for ${t.issue_id}:
${JSON.stringify(admissionProjection(now.report,t))}. Verify the PR head still equals ${obs.head_sha || r.head_sha} before writes.
If main or the PR head moves again, return BLOCKED before any write.\n`};
};
const reviewOne=async t=>{
    const r=results[approved.indexOf(t)];
    const admitted=await readmit(t,r);
    if (admitted.evidence) report.evidence.push(admitted.evidence);
    if (admitted.auditEvidence) report.evidence.push(admitted.auditEvidence);
    const reviewed=admitted.review ? null : await call(`B3 review ${t.issue_id}`, `${graphContext(t)}${approvedGraphPrompt(t)}${admitted.prompt}${read(args.paths.pr_loop, 'no adaptation: parse existing final verdict report; BLOCKED asks nothing')}
Run /pr-loop ${r.pr} --max-rounds ${rounds}${streaming ? ' --review-slots '+concurrency+' --test-slots '+testSlots : ''} ${graphFlags.join(' ')} in ${t.worktree}.
Never exceed the round cap or retry a terminal verdict. Parse the existing verdict
report into REVIEW_RESULT, including routing evidence. A reviewer permit expiry
is verdict BLOCKED with block_reason_code SLOT_WAIT_TIMEOUT and no paid review;
preserve that code in the track review record. Verify this track's questions
${streaming ? 'against current evidence for this ticket only. Sibling work may still be running; leave cross-ticket questions for final verification.' : 'against every sibling branch tip: '+JSON.stringify(a.tracks)+'; results: '+JSON.stringify(results)+'.'}
Return only checked questions with verified/stale labels and evidence.
${streaming ? 'For CLEAN, return reviewed_head as the exact final SHA covered by the submitted review and CI. A missing or moved head is BLOCKED.' : ''}`, schemas.REVIEW_RESULT, 'Review');
    reviews[t.issue_id]=admitted.review || (reviewed?.pr===r.pr ? reviewed : null) ||
      blockedReview(r,'B3 returned no matching PR record');
    if (streaming && reviews[t.issue_id].verdict==='CLEAN' && !/^[0-9a-f]{40}$/.test(reviews[t.issue_id].reviewed_head || ''))
      reviews[t.issue_id]=blockedReview(r,'CLEAN has no exact final reviewed head');
    if (reviews[t.issue_id].verdict!=='CLEAN') log(`${t.issue_id}: ${reviews[t.issue_id].verdict}`);
    for (const q of streaming ? [] : reviews[t.issue_id].open_questions) report.open_questions.push({issue_id:t.issue_id,...q});
    return reviews[t.issue_id];
};
const reviewSlot=limiter(streaming ? workers : concurrency);
event('schedule','wave',{mode:streaming?'streaming':'legacy',workers,reviewers:concurrency,test_slots:testSlots});
if (streaming) {
  await pipeline(approved,async (_previous,t)=>workerSlot(async()=>{
    const r=await buildOne(t);
    results[approved.indexOf(t)]=r || stoppedBuild(t,'B1 pipeline dropped track');
    if (results[approved.indexOf(t)].state==='PR_OPEN') {
      event('review_queued',t.issue_id);
        await reviewOne(t);
        const hasAgreement=a.literals.some(l=>!l.tracks?.length || l.tracks.includes(t.issue_id));
        if (reviews[t.issue_id]?.verdict==='CLEAN' && !hasAgreement && !r.open_questions.length &&
            !reviews[t.issue_id].open_questions.length)
          event('ticket_ready',t.issue_id,{head:reviews[t.issue_id].reviewed_head});
    }
    return r;
  }));
  approved.forEach((t,i)=>{if (!results[i]) results[i]=stoppedBuild(t,'B1 pipeline dropped track');});
} else {
  const built=await pipeline(approved,async (_previous,t)=>workerSlot(()=>buildOne(t)));
  approved.forEach((t,i)=>results[i]=built[i] || stoppedBuild(t,'B1 pipeline dropped track'));
  await legacySeams();
  phase('Review');
  const eligible=approved.filter((t,i)=>results[i].state==='PR_OPEN' && !mismatched.has(t.issue_id));
  await pipeline(eligible,async (_previous,t)=>reviewSlot(()=>reviewOne(t)));
}


// Only connected participants wait for final agreement. A stopped/unapproved
// participant never disappears from an obligation and cannot fabricate a pass.
if (streaming) {
  const allIds=a.tracks.map(t=>t.issue_id);
  const literalGroups=a.literals.map(l=>({owners:l.tracks?.length ? l.tracks : allIds,
    participants:l.tracks?.length ? l.tracks : allIds,literals:[l],questions:[]}));
  const questionGroups=approved.flatMap((t,i)=>{
    const questions=[...new Set([...(results[i]?.open_questions || []),
      ...(reviews[t.issue_id]?.open_questions || []).map(q=>q.question)])];
    return questions.length ? [{owners:[t.issue_id],participants:allIds,literals:[],questions}] : [];
  });
  const groups=[...literalGroups,...questionGroups];
  const readyGroups=groups.filter(g=>{
    const missing=g.participants.filter(id=>!ids.includes(id) || reviews[id]?.verdict!=='CLEAN');
    if (missing.length) {
      g.owners.forEach(id=>mismatched.add(id));
      report.evidence.push('Final agreement blocked: '+JSON.stringify({owners:g.owners,missing}));
      return false;
    }
    return true;
  });
  const finalIds=[...new Set(readyGroups.flatMap(g=>g.participants))];
  if (finalIds.length) {
    const finalTracks=a.tracks.filter(t=>finalIds.includes(t.issue_id));
    const expected=finalTracks.map(t=>({issue_id:t.issue_id,branch:t.branch,
      head_sha:reviews[t.issue_id].reviewed_head,pr:results[approved.findIndex(x=>x.issue_id===t.issue_id)].pr}));
    phase('Seams');
    const final=await call('B4 final evidence', `${read(args.paths.wave,'final evidence only: read-only, never fix or merge')}
Verify final agreement for these obligations: ${JSON.stringify(readyGroups)}.
Exact submitted-review/CI heads: ${JSON.stringify(expected)}.
Fetch default main and record its exact SHA. Read back both every local branch tip
and its GitHub PR head; both must equal the listed reviewed SHA before AND after
checking. A changed head, missing participant or unavailable evidence cannot pass.
For literal obligations, write temporary contract {literal,files} and participant
literal-to-branch maps outside the repository, from ONLY these readyGroups. Run
the helper with deduplicated contract entries and unioned participant lists for
identical literals. Invoke
${args.paths.seam_check} --repo ${args.repo_root} --base ${args.default_branch}
--contract <temporary-contract> --expected-heads <branch-to-reviewed-SHA-json>
--participants <literal-to-branches-json> --branches <each participating branch>.
Preserve the helper's complete table and base SHA. Its refs must match the final
reviewed heads. Do not reuse pre-review seam evidence. String presence is not
behavioral acceptance. For question-only obligations, verify the same head/base
pins directly with git and GitHub, then check each question against all listed heads.
Return only verified/stale questions with citations; never label an unchecked
question verified. Record exact head observations and commands in evidence.`,schemas.FINAL_EVIDENCE,'Seams');
    const valid=final && /^[0-9a-f]{40}$/.test(final.base_sha) && final.evidence.length &&
      final.heads.length===expected.length && new Set(final.heads.map(h=>h.issue_id)).size===expected.length;
    const badHeads=new Set(expected.filter(e=>!valid || !final.heads.some(h=>
      h.issue_id===e.issue_id && h.branch===e.branch && h.head_sha===e.head_sha && h.pr_head_sha===e.head_sha)).map(e=>e.issue_id));
    const failureRows=final?.table.filter(row=>['ERROR','MISMATCH'].includes(row.state)) || [];
    const globalFailure=failureRows.some(row=>!expected.some(e=>e.branch===row.branch));
    for (const g of readyGroups) {
      const branches=g.participants.map(id=>a.tracks.find(t=>t.issue_id===id).branch);
      let failed=!valid || globalFailure || g.participants.some(id=>badHeads.has(id)) ||
        (final.exit!==0 && !failureRows.length) ||
        failureRows.some(row=>branches.includes(row.branch) && !row.literal);
      for (const l of g.literals) for (const id of g.participants) for (const file of l.files) {
        const branch=a.tracks.find(t=>t.issue_id===id)?.branch;
        const rows=final?.table.filter(row=>row.literal===l.literal && row.file===file && row.branch===branch) || [];
        if (rows.length!==1 || !['PASS','UNCHANGED'].includes(rows[0].state)) failed=true;
      }
      for (const id of g.owners) for (const question of g.questions) {
        const rows=final?.open_questions.filter(q=>q.issue_id===id && q.question===question) || [];
        if (rows.length!==1 || rows[0].status!=='verified' || !rows[0].evidence) failed=true;
      }
      if (failed) g.owners.forEach(id=>mismatched.add(id));
    }
    for (const id of new Set(readyGroups.flatMap(g=>g.owners)))
      if (!mismatched.has(id)) event('ticket_ready',id,{head:reviews[id].reviewed_head});
    report.evidence.push('Final head agreement: '+JSON.stringify({expected,observation:final}));
    report.open_questions=final?.open_questions || [];
    report.seam_check={state:mismatched.size ? 'FAILED':'PASSED',table:final?.table || [],reason:'Checked after review at exact final heads'};
  } else if (groups.length) {
    report.seam_check={state:'FAILED',table:[],reason:'Required participants stopped or unapproved'};
  }
  if (mismatched.size) report.evidence.push('Final agreement blocks: '+[...mismatched].join(', '));
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
