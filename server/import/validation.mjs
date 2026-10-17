import Decimal from 'decimal.js';
export function decimal(value){if(value===null||value===undefined||String(value).trim()==='')return null;const s=String(value).trim();if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s))throw new Error('必须是数值');const d=new Decimal(s);if(!d.isFinite()||d.abs().gt('1e15')||d.isNegative())throw new Error('数值必须非负且不超过10^15');return d.toFixed();}
export function excelDate(value,epoch1904=false,withTime=false){
 if(value===null||value===undefined||value==='')throw new Error('日期缺失');
 if(/^\d{4}-\d{2}-\d{2}/.test(String(value))){
  const s=String(value),m=s.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|\+08:00)?)?$/);
  if(!m||Number(m[2]??0)>23||Number(m[3]??0)>59||Number(m[4]??0)>59)throw new Error('日期或时间无效；时区须为+08:00');
  const date=m[1];if(new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('日期无效');
  if(withTime&&m[5]==='Z')return new Date(Date.parse(s)+8*3600000).toISOString().slice(0,19)+'+08:00';
  return withTime?`${date}T${m[2]??'00'}:${m[3]??'00'}:${m[4]??'00'}+08:00`:date;
 }
 const n=Number(value);if(!Number.isFinite(n)||n<0||n>2958465||(!epoch1904&&Math.floor(n)===60))throw new Error('Excel日期无效');
 const epoch=epoch1904?Date.UTC(1904,0,1):Date.UTC(1899,11,n<60?31:30);const ms=epoch+Math.round(n*86400)*1000;const iso=new Date(ms).toISOString();return withTime?iso.slice(0,19)+'+08:00':iso.slice(0,10);
}
export function columnIndex(c){let n=0;for(const x of c)n=n*26+x.charCodeAt(0)-64;return n;}
export function addDays(date,n){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
