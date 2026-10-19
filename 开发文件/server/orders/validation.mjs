import contract from '../../contracts/openapi.json' with {type:'json'};
import {fail} from './repository.mjs';
import {date,timestamp} from '../monitor/overview.mjs';

export function validate(name,value){
 const errors=[];
 function visit(schema,v,p){
  if(schema.$ref)return visit(contract.components.schemas[schema.$ref.split('/').at(-1)],v,p);
  if(schema.anyOf){if(!schema.anyOf.some(s=>{const n=errors.length;visit(s,v,p);const ok=errors.length===n;errors.splice(n);return ok;}))errors.push({field:p,reason:'类型或可空字段格式不符'});return;}
  if(schema.const!==undefined&&v!==schema.const)errors.push({field:p,reason:'固定值不符'});
  if(schema.enum&&!schema.enum.includes(v))errors.push({field:p,reason:'枚举值无效'});
  const type=schema.type;
  if(type==='null'){if(v!==null)errors.push({field:p,reason:'必须为空'});return;}
  if(type==='object'){
   if(!v||typeof v!=='object'||Array.isArray(v)){errors.push({field:p,reason:'必须是对象'});return;}
   for(const k of schema.required??[])if(!(k in v))errors.push({field:p+'.'+k,reason:'缺少必填字段'});
   for(const [k,x] of Object.entries(v)){if(schema.properties?.[k])visit(schema.properties[k],x,p+'.'+k);else if(schema.additionalProperties===false)errors.push({field:p+'.'+k,reason:'未知字段'});}
  }else if(type==='array'){
   if(!Array.isArray(v)){errors.push({field:p,reason:'必须是数组'});return;}
   if(v.length<(schema.minItems??0)||v.length>(schema.maxItems??Infinity))errors.push({field:p,reason:'条目数量超出限制'});
   v.forEach((x,i)=>visit(schema.items,x,p+'['+i+']'));
  }else if(type==='string'){
   if(typeof v!=='string'){errors.push({field:p,reason:'必须是字符串'});return;}
   if(v.length<(schema.minLength??0)||v.length>(schema.maxLength??Infinity)||schema.pattern&&!new RegExp(schema.pattern).test(v))errors.push({field:p,reason:'字符串格式不符'});
   try{if(schema.format==='date')date(v);if(schema.format==='date-time')timestamp(v);}catch{errors.push({field:p,reason:'日期或时间格式无效'});}
  }else if(type==='integer'||type==='number'){
   if(typeof v!=='number'||!Number.isFinite(v)||type==='integer'&&!Number.isInteger(v)||v<(schema.minimum??-Infinity)||v>(schema.maximum??Infinity))errors.push({field:p,reason:'数值超出限制'});
  }else if(type==='boolean'&&typeof v!=='boolean')errors.push({field:p,reason:'必须是布尔值'});
 }
 visit(contract.components.schemas[name],value,name);
 if(errors.length)throw fail('INVALID_REQUEST','请求不符合接口契约',400,errors.slice(0,100));return value;
}
