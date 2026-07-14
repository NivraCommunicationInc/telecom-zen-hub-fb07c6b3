// Canonical step order — must match DB CHECK constraint on intervention_sessions.current_step
export const STEP_ORDER = [
  "arrival",
  "checklist",
  "equipment",
  "test_internet",
  "test_wifi",
  "test_tv",
  "activation",
  "wifi_config",
  "client_validation",
  "photos",
  "signature",
  "closed",
] as const;

export type Step = typeof STEP_ORDER[number];

export const STEP_META: Record<Step, { label: string; short: string }> = {
  arrival:            { label: "Arrivée sur site",           short: "Arrivée" },
  checklist:          { label: "Vérifications initiales",    short: "Checklist" },
  equipment:          { label: "Scan équipement",            short: "Équipement" },
  test_internet:      { label: "Test Internet",              short: "Test Internet" },
  test_wifi:          { label: "Test Wi-Fi",                 short: "Test Wi-Fi" },
  test_tv:            { label: "Test TV",                    short: "Test TV" },
  activation:         { label: "Activation du service",      short: "Activation" },
  wifi_config:        { label: "Configuration Wi-Fi",        short: "Config Wi-Fi" },
  client_validation:  { label: "Validation par le client",   short: "Validation" },
  photos:             { label: "Photos avant/après",         short: "Photos" },
  signature:          { label: "Signature électronique",     short: "Signature" },
  closed:             { label: "Intervention clôturée",      short: "Clôturé" },
};

export function nextStep(s: Step): Step | null {
  const i = STEP_ORDER.indexOf(s);
  return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : null;
}
export function stepIndex(s: Step): number { return STEP_ORDER.indexOf(s); }
