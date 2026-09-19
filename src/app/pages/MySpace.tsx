import { useSearchParams } from "react-router";
import { MySpaceClassic } from "./MySpaceClassic";
import { MySpaceGrid } from "./MySpaceGrid";

/**
 * Temporary switch while docs/my-space-spec.md's rebuild is in progress
 * (Stages 2-6). `?v2=1` previews the new grid page; everyone else keeps the
 * existing single-column page, so nothing half-built ships by default.
 * Stage 5 removes this switch and MySpaceClassic.tsx entirely.
 */
export function MySpace() {
  const [searchParams] = useSearchParams();
  return searchParams.get("v2") === "1" ? <MySpaceGrid /> : <MySpaceClassic />;
}
