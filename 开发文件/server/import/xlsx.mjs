import {Unzip,UnzipInflate,strFromU8} from 'fflate';
import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {createHash} from 'node:crypto';
import path from 'node:path';
const arr=x=>x==null?[]:Array.isArray(x)?x:[x];
const text=x=>x==null?'':typeof x==='object'?String(x['#text']??''):String(x);
export function readXlsx(buffer,{limits={}}={}){
 const max=limits.expandedBytes??100*1024*1024;
 if(buffer.length>10*1024*1024)throw new Error('Excel文件超过10MiB');
 if(buffer[0]!==0x50||buffer[1]!==0x4b)throw new Error('无效Excel ZIP文件');
 const entries=new Map();let total=0,count=0;
 const unzip=new Unzip(file=>{
  const name=file.name;
  if(++count>20000||entries.has(name)||name.startsWith('/')||name.includes('\\')||name.split('/').includes('..'))throw new Error('ZIP条目无效或重复');
  if(file.originalSize>max-total)throw new Error('Excel解压数据超过限制');
  const chunks=[];entries.set(name,null);
  file.ondata=(error,data,final)=>{if(error)throw new Error('Excel ZIP解压失败');total+=data.length;if(total>max)throw new Error('Excel解压数据超过限制');chunks.push(data);if(final){const out=new Uint8Array(chunks.reduce((s,c)=>s+c.length,0));let off=0;for(const c of chunks){out.set(c,off);off+=c.length;}entries.set(name,out);}};
  file.start();
 });unzip.register(UnzipInflate);
 try{for(let i=0;i<buffer.length;i+=65536)unzip.push(buffer.subarray(i,i+65536),i+65536>=buffer.length);}catch(e){throw new Error(e.message.includes('限制')?e.message:`Excel ZIP解析失败：${e.message}`);}
 const parser=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,parseAttributeValue:false,trimValues:false,processEntities:false});
 const xml=name=>{const bytes=entries.get(name);if(!bytes)throw new Error(`Excel缺少部件 ${name}`);const raw=strFromU8(bytes);if(/<!DOCTYPE|<!ENTITY/i.test(raw))throw new Error('Excel不允许外部实体或DTD');if(XMLValidator.validate(raw)!==true)throw new Error(`Excel XML损坏 ${name}`);return parser.parse(raw);};
 if([...entries.keys()].some(x=>/vbaProject\.bin$/i.test(x)))throw new Error('不支持宏Excel');
 const types=strFromU8(entries.get('[Content_Types].xml')??new Uint8Array());if(/macroEnabled/i.test(types))throw new Error('不支持宏Excel');
 const book=xml('xl/workbook.xml').workbook;
 const relations=Object.fromEntries(arr(xml('xl/_rels/workbook.xml.rels').Relationships?.Relationship).map(r=>[r['@_Id'],r]));
 const strings=entries.has('xl/sharedStrings.xml')?arr(xml('xl/sharedStrings.xml').sst?.si).map(si=>si.t!==undefined?text(si.t):arr(si.r).map(r=>text(r.t)).join('')):[];
 let inputRows=0;
 const sheets=arr(book?.sheets?.sheet).map(sh=>{
  const rel=relations[sh['@_id']];if(!rel||rel['@_TargetMode']==='External')throw new Error('Excel工作表关系无效');
  const target=path.posix.normalize(rel['@_Target'].startsWith('/')?rel['@_Target'].slice(1):'xl/'+rel['@_Target']);
  if(!target.startsWith('xl/'))throw new Error('Excel工作表路径无效');
  const ws=xml(target).worksheet,cells={};const rows=arr(ws?.sheetData?.row);inputRows+=rows.length;if(inputRows>(limits.rows??100000))throw new Error('Excel输入行超过100000行限制');
  for(const row of rows)for(const c of arr(row.c)){
   const ref=c['@_r'];if(!/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(ref??'')||cells[ref])throw new Error('Excel单元格编号无效或重复');
   const t=c['@_t'];let value=null,kind='number';
   if(c.f!==undefined){kind='formula';value=text(c.v);}
   else if(t==='s'){kind='text';value=strings[Number(text(c.v))];if(value===undefined)throw new Error('Excel共享字符串索引无效');}
   else if(t==='inlineStr'){kind='text';value=c.is?.t!==undefined?text(c.is.t):arr(c.is?.r).map(r=>text(r.t)).join('');}
   else if(t==='str'){kind='text';value=text(c.v);}
   else if(t==='d'){kind='date';value=text(c.v);}
   else if(t==='b'){kind='boolean';value=text(c.v);}
   else if(t==='e'){kind='error';value=text(c.v);}
   else value=c.v===undefined||text(c.v)===''?null:text(c.v);
   // XML character entities are decoded once; no external entity evaluation.
   if(kind==='text'&&value)value=value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
   cells[ref]={ref,value,kind};
  }
  const relFile=path.posix.dirname(target)+'/_rels/'+path.posix.basename(target)+'.rels';let tables=[];
  if(entries.has(relFile)){const rs=arr(xml(relFile).Relationships?.Relationship);for(const r of rs)if(/\/table$/.test(r['@_Type']??'')){if(r['@_TargetMode']==='External')throw new Error('外部Excel表不支持');const tp=path.posix.normalize(r['@_Target'].startsWith('/')?r['@_Target'].slice(1):path.posix.dirname(target)+'/'+r['@_Target']);if(!tp.startsWith('xl/'))throw new Error('Excel表路径无效');const tb=xml(tp).table;tables.push({name:tb['@_name']??tb['@_displayName'],ref:tb['@_ref']});}}
  return {name:sh['@_name'],cells,tables};
 });
 if(new Set(sheets.map(s=>s.name)).size!==sheets.length)throw new Error('Excel工作表名称重复');
 return {epoch1904:['1','true'].includes(book?.workbookPr?.['@_date1904']),hash:createHash('sha256').update(buffer).digest('hex'),sheets};
}
