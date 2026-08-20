export type ComplianceWarningCode =
  | "NO_PARTNERSHIP_CLAIM"
  | "NO_SAVINGS_GUARANTEE"
  | "NO_FREE_PPA"
  | "NO_PROTECTED_CLASS_INFERENCE"
  | "NO_NO_UPFRONT_COST_CONFUSION"
  | "NO_PUBLIC_HOMEOWNER_NAMES";

export interface ComplianceWarning {
  code: ComplianceWarningCode;
  message: string;
}

export const complianceGuardrails: ComplianceWarning[] = [
  {
    code: "NO_PARTNERSHIP_CLAIM",
    message: "Never claim a utility partnership unless verified by a current source.",
  },
  {
    code: "NO_SAVINGS_GUARANTEE",
    message: "Never guarantee savings.",
  },
  {
    code: "NO_FREE_PPA",
    message: "Never call a PPA free electricity.",
  },
  {
    code: "NO_NO_UPFRONT_COST_CONFUSION",
    message: "Distinguish no upfront installation cost from no cost.",
  },
  {
    code: "NO_PUBLIC_HOMEOWNER_NAMES",
    message: "Never expose homeowner names publicly.",
  },
  {
    code: "NO_PROTECTED_CLASS_INFERENCE",
    message: "Never infer protected characteristics.",
  },
];
