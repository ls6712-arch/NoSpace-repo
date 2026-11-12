/** Claude only (founder, Nov 3, 2026): the one place V3's key and model are chosen. No other provider, no failover. */
import { anthropicAdapter, CLAUDE_MODEL } from "./anthropic.ts";
type Env = (name: string) => string | undefined;
export function providerHasKey(env: Env): boolean {
  return !!env("ANTHROPIC_API_KEY")?.trim();
}
export function createV3Provider(env: Env, options: { maxSearches?: number; fetchImpl?: typeof fetch } = {}) {
  return { provider: "anthropic" as const, ...anthropicAdapter({ ...options,
    apiKey: env("ANTHROPIC_API_KEY") ?? "", workspaceId: env("ANTHROPIC_WORKSPACE_ID"),
    model: env("STUBBY_CLAUDE_MODEL") || env("STUBBY_SCOUT_MODEL") || CLAUDE_MODEL }) };
}
