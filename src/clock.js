/* Real local time is independent of the exhibition's animation clock. */
'use strict';
(() => {
 const A=window.AION,TAU=Math.PI*2;
 function sample(timestamp=Date.now()) {
  const date=new Date(Number(timestamp));
  if(!Number.isFinite(date.getTime()))throw new RangeError('時計に無効な日時が渡されました。');
  const hours=date.getHours(),minutes=date.getMinutes(),seconds=date.getSeconds(),milliseconds=date.getMilliseconds();
  const localSeconds=hours*3600+minutes*60+seconds+milliseconds/1000;
  // Blades point along local +Y at twelve; negative Z turns clockwise.
  // Full local epoch keeps rear wheels continuous across midnight.
  const driveSeconds=date.getTime()/1000-date.getTimezoneOffset()*60;
  return {timestamp:date.getTime(),hours,minutes,seconds,milliseconds,localSeconds,driveSeconds,
   hourAngle:-TAU*(localSeconds%43200)/43200,
   minuteAngle:-TAU*(localSeconds%3600)/3600,
   timezoneOffset:date.getTimezoneOffset()};
 }
 A.Clock={sample,MINUTE_RATE:-TAU/3600,HOUR_RATE:-TAU/43200};
})();
