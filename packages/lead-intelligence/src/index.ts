import type { NextBestAction } from "../../contracts/src/index";

export type LeadInterestLevel =
  | "none"
  | "flyer_delivered"
  | "qr_scanned"
  | "roof_checker_started"
  | "roof_report_viewed"
  | "contact_submitted"
  | "follow_up_requested"
  | "bill_provided"
  | "appointment_booked"
  | "consultant_completed"
  | "agreement_signed";

export function interestScoreFromLevel(level: LeadInterestLevel): number {
  const table: Record<LeadInterestLevel, number> = {
    none: 0,
    flyer_delivered: 10,
    qr_scanned: 20,
    roof_checker_started: 30,
    roof_report_viewed: 40,
    contact_submitted: 50,
    follow_up_requested: 60,
    bill_provided: 70,
    appointment_booked: 80,
    consultant_completed: 90,
    agreement_signed: 100,
  };

  return table[level];
}

export interface LeadActionContext {
  billRequested?: boolean;
  billReceived?: boolean;
  appointmentBooked?: boolean;
  contractSigned?: boolean;
  cancelled?: boolean;
  noShow?: boolean;
  permitPendingDays?: number | null;
  spouseRequired?: boolean;
  roofDocsMissing?: boolean;
  usageUnknown?: boolean;
  strongSolarPotential?: boolean;
}

export function recommendNextBestAction(context: LeadActionContext): NextBestAction {
  if (context.cancelled) {
    return {
      code: "RECOVER_CANCELLED_CUSTOMER",
      label: "RECOVER CANCELLED CUSTOMER",
      reason: "A cancelled opportunity can be reactivated with a new roof, new bill, or changed household timing.",
      priority: "HIGH",
      tone: "recovery",
    };
  }

  if (context.contractSigned) {
    return {
      code: "PERMIT_NEEDS_REVIEW",
      label: "PERMIT NEEDS REVIEW",
      reason: "The deal is signed, so the next risk is in permitting and corrections.",
      priority: "HIGH",
      tone: "ops",
    };
  }

  if (context.appointmentBooked) {
    return {
      code: "SEND_CONSULTANT",
      label: "SEND CONSULTANT",
      reason: "The homeowner is warm enough for a structured consultation or closer handoff.",
      priority: "HIGH",
      tone: "sales",
    };
  }

  if (context.billReceived) {
    return {
      code: "BOOK_CONSULTATION",
      label: "BOOK CONSULTATION",
      reason: "The bill is in hand, so the lead can be turned into a tailored proposal quickly.",
      priority: "HIGH",
      tone: "sales",
    };
  }

  if (context.billRequested) {
    return {
      code: "FOLLOW_UP_TUESDAY",
      label: "FOLLOW UP TUESDAY",
      reason: "The homeowner asked for time to send the bill or speak later.",
      priority: "HIGH",
      tone: "sales",
    };
  }

  if (context.noShow) {
    return {
      code: "REVISIT_6_PM",
      label: "REVISIT 6 PM",
      reason: "A missed contact is best recovered with a timed revisit window.",
      priority: "HIGH",
      tone: "sales",
    };
  }

  if (context.spouseRequired) {
    return {
      code: "SPOUSE_REQUIRED",
      label: "SPOUSE REQUIRED",
      reason: "The decision maker wants both homeowners present before moving forward.",
      priority: "HIGH",
      tone: "sales",
    };
  }

  if (context.roofDocsMissing) {
    return {
      code: "REQUEST_ROOF_DOCUMENTATION",
      label: "REQUEST ROOF DOCUMENTATION",
      reason: "The roof history needs to be confirmed before the design is trusted.",
      priority: "MEDIUM",
      tone: "ops",
    };
  }

  if (context.permitPendingDays != null && context.permitPendingDays > 10) {
    return {
      code: "PERMIT_NEEDS_REVIEW",
      label: "PERMIT NEEDS REVIEW",
      reason: "The permit is aging beyond the usual turnaround window.",
      priority: "HIGH",
      tone: "ops",
    };
  }

  if (context.usageUnknown) {
    return {
      code: "VERIFY_LOADS",
      label: "VERIFY LOADS",
      reason: "The lead is promising, but usage still needs confirmation.",
      priority: "MEDIUM",
      tone: "sales",
    };
  }

  if (context.strongSolarPotential) {
    return {
      code: "GET_BILL",
      label: "GET BILL",
      reason: "The roof looks strong enough that the electric bill is the fastest value unlock.",
      priority: "HIGH",
      tone: "sales",
    };
  }

  return {
    code: "NO_ACTION",
    label: "NO ACTION",
    reason: "No additional action is required right now.",
    priority: "LOW",
    tone: "manager",
  };
}
