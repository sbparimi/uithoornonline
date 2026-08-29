const envFlag = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
};

/**
 * Build-time feature flags. Keep screen-level flags centralized so a redesign
 * can be enabled/disabled without spreading environment access through routes.
 *
 * HOME_V2 defaults to true because the current production home is already the
 * redesigned experience. Set VITE_FF_HOME_V2=false to exercise the rollback
 * presentation while developing locally.
 */
export const featureFlags = {
  homeV2: envFlag(import.meta.env.VITE_FF_HOME_V2, true),
  chatV2: envFlag(import.meta.env.VITE_FF_CHAT_V2, true),
  checkV2: envFlag(import.meta.env.VITE_FF_CHECK_V2, false),
  logV2: envFlag(import.meta.env.VITE_FF_LOG_V2, false),
  mapV2: envFlag(import.meta.env.VITE_FF_MAP_V2, false),
  dossierV2: envFlag(import.meta.env.VITE_FF_DOSSIER_V2, false),
} as const;
