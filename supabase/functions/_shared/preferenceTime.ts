import type { Personalization } from "./personalization.ts";
export function localClock(ms:number,timeZone="America/New_York"){
 const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",hourCycle:"h23",weekday:"short"}).formatToParts(ms).map(p=>[p.type,p.value]));
 return {year:Number(parts.year),month:Number(parts.month),day:Number(parts.day),hour:Number(parts.hour),minute:Number(parts.minute),dow:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(parts.weekday)};
}
export function preferenceTimeScore(p:Personalization,ms:number,timeZone="America/New_York"){
 const c=localClock(ms,timeZone);return ((p.rhythm.includes("morning") && c.hour>=6 && c.hour<12) || (p.rhythm.includes("evening") && c.hour>=18) || (p.rhythm.includes("weekend") && [0,6].includes(c.dow)))?3:0;
}
export function localTimeMs(year:number,month:number,day:number,hour:number,timeZone:string){
 const desired=Date.UTC(year,month-1,day,hour);let result=desired;
 for(let n=0;n<3;n++){const p=localClock(result,timeZone);result+=desired-Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);}
 return result;
}
