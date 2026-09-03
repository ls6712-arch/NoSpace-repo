import { Link } from "react-router";
import { Zap } from "lucide-react";
import { useRewards } from "../context/RewardsContext";

export function RewardsWidget() {
  const { points, level } = useRewards();

  return (
    <Link
      to="/profile"
      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors"
    >
      <Zap className="size-3.5 text-[#E8B84B] fill-[#E8B84B]" />
      <span className="font-hud tabular-nums">{points}</span>
      <span className="text-muted-foreground hidden sm:inline font-hud">· Lv.{level}</span>
    </Link>
  );
}
