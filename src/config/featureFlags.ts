export const featureFlags = {
  noiseEvidenceV2: import.meta.env.VITE_FF_NOISE_EVIDENCE_V2 === "true",
  evidenceTimelineV2: import.meta.env.VITE_FF_EVIDENCE_TIMELINE_V2 === "true",
  basPrepV2: import.meta.env.VITE_FF_BAS_PREP_V2 === "true",
  dossierV2: import.meta.env.VITE_FF_DOSSIER_V2 === "true",
  localServicesV1: import.meta.env.VITE_FF_LOCAL_SERVICES_V1 === "true",
} as const;
