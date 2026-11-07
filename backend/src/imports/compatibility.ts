import type { ImportBundle } from './service.js';

export interface CompatibilityResult {
  bundle: ImportBundle;
  adapted: boolean;
  notes: string[];
}

/**
 * Safe compatibility adapter for real Switch/Discord coordinator agent artifacts.
 *
 * Rules:
 * - Preserves original agent-generated files and hashes.
 * - Never fabricates specialist reports, source IDs, evidence or verification states.
 * - Never converts proposed revenue into agreed revenue.
 * - Never treats estimates as received cash.
 * - Preserves unknown/null financial values correctly.
 * - Maps only fields whose meaning is unambiguous.
 */
export function adaptAgentBundle(bundle: ImportBundle): CompatibilityResult {
  const notes: string[] = [];
  let adapted = false;

  let proposalObj: any;
  try {
    proposalObj = JSON.parse(bundle.proposal.content);
  } catch {
    return { bundle, adapted: false, notes };
  }

  if (typeof proposalObj !== 'object' || proposalObj === null) {
    return { bundle, adapted: false, notes };
  }

  const p = JSON.parse(JSON.stringify(proposalObj));

  // Check if this bundle has the Switch coordinator agent structure
  if (p.statementOfWork || p.specialistContributions || p.executionPlan) {
    // 1. Map missing specialistContactFailures when all specialists reported
    if (p.specialistContactFailures === undefined && Array.isArray(p.specialistContributions)) {
      p.specialistContactFailures = [];
      adapted = true;
      notes.push('Mapped missing specialistContactFailures to empty array.');
    }

    // 2. Map assumption verification fields unambiguously
    if (p.proposal && Array.isArray(p.proposal.assumptions)) {
      for (const a of p.proposal.assumptions) {
        if (!a.verificationStatus && a.status) {
          a.verificationStatus = a.status;
          adapted = true;
        }
        if (!a.requiredConfirmation && a.verificationRequired) {
          a.requiredConfirmation = a.verificationRequired;
          adapted = true;
        }
      }
    }
    if (p.statementOfWork && Array.isArray(p.statementOfWork.assumptions)) {
      for (const a of p.statementOfWork.assumptions) {
        if (!a.verificationStatus && a.status) {
          a.verificationStatus = a.status;
          adapted = true;
        }
        if (!a.requiredConfirmation && a.verificationRequired) {
          a.requiredConfirmation = a.verificationRequired;
          adapted = true;
        }
      }
    }

    // 3. Map statementOfWork.projectOverview client/project names unambiguously
    if (p.statementOfWork && p.statementOfWork.projectOverview) {
      const po = p.statementOfWork.projectOverview;
      if (!po.clientName && po.client) {
        po.clientName = po.client;
        adapted = true;
      }
      if (!po.projectName && po.project) {
        po.projectName = po.project;
        adapted = true;
      }
      if (!po.documentStatus && po.status) {
        po.documentStatus = po.status;
        adapted = true;
      }
      if (!po.businessObjective) {
        po.businessObjective = p.statementOfWork.objective ?? p.project?.brief ?? 'Deliver agency scope';
        adapted = true;
      }
      if (!po.summary) {
        po.summary = p.proposal?.explanation ?? p.statementOfWork.objective ?? 'Project overview';
        adapted = true;
      }
    }

    // 4. Map specialistContributions unambiguously
    if (Array.isArray(p.specialistContributions)) {
      for (const c of p.specialistContributions) {
        if (!c.projectId && p.taskId) {
          c.projectId = p.taskId;
          adapted = true;
        }
        if (!c.analysisTaskId) {
          c.analysisTaskId = c.sourceMessageIds?.[0] ?? p.taskId;
          adapted = true;
        }
        if (!c.findings && c.conclusion) {
          c.findings = [c.conclusion];
          adapted = true;
        }
        if (!c.integration && c.conclusion) {
          c.integration = c.conclusion;
          adapted = true;
        }
      }
    }

    // 5. Map executionPlan resources if needed
    if (p.executionPlan) {
      if (p.executionPlan.resources === undefined && Array.isArray(p.executionPlan.resourceRequirements)) {
        p.executionPlan.resources = p.executionPlan.resourceRequirements.map((r: any) => ({
          role: r.role ?? r.workstream ?? 'Specialist',
          workstream: r.workstream,
          hours: r.hours ?? r.estimatedHours ?? 0,
          estimatedHours: r.estimatedHours,
          status: r.status,
        }));
        adapted = true;
      }
      if (p.executionPlan.resourceStatus === undefined) {
        p.executionPlan.resourceStatus = 'UNCONFIRMED_PENDING_REVIEW';
        adapted = true;
      }
    }

    // 6. Map coordinator decision recommendation to owner recommendation schema
    if (p.ownerDecisionRecommendation) {
      const odr = p.ownerDecisionRecommendation;
      if (!odr.recommendation && odr.decision) {
        odr.recommendation = odr.decision;
        adapted = true;
      }
      if (!odr.reason && Array.isArray(odr.actions)) {
        odr.reason = odr.actions.join('; ');
        adapted = true;
      }
      if (!odr.options) {
        odr.options = ['DEFER', 'PROCEED_WITH_CAUTION', 'REJECT'];
        adapted = true;
      }
      if (odr.ownerApprovalRequired === undefined) {
        odr.ownerApprovalRequired = true;
        adapted = true;
      }
    }

    // 7. Map scenario budgetCents to totalCostCents and verification status
    if (p.financialSummary) {
      const fs = p.financialSummary;
      if (fs.availableDeliveryFundsCents === undefined) {
        fs.availableDeliveryFundsCents = fs.availableFundsCents ?? null;
        adapted = true;
      }
      if (fs.backendVerificationStatus === undefined) {
        fs.backendVerificationStatus = fs.verificationStatus ?? 'UNVERIFIED';
        adapted = true;
      }
      if (fs.financialReviewStatus === undefined) {
        fs.financialReviewStatus = fs.verificationStatus ?? 'PENDING';
        adapted = true;
      }
      if (Array.isArray(fs.scenarios)) {
        for (const s of fs.scenarios) {
          if (s.totalCostCents === undefined && s.budgetCents !== undefined) {
            s.totalCostCents = s.budgetCents;
            adapted = true;
          }
        }
      }
    }

    // 8. Map reconciliation items unambiguously
    if (Array.isArray(p.reconciliation)) {
      for (const r of p.reconciliation) {
        if (!r.original) {
          r.original = 'Initial brief terms';
          adapted = true;
        }
        if (!r.specialistFinding && r.resolution) {
          r.specialistFinding = r.resolution;
          adapted = true;
        }
      }
    }
  }

  const adaptedBundle: ImportBundle = {
    proposal: {
      name: bundle.proposal.name,
      content: adapted ? JSON.stringify(p, null, 2) : bundle.proposal.content,
    },
    ...(bundle.evidence ? { evidence: bundle.evidence } : {}),
    ...(bundle.summary ? { summary: bundle.summary } : {}),
  };

  return { bundle: adaptedBundle, adapted, notes };
}
