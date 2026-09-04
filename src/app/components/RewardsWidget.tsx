import { Link } from "react-router";
import { Zap } from "lucide-react";
import { useRewards } from "../context/RewardsContext";

export function RewardsWidget() {
  const { points, level } = useRewards();

  return (
    <Link
      to="/you"
      className="flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-3 py-1.5 text-sm hover:bg-surface-muted transition-colors"
    >
      <Zap className="size-3.5 text-[var(--mustard)] fill-[var(--mustard)]" />
      <span className="font-hud tabular-nums">{points}</span>
      <span className="text-muted-foreground hidden sm:inline font-hud">· Lv.{level}</span>
    </Link>
  );
}
