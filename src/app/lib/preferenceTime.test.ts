import { expect, it } from "vitest";
import { localClock,localTimeMs } from "../../../supabase/functions/_shared/preferenceTime";
import { windowsLeft } from "./homeWeek";
it.each(["America/New_York","Asia/Kolkata","Asia/Kathmandu","Pacific/Kiritimati"])("keeps wall clock preferences exact in %s",zone=>{
 const ms=localTimeMs(2026,11,4,9,zone);
 expect(localClock(ms,zone)).toMatchObject({year:2026,month:11,day:4,hour:9,minute:0});
 const windows=windowsLeft(["wed-day"],ms,zone);
 expect(localClock(windows[0].startMs,zone)).toMatchObject({day:4,hour:6,minute:0});
 expect(localClock(windows[0].endMs,zone)).toMatchObject({day:4,hour:18,minute:0});
});
it.each([[3,8,23],[11,1,25]])("preserves the full local day across the NY DST change on %s/%s",(month,day,hours)=>{
 expect((localTimeMs(2026,month,day+1,0,"America/New_York")-localTimeMs(2026,month,day,0,"America/New_York"))/3600000).toBe(hours);
});
