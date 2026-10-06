# Wave records

This is the canonical record contract. The JSON Schema block below is mirrored
in the Workflow script because that sandbox cannot read files. Harness case 10
compares every field and type, including nested records, to this block.
All fields are required; nullable values explicitly represent absent evidence.
A STOPPED record always has a non-empty stop_reason and evidence. Branch and
worktree in selection are proposed names/absolute paths; only dispatch read-back
proves their existence. PLAN.worktree must match the recovered TRACK.worktree.
Run ids are caller-supplied Workflow invocation ids; the tool's actual run id is
attached by the invoking skill after return if the tool allocates it itself.

Contract files are JSON lists of {literal, files}; SHARED_LITERAL additionally
records the participating issue ids and why agreement is required. Write
<contract_dir>/<wave-id>.json and a test using the consuming repo's own runner:
JSON permits exact strings without Markdown escaping and stdlib parsing.

WAVE_REPORT retains every selected track, including unapproved and dropped
tracks. open_questions contains only questions actually checked against sibling
branch tips, with evidence and verified (still current) or stale (superseded).
Questions lacking that check remain explicit in unverified_questions; they
must never acquire a fabricated verification label.

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
}
```
