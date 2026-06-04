/**
 * COMBO DECOMPOSITION MAP — Nivra Telecom
 * 
 * Combos are UX/sales abstractions ONLY. When a combo is selected, it is decomposed
 * into individual billable items (base internet + TV pack).
 * 
 * Each combo maps to exactly:
 *   - 1 base internet plan (from plan_mapping, category: internet)
 *   - 1 TV pack (from plan_mapping, category: tv_pack)
 * 
 * The sum of individual item prices must match the combo's advertised price.
 */

export interface DecomposedItem {
  plan_code: string;
  role: "base" | "addon";  // base = internet, addon = tv_pack
}

export interface ComboDecomposition {
  combo_plan_code: string;
  items: DecomposedItem[];
}

/**
 * Canonical combo → individual items mapping.
 * 
 * Pricing reference (from plan_mapping):
 *   internet_100 = $45, internet_500 = $50, internet_giga = $60
 *   tvpack_famille = $44.99, tvpack_sports = $49.99, etc.
 * 
 * Combo prices are promotional bundles — the individual plan prices
 * are authoritative. Discounts are applied at the invoice level.
 */
const COMBO_MAP: Record<string, DecomposedItem[]> = {
  // Internet 100 + TV Basic → internet_100 + tvpack_famille
  "tv_basic": [
    { plan_code: "internet_100", role: "base" },
    { plan_code: "tvpack_famille", role: "addon" },
  ],
  // Internet 500 + TV 5 choix → internet_500 + tvpack_famille  
  "tv_5choices": [
    { plan_code: "internet_500", role: "base" },
    { plan_code: "tvpack_famille", role: "addon" },
  ],
  // Internet 500 + TV 10 choix → internet_500 + tvpack_sports
  "tv_10choices": [
    { plan_code: "internet_500", role: "base" },
    { plan_code: "tvpack_sports", role: "addon" },
  ],
  // Internet 500 + TV 15 choix → internet_500 + tvpack_international
  "tv_15choices": [
    { plan_code: "internet_500", role: "base" },
    { plan_code: "tvpack_international", role: "addon" },
  ],
  // Internet 500 + TV 25 choix → internet_500 + tvpack_cinema
  "tv_25choices": [
    { plan_code: "internet_500", role: "base" },
    { plan_code: "tvpack_cinema", role: "addon" },
  ],
  // GIGA + TV Basic → internet_giga + tvpack_famille
  "giga_tv_basic": [
    { plan_code: "internet_giga", role: "base" },
    { plan_code: "tvpack_famille", role: "addon" },
  ],
  // GIGA + TV 5 choix → internet_giga + tvpack_famille
  "giga_tv_5choices": [
    { plan_code: "internet_giga", role: "base" },
    { plan_code: "tvpack_famille", role: "addon" },
  ],
  // GIGA + TV 10 choix → internet_giga + tvpack_sports
  "giga_tv_10choices": [
    { plan_code: "internet_giga", role: "base" },
    { plan_code: "tvpack_sports", role: "addon" },
  ],
  // GIGA + TV 15 choix → internet_giga + tvpack_international
  "giga_tv_15choices": [
    { plan_code: "internet_giga", role: "base" },
    { plan_code: "tvpack_international", role: "addon" },
  ],
  // GIGA + TV 25 choix → internet_giga + tvpack_cinema
  "giga_tv_25choices": [
    { plan_code: "internet_giga", role: "base" },
    { plan_code: "tvpack_cinema", role: "addon" },
  ],
};

/**
 * Returns true if the given plan_code is a combo that must be decomposed.
 */
export function isCombo(planCode: string): boolean {
  return planCode in COMBO_MAP;
}

/**
 * Decomposes a combo plan_code into individual billable items.
 * Returns null if the plan_code is not a combo (i.e., it's already atomic).
 */
export function decomposeCombo(planCode: string): DecomposedItem[] | null {
  return COMBO_MAP[planCode] ?? null;
}

/**
 * Given a plan_code (possibly a combo), returns the list of
 * individual plan_codes that should be used as Stripe subscription items.
 * If it's not a combo, returns the original plan_code as a single-item array.
 */
export function resolveSubscriptionItems(planCode: string): string[] {
  const decomposed = decomposeCombo(planCode);
  if (decomposed) {
    return decomposed.map(d => d.plan_code);
  }
  return [planCode];
}
