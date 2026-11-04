import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
export const PURSUIT_NOTICES_CHANGED = 'pursuit-notices-changed';
export function usePursuitNoticeCount(userId?: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0); if (!supabase || !userId) return; const client = supabase; let live = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const result = await client.from('pursuit_notices').select('id', { head:true, count:'exact' }).eq('user_id',userId).is('read_at',null);
        if (live) setCount(result.error ? 0 : result.count ?? 0);
      } catch { /* The existing bell works before the additive migration is deployed. */ }
    };
    void load(); const timer=window.setInterval(() => void load(),15000);
    window.addEventListener(PURSUIT_NOTICES_CHANGED,load); window.addEventListener('focus',load);
    return () => { live=false;clearInterval(timer);window.removeEventListener(PURSUIT_NOTICES_CHANGED,load);window.removeEventListener('focus',load); };
  },[userId]);
  return count;
}
export async function markPursuitNoticesRead(userId: string) {
  if (!supabase) return;
  const { error } = await supabase.from('pursuit_notices').update({read_at:new Date().toISOString()}).eq('user_id',userId).is('read_at',null);
  // A missing table must not break marking legacy notifications read before deployment.
  if (error && !['42P01','PGRST205'].includes(error.code)) throw error;
  window.dispatchEvent(new Event(PURSUIT_NOTICES_CHANGED));
}
