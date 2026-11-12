/** Shared read contract. The RPC enforces ownership, membership, blocking and per-session declines. */
export interface CalendarSession {
  id: string;
  pursuit_id: string;
  owner_id: string;
  creator_id: string;
  title: string;
  starts_at: string;
  place: string | null;
  hobby_slug: string | null;
  sub_hobby: string | null;
  is_plan: boolean;
  shared_session: boolean;
  n: number;
  total: number;
}
export interface CalendarSessionDb {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}
export async function calendarSessions(
  db: CalendarSessionDb,
  userId: string,
  from: number,
  to: number,
): Promise<CalendarSession[]> {
  const result = await db.rpc("get_calendar_pursuit_sessions", {
    p_user: userId,
    p_from: new Date(from).toISOString(),
    p_to: new Date(to).toISOString(),
  });
  if (result.error || !Array.isArray(result.data))
    throw new Error("Calendar sessions could not be loaded");
  return result.data as CalendarSession[];
}
