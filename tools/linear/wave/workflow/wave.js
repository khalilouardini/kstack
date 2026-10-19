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
const cfg = args.wave || {};
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
const graphTokens=args.stage==='plan' ? (args.selection || []) : (args.graph_update_flags || []);
const parsedGraph=parsePrFlags(graphTokens,graphFlag,args.stage==='build');
if (parsedGraph.error) return refuse(parsedGraph.error);
const graphFlags=parsedGraph.flags;
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
const publication=args.graph_publication;
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
const auditedProjects=new Set();
const coverageWarnings=[];
for (const p of publication.projects) {
  if (!p || typeof p.project_id!=='string' || !projectUUID.test(p.project_id) || auditedProjects.has(p.project_id) ||
      typeof p.project_name!=='string' || !p.project_name ||
      typeof p.view_path!=='string' || !p.view_path || p.view_path.startsWith('/') || p.view_path.split('/').includes('..') ||
      !['CURRENT','ACCEPTED_UPDATE','UPDATE_REQUIRED','UNKNOWN'].includes(p.state))
    return refuse('graph publication: invalid or duplicate project evidence');
  auditedProjects.add(p.project_id);
  if (p.state==='CURRENT') continue;
  const pr=graphUpdates.get(p.pr_number);
  if (p.state==='ACCEPTED_UPDATE' && pr) {
    if (p.head_sha!==pr.head_sha || !pr.project_ids.includes(p.project_id))
      return refuse(`graph publication: ${p.project_name} does not match the verified graph-update head/project`);
  } else coverageWarnings.push(p);
}
// Coverage warnings do not determine execution eligibility. Consume the separate
// audited candidate reports; nodes still acquire live evidence before writes.
const admissions=args.graph_admission || [];
const shaDigest=value=>/^sha256:[0-9a-f]{64}$/.test(value || '');
if (!Array.isArray(admissions)) return refuse('graph admission: audit reports must be an array');
// Apply the same build-report validation to live input and Run A's stored input.
// Prior reports use their original invocation date, even when Run B is later.
const validAdmissionReports=(reports,pins,date) => Array.isArray(reports) ? reports.filter(r=>
  r && r.schema_version===1 && r.main_sha===pins?.main_sha &&
  validUTC(r.checked_at) && r.checked_at.slice(0,10)===date &&
  shaDigest(r.graph_digest) && shaDigest(r.base_digest) && shaDigest(r.issue_evidence_digest) &&
  r.transition==='build' && Array.isArray(r.candidates) &&
  r.evidence?.issues?.complete===true && r.evidence?.request && r.delta &&
  Array.isArray(r.delta.added_nodes) && r.delta.added_nodes.length<=3 &&
  Array.isArray(r.delta.changed_edges) && !r.delta.changed_edges.length
) : [];
// Incomplete unrelated reports and plan-only reports cannot shadow eligible builds.
const validAdmissions=validAdmissionReports(admissions,publication,args.date);
const candidateAdmission=(track,reports=validAdmissions,pins=publication,current=true) => {
  if (track.project===null) return {exempt:true};
  if (!/^[0-9a-f]{40}$/.test(pins?.main_sha || '')) return null;
  const projects=Array.isArray(pins?.projects) ? pins.projects.filter(p=>
    p && (p.project_id===track.project || p.project_name===track.project)) : [];
  if (projects.length!==1 || projects[0].state==='UNKNOWN' ||
      !projectUUID.test(projects[0].project_id || '') ||
      !['CURRENT','UPDATE_REQUIRED','ACCEPTED_UPDATE'].includes(projects[0].state) ||
      (projects[0].state==='ACCEPTED_UPDATE' &&
       (!Number.isSafeInteger(projects[0].pr_number) || projects[0].pr_number<1 ||
        !/^[0-9a-f]{40}$/.test(projects[0].head_sha || ''))) ||
      (current && projects[0].state==='ACCEPTED_UPDATE' && !graphUpdates.has(projects[0].pr_number))) return null;
  const matches=reports.flatMap(report=>report.candidates.map(candidate=>({report,candidate})))
    .filter(({candidate:c})=>c && c.project_id===projects[0].project_id && c.identifier===track.issue_id);
  if (matches.length!==1) return null;
  const {report,candidate:c}=matches[0];
  if (report.graph_sha!==(projects[0].state==='ACCEPTED_UPDATE' ? projects[0].head_sha : pins.main_sha) ||
      report.transition!=='build' || c.state!=='ELIGIBLE' ||
      typeof c.issue_id!=='string' || !c.issue_id || typeof c.node_id!=='string' || !c.node_id ||
      !['PUBLISHED','LOCAL_RECONCILIATION'].includes(c.mode) ||
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
    const semantic=Object.hasOwn(before,'semantic_'+(publishedRepair?'published_':'')+field);
    const priorField=(semantic?'semantic_':'')+(publishedRepair?'published_':'')+field;
    const currentField=(semantic?'semantic_':'')+field;
    comparisons.push({field,prior_field:priorField,prior:before[priorField],current:after[currentField]});
  }
  if (!publishedRepair) comparisons.push({field:'mode',prior:before.mode,current:after.mode});
  return comparisons.filter(c=>c.prior!==c.current ||
    (c.field.endsWith('_digest') && (!shaDigest(c.prior) || !shaDigest(c.current))));
};
const admissionEvidence='Graph admission evidence: '+JSON.stringify(admissions);
const graphEvidence='Graph publication evidence: '+JSON.stringify(publication);
const graphPrompt=`For work linked to a Linear project, before selection or execution recheck the canonical graph publication gate
against fresh main and live evidence for the candidate and its relevant dependency closure.
Project coverage gaps are warnings; never exclude all mapped candidates because an unrelated ticket is missing.
Validated graph publication evidence: ${JSON.stringify(publication)}.
Validated candidate admission reports: ${JSON.stringify(validAdmissions)}.
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
When Run A has semantic_closure_graph_digest and semantic_closure_evidence_digest,
use that semantic pair as the approval binding instead of the legacy pair; for
publication use its semantic_published_closure_* pair. Require the corresponding
current semantic pair. Equal semantic conditions permit differences in the legacy
metadata hashes; retain full bodies/citations and inspect contradictions, but do
not revoke approval for non-authoritative notes or citation prose alone.
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

if (args.stage === 'plan') {
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
Also preserve every --accept-graph-update occurrence and apply its publication gate.
PLAN_ONLY candidates must go in sequenced with the unmet build condition and source,
never tracks. They do not count toward N and must not reach --approve all.
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
  for (const id of [...selected.sequenced, ...selected.already_active]) log(`A1 skipped: ${id}`);
  if (!selected.tracks.length) { record.state='EMPTY'; return record; }
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
  const scan = await call('A2 shared-literal scan', `${read(args.paths.wave, 'scan only; do not dispatch or implement')}
Read every issue description and file scope in ${JSON.stringify(selected.tracks)}.
List every literal two or more tracks must agree on: status tokens, schema fields,
config keys, paths, marker comments. Return literals with files, participating ids, why.`, schemas.SCAN, 'Select');
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
  const plans=await pipeline(selected.tracks, async (_prev,t) => {
    const overlaps=[...accepted.values()].map(pr=>({number:pr.number,title:pr.title,
      author:pr.author,head_sha:pr.head_sha,
      files:[...new Set(pr.files.flatMap(f=>[f.filename,f.previous_filename].filter(Boolean)))]
        .filter(file=>t.file_scope.includes(file))})).filter(pr=>pr.files.length);
    const overlapPrompt=accepted.size ? `Before dispatch §1 or any workspace/tracker write,
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
    const p=await call(`A4 plan ${t.issue_id}`, `${graphPrompt}${overlapPrompt}${read(args.paths.dispatch, '--plan-only: sections 1–3 unchanged; section 4 plan in current agent, no executor launch')}
Dispatch exact issue ${t.issue_id} with --plan-only ${graphFlags.join(' ')}. Proposed track: ${JSON.stringify(t)}.
Contract: ${JSON.stringify(record.contract)}. Return criteria citations, files, tests,
risks, status read-back and verified absolute worktree. No implementation permission.`, schemas.PLAN, 'Plan');
    if (!p || p.issue_id !== t.issue_id || !p.worktree.startsWith('/') || !p.branch) return stoppedPlan(t,'A4 missing or wrong issue record');
    if (p.state==='STOPPED') log(`${t.issue_id}: STOPPED ${p.stop_reason}`);
    return p;
  });
  record.plans=selected.tracks.map((t,i)=>plans[i] || stoppedPlan(t,'A4 pipeline dropped track'));
  record.tracks=selected.tracks.map((t,i)=>({...t,worktree:record.plans[i].worktree,branch:record.plans[i].branch}));
  if (!record.plans.some(p=>p.state==='PLANNED')) {
    record.stop_reason='no PLANNED track; every A4 plan stopped';
    record.evidence.push(...record.plans.map(p=>`${p.issue_id}: ${p.stop_reason}`));
    log(`Wave STOPPED: ${record.stop_reason}`); return record;
  }
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
const recoveries=Array.isArray(args.recovery) ? args.recovery : [];
const recoveryFor=t=>recoveries.filter(r=>r?.issue_id===t.issue_id);
const validResult=(r,id)=>r?.state==='PR_OPEN' && r.issue_id===id &&
  typeof r.pr==='string' && /^https:\/\//.test(r.pr) && /^[0-9a-f]{40}$/.test(r.head_sha || '') &&
  r.gates?.lint?.exit===0 && r.gates?.test?.exit===0 &&
  Array.isArray(r.acceptance_evidence) && r.acceptance_evidence.length>0 &&
  Array.isArray(r.evidence) && r.evidence.length>0 &&
  Array.isArray(r.files_touched) && Array.isArray(r.open_questions);
// Approval belongs to the selected mapped units and their conditions, not a
// repository SHA or the whole project's membership. Isolate affected tracks.
const priorEvidence=a.evidence?.find(e=>e.startsWith('Graph publication evidence: '));
let priorPublication;
try { priorPublication=priorEvidence && JSON.parse(priorEvidence.slice('Graph publication evidence: '.length)); }
catch { return refuse('graph publication: invalid Run A SHA evidence'); }
let priorAdmissions;
try { priorAdmissions=JSON.parse(a.evidence?.find(e=>e.startsWith('Graph admission evidence: '))?.slice('Graph admission evidence: '.length)); }
catch { return refuse('graph admission: missing Run A candidate evidence'); }
const priorDate=validUTC(priorPublication?.checked_at) ? priorPublication.checked_at.slice(0,10) : null;
const validPriorAdmissions=validAdmissionReports(priorAdmissions,priorPublication,priorDate);
const priorGraphEvidence='Run A graph publication evidence: '+JSON.stringify(priorPublication);
const priorAdmissionEvidence='Run A graph admission evidence: '+JSON.stringify(priorAdmissions);
const auditTrail=[graphEvidence,admissionEvidence,priorGraphEvidence,priorAdmissionEvidence];
const approvedGraphPrompt=t => t.project===null ? '' : `Run A approved observations for ${t.issue_id}: ${JSON.stringify({
  publication:priorPublication,admission:candidateAdmission(t,validPriorAdmissions,priorPublication,false)})}.
Run A pinned main ${priorPublication.main_sha}; Run B validated main ${publication.main_sha}.
Verify ${priorPublication.main_sha} is an ancestor of the fetched ${args.default_branch};
if not, return STOPPED before any write. Diff the cited scope sources at the saved
and fresh graph SHAs and recheck their full relevant sections, including exclusions.
Exact quote equality alone does not prove scope applicability.\n`;
const preflightStops=new Map();
const buildAdmissions=new Map();
for (const t of approved) {
  const rows=recoveryFor(t),r=rows[0];
  if (rows.length!==1 || r.branch!==t.branch || r.worktree!==t.worktree ||
      !validUTC(r.checked_at) || r.checked_at.slice(0,10)!==args.date ||
      (validUTC(publication.checked_at) && Date.parse(r.checked_at)<Date.parse(publication.checked_at)) ||
      !Array.isArray(r.evidence) || !r.evidence.length ||
      !['ABSENT','PR_OPEN'].includes(r.state) ||
      (r.state==='PR_OPEN' && !validResult(r.result,t.issue_id)) ||
      (r.state==='ABSENT' && r.result!==null))
    preflightStops.set(t.issue_id,`Recovery: ${t.issue_id} needs a fresh verified branch/worktree and existing-PR lookup`);
}
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
if (mainMove) log(mainMove);
for (const t of a.tracks) if (!ids.includes(t.issue_id)) log(`${t.issue_id}: skipped; not approved`);
phase('Build');
const built=await pipeline(approved, async (_prev,t) => {
  if (preflightStops.has(t.issue_id)) {
    log(`${t.issue_id}: STOPPED ${preflightStops.get(t.issue_id)}`);
    return {...stoppedBuild(t,preflightStops.get(t.issue_id)),evidence:[preflightStops.get(t.issue_id),...auditTrail]};
  }
  const recovery=recoveryFor(t)[0];
  if (recovery.state==='PR_OPEN') {
    log(`${t.issue_id}: reuse verified PR ${recovery.result.pr}; skip implementation`);
    return {...recovery.result,evidence:[...recovery.result.evidence,...recovery.evidence]};
  }
  const plan=a.plans.find(p=>p.issue_id===t.issue_id);
  const r=await call(`B1 build ${t.issue_id}`, `${graphPrompt}${approvedGraphPrompt(t)}${read(args.paths.dispatch, 'wave build approval permits only the supplied approved plan and section 5 lifecycle')}
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
const blockedReview=(r,finding)=>({pr:r.pr,verdict:'BLOCKED',rounds:0,open_findings:[finding],model_routing:[],open_questions:[]});
// review_concurrency serializes B3, so a later track's review can start long after
// Run B validated main. A read-only node observes live main first. When main moved,
// the script proceeds only if Run B's main is an ancestor, the PR head merges cleanly
// and a fresh build admission at live main preserves this candidate's conditions.
const readmit=async (t,r) => {
  if (t.project===null) return {prompt:'',flags:[]};
  const current=buildAdmissions.get(t.issue_id);
  const project=publication.projects.find(p=>p.project_id===current.candidate.project_id);
  const obs=await call(`B3 admission ${t.issue_id}`, `${graphPrompt}${approvedGraphPrompt(t)}${read(args.paths.wave, 'B3 admission only: read-only observation; never review, fix, push, comment or write the tracker')}
B3 admission for ${t.issue_id}, PR ${r.pr}, worktree ${t.worktree}. Fetch literal main and record
its exact SHA and UTC checked_at. Run B validated main ${publication.main_sha}.
Always refresh full live Linear closure evidence, even when main is unchanged.
Record exact exit codes: git -C ${t.worktree} merge-base --is-ancestor ${publication.main_sha} <live main>
as ancestor_exit, and git -C ${t.worktree} merge-tree --write-tree <live main> <PR head>
as merge_tree_exit. Record the actual PR head as head_sha.
For this track's accepted graph PR, re-read its state. If MERGED, audit the graph
on live main and drop its obsolete pending-graph flag. If OPEN, require the same
reviewed exact head before using it as --ref with --main-ref <live main>. A CLOSED
unmerged graph, or an unreviewed new graph head, stops only this track.
Follow the publication gate with fresh full issue bodies, relations, scope sections
and event observations. For a local repair reconstruct its recorded delta; if now
published, audit its own closure without the temporary overlay. A published graph
uses graph-admission --ref <live main>; a pending graph uses graph-admission
--ref <resolved graph SHA> --main-ref <live main>.
Run B report: ${JSON.stringify(current.report)}.
Return the helper's complete JSON output, unedited, as admission_report; never
copy digests from Run B. No null freshness evidence on an unchanged main.
Return STOPPED with evidence when a command or evidence is unavailable.`, schemas.READMISSION, 'Review');
  const pins=`Run B validated main ${publication.main_sha}, live main ${obs?.main_sha ?? 'unknown'}`;
  const auditEvidence=`B3 admission observation ${t.issue_id}: ${JSON.stringify(obs)}`;
  const stop=what=>{
    const finding=`B3 admission: ${t.issue_id} ${what} (${pins}); refresh evidence; new approval only for changed conditions`;
    log(finding); return {review:blockedReview(r,finding),evidence:finding,auditEvidence};
  };
  if (!obs || obs.issue_id!==t.issue_id || obs.pr!==r.pr) return stop('returned no matching admission record');
  if (obs.state==='STOPPED') return stop(`stopped: ${obs.stop_reason}`);
  if (!/^[0-9a-f]{40}$/.test(obs.main_sha || '') || !validUTC(obs.checked_at) ||
      Date.parse(obs.checked_at)<Date.parse(publication.checked_at)) return stop('returned invalid live main evidence');
  if (obs.ancestor_exit!==0) return stop('validated main is not an ancestor of live main');
  if (obs.merge_tree_exit!==0 || !/^[0-9a-f]{40}$/.test(obs.head_sha || '')) return stop('PR head does not merge cleanly with live main');
  let fresh=null;
  try { fresh=JSON.parse(obs.admission_report); } catch { fresh=null; }
  // Publication on main supersedes a pending source; the unit's conditions still
  // have to match. Pending sources remain pinned to their reviewed exact head.
  const published=fresh?.graph_sha===obs.main_sha;
  const liveProject={...project};
  if (published) {
    liveProject.state='CURRENT';delete liveProject.pr_number;delete liveProject.head_sha;
  }
  const livePins={...publication,main_sha:obs.main_sha,checked_at:obs.checked_at,
    projects:publication.projects.map(p=>p.project_id===project.project_id?liveProject:p)};
  const now=candidateAdmission({...t,project:current.candidate.project_id},
    validAdmissionReports([fresh],livePins,obs.checked_at.slice(0,10)),livePins);
  if (!now || Date.parse(now.report.checked_at)<Date.parse(publication.checked_at) ||
      Date.parse(now.report.checked_at)>Date.parse(obs.checked_at) ||
      Date.parse(obs.checked_at)-Date.parse(now.report.checked_at)>3600000)
    return stop('has no eligible build admission at live main');
  const changed=candidateChanges(current.candidate,now.candidate);
  if (changed.length) return stop('closure changed: '+JSON.stringify(changed));
  const flags=[];
  if (liveProject.state==='ACCEPTED_UPDATE') for(let i=0;i<graphFlags.length;i+=2)
    if(Number(graphFlags[i+1])===liveProject.pr_number) flags.push(graphFlags[i],graphFlags[i+1]);
  const movement=obs.main_sha===publication.main_sha?'main unchanged':`main moved ${publication.main_sha} -> ${obs.main_sha}`;
  const evidence=`B3 admission ${t.issue_id}: ${movement}; ancestor, clean merge of ${obs.head_sha}, graph and closure digests unchanged`;
  log(evidence);
  return {flags,evidence,auditEvidence,prompt:`${evidence}. For this review node live main ${obs.main_sha} replaces the
validated main_sha and this fresh report replaces Run B's report for ${t.issue_id}:
${JSON.stringify(now.report)}. Current publication: ${JSON.stringify(livePins)}.
Current graph flags ${JSON.stringify(flags)} supersede the earlier source/flags for this track.
Refresh admission at the start of every review round and before implementer writes.
An unrelated main advance permits continuing after ancestry, clean merge, current
scope and both candidate digests are revalidated. If this graph PR reaches main,
switch to main and drop its pending flag. Do not demand new plan approval solely
for commit movement or publication. Retain the explicit Run A baseline.
The initial PR head ${obs.head_sha} is a starting observation. The loop's own verified fix commits
advance its expected head after gates and a successful guarded push; they do not
count as external drift. Unexpected foreign PR-head changes or changed conditions
stop this track. Preserve pr-loop's per-round head/worktree and pre-push guards.\n`};
};
// Batch only the review stage: build remains a per-track pipeline; B2 is the seam barrier.
for (let offset=0;offset<eligible.length;offset+=concurrency) {
  await pipeline(eligible.slice(offset,offset+concurrency), async (_prev,t) => {
    const r=results[approved.indexOf(t)];
    const admitted=await readmit(t,r);
    if (admitted.evidence) report.evidence.push(admitted.evidence);
    if (admitted.auditEvidence) report.evidence.push(admitted.auditEvidence);
    const reviewed=admitted.review ? null : await call(`B3 review ${t.issue_id}`, `${graphPrompt}${approvedGraphPrompt(t)}${admitted.prompt}${read(args.paths.pr_loop, 'no adaptation: parse existing final verdict report; BLOCKED asks nothing')}
Run /pr-loop ${r.pr} --max-rounds ${rounds} ${(admitted.flags || graphFlags).join(' ')} in ${t.worktree}.
Never exceed the round cap or retry a terminal verdict. Parse the existing verdict
report into REVIEW_RESULT, including routing evidence. Verify this track's questions
against every sibling branch tip: ${JSON.stringify(a.tracks)}; results: ${JSON.stringify(results)}.
Return only checked questions with verified/stale labels and evidence.`, schemas.REVIEW_RESULT, 'Review');
    reviews[t.issue_id]=admitted.review || (reviewed?.pr===r.pr ? reviewed : null) ||
      blockedReview(r,'B3 returned no matching PR record');
    if (reviews[t.issue_id].verdict!=='CLEAN') log(`${t.issue_id}: ${reviews[t.issue_id].verdict}`);
    for (const q of reviews[t.issue_id].open_questions) report.open_questions.push({issue_id:t.issue_id,...q});
    return reviews[t.issue_id];
  });
}
// Review fixes can change both PR heads and shared literals. Recheck actual
// remote tips after all loops; B2's pre-review table cannot certify final code.
if (active.length) {
  phase('Seams');
  const final=await call('B4 final verification', `${read(args.paths.wave, 'final verification only; read-only remote heads, reviewer markers, CI and deterministic seams')}
Final tracks: ${JSON.stringify(active.map(t=>({...t,pr:results[approved.indexOf(t)].pr,review:reviews[t.issue_id] || null})))}.
Read each actual remote PR head and its branch/worktree pairing. Return head_sha
after fetching that exact commit object without moving the implementation branch,
and reviewed_head_sha from the final same-head configured reviewer marker and
pr-loop/CI evidence; null reviewed_head_sha if that evidence is unavailable.
Do not edit, rebase, push, review or write Linear. Contract: ${JSON.stringify(a.contract)}.
When present, run ${args.paths.seam_check} --repo ${args.repo_root} --base ${args.default_branch}
--contract ${a.contract?.file || '<none>'} --branches <each verified final head SHA>.
Return its unedited table keyed by those SHA arguments as seam. Without a contract
return seam null. Re-read remote heads after the check; head movement makes this
observation unavailable. A bare successful exit is insufficient.`, schemas.FINAL_CHECK, 'Seams');
  const finalRows=Array.isArray(final?.heads)?final.heads:[];
  for (const t of active) {
    const result=results[approved.indexOf(t)];
    const rows=finalRows.filter(h=>h.issue_id===t.issue_id && h.pr===result.pr && h.branch===t.branch);
    const head=rows[0];
    if (rows.length!==1 || !/^[0-9a-f]{40}$/.test(head?.head_sha || '')) {
      reviews[t.issue_id]=blockedReview(result,'Final PR head could not be verified');
    } else {
      result.head_sha=head.head_sha;
      if (reviews[t.issue_id]?.verdict==='CLEAN' && head.reviewed_head_sha!==head.head_sha)
        reviews[t.issue_id]=blockedReview(result,'Final head has no matching review/CI evidence');
    }
  }
  if (a.contract) {
    const checked=final?.seam;
    const earlierErrors=report.seam_check.table.filter(row=>['MISMATCH','ERROR'].includes(row.state))
      .map(row=>({...row,evidence:'Pre-review seam failure: '+row.evidence}));
    const table=Array.isArray(checked?.table)?checked.table.flatMap(row=>{
      const heads=finalRows.filter(h=>h.head_sha===row.branch);
      return heads.length?heads.map(h=>({...row,branch:h.branch})):[row];
    }):[];
    report.seam_check={state:checked?.exit===0?'PASSED':'FAILED',table,reason:'Final seams after review fixes'};
    for(const t of active) {
      let bad=!checked || (checked.exit!==0 && !table.some(r=>r.state==='MISMATCH'||r.state==='ERROR'));
      for(const entry of a.literals) for(const file of entry.files) {
        const rows=table.filter(r=>r.branch===t.branch && r.literal===entry.literal && r.file===file);
        if(rows.length!==1 || !['PASS','UNCHANGED'].includes(rows[0].state))bad=true;
      }
      if(table.some(r=>(r.state==='MISMATCH'||r.state==='ERROR') && (!active.some(t=>t.branch===r.branch) || r.branch===t.branch)))bad=true;
      if(bad)mismatched.add(t.issue_id);
    }
    if(mismatched.size)report.seam_check.state='FAILED';
    report.seam_check.table.push(...earlierErrors);
  }
  report.evidence.push('Final head/seam verification: '+JSON.stringify(final));
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
