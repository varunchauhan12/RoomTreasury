// Full RT-APEX-001 artifact structures; content is untrusted and never executable.
export const proposalSchema = {
  "type": "object",
  "additionalProperties": false,
  "required": [
    "taskId",
    "currency",
    "status",
    "client",
    "project",
    "proposal",
    "statementOfWork",
    "executionPlan",
    "riskRegister",
    "specialistContributions",
    "financialSummary",
    "unresolvedQuestions",
    "ownerApprovalRequired",
    "readinessExplanation",
    "reconciliation",
    "blockingReviews",
    "ownerDecisionRecommendation",
    "authorityStatement",
    "specialistContactFailures"
  ],
  "properties": {
    "taskId": {
      "type": "string",
      "minLength": 1,
      "maxLength": 32000
    },
    "currency": {
      "const": "USD"
    },
    "status": {
      "type": "string",
      "minLength": 1,
      "maxLength": 32000
    },
    "client": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "name"
      ],
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        }
      }
    },
    "project": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "name",
        "brief",
        "agreedRevenueCents",
        "deadline"
      ],
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        },
        "brief": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        },
        "agreedRevenueCents": {
          "type": "number"
        },
        "deadline": {
          "anyOf": [
            {
              "type": "null"
            },
            {
              "type": "string",
              "maxLength": 100
            }
          ]
        }
      }
    },
    "proposal": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "budgetCents",
        "provenance",
        "explanation",
        "assumptions",
        "risks",
        "allocations",
        "contingencyPolicy"
      ],
      "properties": {
        "budgetCents": {
          "type": "number"
        },
        "provenance": {
          "const": "switch_agent"
        },
        "explanation": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        },
        "assumptions": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "assumptionId",
              "description",
              "verificationStatus",
              "requiredConfirmation"
            ],
            "properties": {
              "assumptionId": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "description": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "verificationStatus": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "requiredConfirmation": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              }
            }
          }
        },
        "risks": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          }
        },
        "allocations": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "workstream",
              "limitCents",
              "baseCostCents",
              "contingencyCents",
              "estimatedEffortHours",
              "explanation",
              "relatedTasks"
            ],
            "properties": {
              "workstream": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "limitCents": {
                "type": "number"
              },
              "baseCostCents": {
                "type": "number"
              },
              "contingencyCents": {
                "type": "number"
              },
              "estimatedEffortHours": {
                "type": "number"
              },
              "explanation": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "relatedTasks": {
                "type": "array",
                "maxItems": 200,
                "items": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 32000
                }
              }
            }
          }
        },
        "contingencyPolicy": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        }
      }
    },
    "statementOfWork": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "objective",
        "scope",
        "deliverables",
        "exclusions",
        "acceptanceCriteria",
        "milestones",
        "commercialTerms",
        "projectOverview",
        "assumptions",
        "timelineBasis",
        "changeManagement"
      ],
      "properties": {
        "objective": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        },
        "scope": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          }
        },
        "deliverables": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "name",
              "description",
              "expectedOutcome",
              "acceptanceCriteria",
              "dependencies"
            ],
            "properties": {
              "name": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "description": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "expectedOutcome": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "acceptanceCriteria": {
                "type": "array",
                "maxItems": 200,
                "items": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 32000
                }
              },
              "dependencies": {
                "type": "array",
                "maxItems": 200,
                "items": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 32000
                }
              }
            }
          }
        },
        "exclusions": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          }
        },
        "acceptanceCriteria": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          }
        },
        "milestones": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "milestoneId",
              "name",
              "estimatedDurationBusinessDays",
              "expectedCompletion",
              "completionCriteria",
              "dependencies",
              "deliverable"
            ],
            "properties": {
              "milestoneId": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "name": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "estimatedDurationBusinessDays": {
                "type": "number"
              },
              "expectedCompletion": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "completionCriteria": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "dependencies": {
                "type": "array",
                "maxItems": 200,
                "items": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 32000
                }
              },
              "deliverable": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              }
            }
          }
        },
        "commercialTerms": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          }
        },
        "projectOverview": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "clientName",
            "projectName",
            "businessObjective",
            "summary",
            "documentStatus"
          ],
          "properties": {
            "clientName": {
              "type": "string",
              "minLength": 1,
              "maxLength": 32000
            },
            "projectName": {
              "type": "string",
              "minLength": 1,
              "maxLength": 32000
            },
            "businessObjective": {
              "type": "string",
              "minLength": 1,
              "maxLength": 32000
            },
            "summary": {
              "type": "string",
              "minLength": 1,
              "maxLength": 32000
            },
            "documentStatus": {
              "type": "string",
              "minLength": 1,
              "maxLength": 32000
            }
          }
        },
        "assumptions": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "assumptionId",
              "description",
              "verificationStatus",
              "requiredConfirmation"
            ],
            "properties": {
              "assumptionId": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "description": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "verificationStatus": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "requiredConfirmation": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              }
            }
          }
        },
        "timelineBasis": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        },
        "changeManagement": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        }
      }
    },
    "executionPlan": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "tasks",
        "dependencies",
        "qualityChecks",
        "estimatedTotalHours",
        "resources",
        "resourceStatus"
      ],
      "properties": {
        "tasks": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "anyOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "taskId",
                  "title",
                  "description",
                  "workstream",
                  "priority",
                  "estimatedEffortHours",
                  "dependencies",
                  "expectedOutput",
                  "completionCriteria"
                ],
                "properties": {
                  "taskId": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "title": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "description": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "workstream": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "priority": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "estimatedEffortHours": {
                    "type": "number"
                  },
                  "dependencies": {
                    "type": "array",
                    "maxItems": 200,
                    "items": {}
                  },
                  "expectedOutput": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "completionCriteria": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "taskId",
                  "title",
                  "description",
                  "workstream",
                  "priority",
                  "estimatedEffortHours",
                  "dependencies",
                  "expectedOutput",
                  "completionCriteria"
                ],
                "properties": {
                  "taskId": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "title": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "description": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "workstream": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "priority": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "estimatedEffortHours": {
                    "type": "number"
                  },
                  "dependencies": {
                    "type": "array",
                    "maxItems": 200,
                    "items": {
                      "type": "string",
                      "minLength": 1,
                      "maxLength": 32000
                    }
                  },
                  "expectedOutput": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "completionCriteria": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  }
                }
              }
            ]
          }
        },
        "dependencies": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "taskId",
              "dependsOn"
            ],
            "properties": {
              "taskId": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "dependsOn": {
                "type": "array",
                "maxItems": 200,
                "items": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 32000
                }
              }
            }
          }
        },
        "qualityChecks": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          }
        },
        "estimatedTotalHours": {
          "type": "number"
        },
        "resources": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "role",
              "hours"
            ],
            "properties": {
              "role": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "hours": {
                "type": "number"
              }
            }
          }
        },
        "resourceStatus": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        }
      }
    },
    "riskRegister": {
      "type": "array",
      "maxItems": 200,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "riskId",
          "description",
          "category",
          "severity",
          "probability",
          "potentialImpact",
          "mitigation",
          "responsibleWorkstream",
          "evidenceStatus"
        ],
        "properties": {
          "riskId": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "description": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "category": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "severity": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "probability": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "potentialImpact": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "mitigation": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "responsibleWorkstream": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "evidenceStatus": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          }
        }
      }
    },
    "specialistContributions": {
      "type": "array",
      "maxItems": 200,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "specialist",
          "analysisTaskId",
          "status",
          "sourceMessageIds",
          "findings",
          "integration",
          "projectId"
        ],
        "properties": {
          "specialist": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "analysisTaskId": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "status": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "sourceMessageIds": {
            "type": "array",
            "maxItems": 200,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 32000
            }
          },
          "findings": {
            "type": "array",
            "maxItems": 200,
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 32000
            }
          },
          "integration": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "projectId": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          }
        }
      }
    },
    "financialSummary": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "agreedRevenueCents",
        "proposedDeliveryBudgetCents",
        "projectedGrossMarginCents",
        "totalAllocationCents",
        "projectedGrossMarginPercent",
        "baseEstimatedCostCents",
        "contingencyCents",
        "cashReceivedCents",
        "availableDeliveryFundsCents",
        "backendVerificationStatus",
        "explanation",
        "scenarios",
        "financialReviewStatus"
      ],
      "properties": {
        "agreedRevenueCents": {
          "type": "number"
        },
        "proposedDeliveryBudgetCents": {
          "type": "number"
        },
        "projectedGrossMarginCents": {
          "type": "number"
        },
        "totalAllocationCents": {
          "type": "number"
        },
        "projectedGrossMarginPercent": {
          "type": "number"
        },
        "baseEstimatedCostCents": {
          "type": "number"
        },
        "contingencyCents": {
          "type": "number"
        },
        "cashReceivedCents": {
          "type": "null"
        },
        "availableDeliveryFundsCents": {
          "type": "null"
        },
        "backendVerificationStatus": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        },
        "explanation": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        },
        "scenarios": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "name",
              "hours",
              "baseCostCents",
              "contingencyCents",
              "totalCostCents",
              "projectedGrossMarginCents"
            ],
            "properties": {
              "name": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "hours": {
                "type": "number"
              },
              "baseCostCents": {
                "type": "number"
              },
              "contingencyCents": {
                "type": "number"
              },
              "totalCostCents": {
                "type": "number"
              },
              "projectedGrossMarginCents": {
                "type": "number"
              }
            }
          }
        },
        "financialReviewStatus": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        }
      }
    },
    "unresolvedQuestions": {
      "type": "array",
      "maxItems": 200,
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 32000
      }
    },
    "ownerApprovalRequired": {
      "type": "boolean"
    },
    "readinessExplanation": {
      "type": "string",
      "minLength": 1,
      "maxLength": 32000
    },
    "reconciliation": {
      "type": "array",
      "maxItems": 200,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "issue",
          "original",
          "specialistFinding",
          "resolution"
        ],
        "properties": {
          "issue": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "original": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "specialistFinding": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          },
          "resolution": {
            "type": "string",
            "minLength": 1,
            "maxLength": 32000
          }
        }
      }
    },
    "blockingReviews": {
      "type": "array",
      "maxItems": 200,
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 32000
      }
    },
    "ownerDecisionRecommendation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "recommendation",
        "reason",
        "options",
        "ownerApprovalRequired"
      ],
      "properties": {
        "recommendation": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        },
        "reason": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32000
        },
        "options": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "name",
              "budgetCents",
              "status",
              "condition"
            ],
            "properties": {
              "name": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "budgetCents": {
                "type": "number"
              },
              "status": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              },
              "condition": {
                "type": "string",
                "minLength": 1,
                "maxLength": 32000
              }
            }
          }
        },
        "ownerApprovalRequired": {
          "type": "boolean"
        }
      }
    },
    "authorityStatement": {
      "type": "string",
      "minLength": 1,
      "maxLength": 32000
    },
    "specialistContactFailures": {
      "type": "array",
      "maxItems": 200,
      "items": {}
    }
  }
} as const;
export const evidenceSchema = {
  "type": "object",
  "additionalProperties": false,
  "required": [
    "initial",
    "reconciliation"
  ],
  "properties": {
    "initial": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "threads",
        "truncated",
        "oldest_timestamp"
      ],
      "properties": {
        "threads": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "root",
              "replies"
            ],
            "properties": {
              "root": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "id",
                  "kind",
                  "sender",
                  "sender_name",
                  "body",
                  "timestamp",
                  "attachments"
                ],
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "kind": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "sender": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "sender_name": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "body": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "timestamp": {
                    "type": "number"
                  },
                  "attachments": {
                    "type": "array",
                    "maxItems": 200,
                    "items": {}
                  }
                }
              },
              "replies": {
                "type": "array",
                "maxItems": 200,
                "items": {}
              }
            }
          }
        },
        "truncated": {
          "type": "boolean"
        },
        "oldest_timestamp": {
          "type": "number"
        }
      }
    },
    "reconciliation": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "threads",
        "truncated",
        "oldest_timestamp"
      ],
      "properties": {
        "threads": {
          "type": "array",
          "maxItems": 200,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": [
              "root",
              "replies"
            ],
            "properties": {
              "root": {
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "id",
                  "kind",
                  "sender",
                  "sender_name",
                  "body",
                  "timestamp",
                  "attachments"
                ],
                "properties": {
                  "id": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "kind": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "sender": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "sender_name": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "body": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 32000
                  },
                  "timestamp": {
                    "type": "number"
                  },
                  "attachments": {
                    "type": "array",
                    "maxItems": 200,
                    "items": {}
                  }
                }
              },
              "replies": {
                "type": "array",
                "maxItems": 200,
                "items": {}
              }
            }
          }
        },
        "truncated": {
          "type": "boolean"
        },
        "oldest_timestamp": {
          "type": "number"
        }
      }
    }
  }
} as const;
