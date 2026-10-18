const BASE='/api/v1/ai';
export function createAiTransport(fetcher=(...args)=>fetch(...args)){
 return {
  async status({signal}={}){
   try{
    const response=await fetcher(BASE+'/status',{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(4000)]):AbortSignal.timeout(4000)});
    const body=await response.json();if(!response.ok||body.error)throw new Error(body.error?.message||`状态查询失败（${response.status}）`);
    return {...body.data,status:body.data?.status==='ready'?'ready':'offline'};
   }catch(e){if(signal?.aborted)throw e;return {status:'offline',message:e.name==='TimeoutError'?'AI状态查询超时，请稍后重新检测':e.message};}
  },
  async sendChat({message,history=[],asOf,orderId='',signal,onDelta=()=>{}}){
   if(!String(message??'').trim())throw new Error('问题不能为空');
   const response=await fetcher(BASE+'/answer',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({question:String(message).trim(),history,asOf,orderId})});
   if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.error?.message||`AI服务返回HTTP ${response.status}`);}
   if(!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('AI服务返回了无效的对话响应');
   if(!response.body)throw new Error('AI没有返回内容');
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',full='',failure='',completed=false;
   const handle=line=>{
    if(!line.trim().startsWith('data:'))return;
    const payload=line.trim().slice(5).trim();if(payload==='[DONE]'){completed=true;return;}
    let obj;try{obj=JSON.parse(payload);}catch{return;}
    if(obj.type==='delta'&&typeof obj.data?.text==='string'){full+=obj.data.text;onDelta(obj.data.text);}
    else if(obj.type==='error')failure=obj.data?.message||'AI输出中断';
    else if(obj.type==='done'){completed=true;if(obj.data?.finish_reason==='error')failure||='AI输出中断';}
   };
   try{
    for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';for(const line of lines)handle(line);}
    buffer+=decoder.decode();if(buffer.trim())handle(buffer);
    if(failure)throw new Error(failure);
    if(!completed)throw new Error('AI输出中断，回答未完成，请重试');
    if(!full)throw new Error('AI没有返回正文，请检查模型是否加载成功');
    return full;
   }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
 };
}
