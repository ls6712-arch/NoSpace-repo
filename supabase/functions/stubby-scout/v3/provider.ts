/** Single source of truth for key selection and provider routing. No implicit paid failover. */
import { anthropicAdapter, CLAUDE_MODEL } from "./anthropic.ts";
import { openAIAdapter } from "./openai.ts";
type Env = (name: string) => string | undefined;
export type V3Provider = "anthropic" | "openai";
export function providerOf(env: Env): V3Provider | null {
  const value = (env("STUBBY_V3_PROVIDER") ?? "anthropic").trim().toLowerCase();
  return value === "anthropic" || value === "openai" ? value : null;
}
export function providerHasKey(env: Env): boolean {
  const provider = providerOf(env);
  return provider !== null && !!env(provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY")?.trim();
}
export function createV3Provider(env: Env, options: { maxSearches?: number; fetchImpl?: typeof fetch } = {}) {
  const provider = providerOf(env);
  if (provider === "anthropic") return { provider, ...anthropicAdapter({ ...options,
    apiKey: env("ANTHROPIC_API_KEY") ?? "", workspaceId: env("ANTHROPIC_WORKSPACE_ID"),
    model: env("STUBBY_CLAUDE_MODEL") || env("STUBBY_SCOUT_MODEL") || CLAUDE_MODEL }) };
  if (provider === "openai") return { provider, ...openAIAdapter({ ...options,
    apiKey: env("OPENAI_API_KEY") ?? "", model: env("STUBBY_OPENAI_MODEL") || "gpt-4.1" }) };
  throw new Error("Unknown Stubby provider");
}
