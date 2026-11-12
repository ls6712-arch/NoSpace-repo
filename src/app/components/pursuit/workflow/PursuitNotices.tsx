import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { type Notice } from "../../../lib/pursuitWorkflow";
import { formatWhen } from "../../../lib/dates";
export function PursuitNotices() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    setNotices([]);
    if (!supabase || !user) return;
    const client = supabase;
    let live = true;
    async function load() {
      const { data, error } = await client
        .from("pursuit_notices")
        .select("*")
        .eq("user_id", user!.id)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(30);
      // Before the additive migration is deployed, the existing Inbox continues unchanged.
      if (!error && live) setNotices(data ?? []);
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [user?.id]);
  if (!notices.length) return null;
  return (
    <section className="mb-6 space-y-3">
      <h2 className="text-lead">Pursuits</h2>
      {notices.map((n) => (
        <Link
          className="block rounded-card border border-border bg-card p-4"
          key={n.id}
          to={`/pursuit/${n.pursuit_id}`}
        >
          <p className="text-small">{n.body}</p>
          <p className="mt-1 text-caption text-muted-foreground">
            {formatWhen(n.created_at, { ago: true })}
          </p>
        </Link>
      ))}
    </section>
  );
}
