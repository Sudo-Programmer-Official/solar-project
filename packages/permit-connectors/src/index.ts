export * from "../../contracts/src/index";
export * from "./connectors";
export * from "./market";

export const permitTaxonomyRules = [
  {
    category: "solar",
    patterns: [/\bphotovoltaic\b/i, /\bsolar\b/i, /\bPV system\b/i, /\brooftop PV\b/i],
  },
  {
    category: "roof_replacement",
    patterns: [/\bre-?roof\b/i, /\broof replacement\b/i, /\bshingle replacement\b/i],
  },
  {
    category: "electrical_service",
    patterns: [/\bservice upgrade\b/i, /\bpanel upgrade\b/i, /\b200 amp\b/i, /\belectrical service\b/i],
  },
] as const;
