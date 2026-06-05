export type ModelTier = "fast" | "standard" | "pro";
export type ModelCapability = "reasoning" | "execution" | "judgment";

export interface ModelEntry {
  id: string;
  tier: ModelTier;
  capabilities: ModelCapability[];
  costPer1kTokens: number;
  description: string;
}

export const MIMO_CATALOG: ModelEntry[] = [
  {
    id: "mimo-v2.5",
    tier: "fast",
    capabilities: ["execution"],
    costPer1kTokens: 0.0006,
    description: "Cheap, fast worker model for clear execution tasks"
  },
  {
    id: "mimo-v2.5-pro",
    tier: "pro",
    capabilities: ["reasoning", "judgment", "execution"],
    costPer1kTokens: 0.0024,
    description: "Strong reasoning model for planning, judgment, and complex tasks"
  },
  {
    id: "mimo-v2-pro",
    tier: "standard",
    capabilities: ["reasoning", "execution"],
    costPer1kTokens: 0.0012,
    description: "Balanced model for hybrid tasks needing some reasoning"
  },
  {
    id: "mimo-v2-omni",
    tier: "standard",
    capabilities: ["reasoning", "execution"],
    costPer1kTokens: 0.0012,
    description: "Multi-purpose model for general tasks"
  }
];

export function findModel(id: string, catalog: ModelEntry[] = MIMO_CATALOG): ModelEntry | undefined {
  return catalog.find((m) => m.id === id);
}

export function pickModelForTier(
  tier: ModelTier,
  catalog: ModelEntry[] = MIMO_CATALOG
): ModelEntry | undefined {
  return catalog.find((m) => m.tier === tier);
}

export function costForUsage(modelId: string, tokens: number, catalog: ModelEntry[] = MIMO_CATALOG): number {
  const entry = findModel(modelId, catalog);
  if (!entry) return 0;
  return Number(((tokens / 1000) * entry.costPer1kTokens).toFixed(6));
}
