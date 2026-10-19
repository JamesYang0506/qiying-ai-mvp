export function createImportClient(fetcher=(...args)=>fetch(...args)){
 const prefix='/api/import-v1';let tokenPromise=null;
 async function request(path,opts={}){const r=await fetcher(prefix+path,opts);let data;try{data=await r.json();}catch{throw new Error('本地导入服务未就绪，请重新启动网站后重试');}if(!r.ok){if(r.status===403)tokenPromise=null;throw Object.assign(new Error(data.error?.message||'请求失败'),{status:r.status});}return data;}
 const token=()=>tokenPromise??=(request('/session').then(x=>x.token).catch(e=>{tokenPromise=null;throw e;}));
 const query=x=>new URLSearchParams(Object.entries(x??{}).filter(([,v])=>v!=null&&v!=='')).toString();
 return {
  async previewFiles(costFile,dailyFile){const form=new FormData();form.append('costFile',costFile);form.append('dailyFile',dailyFile);return request('/previews',{method:'POST',headers:{'X-Qiying-Token':await token()},body:form});},
  async commitPreview(id,allowIncomplete=false,digest){return request(`/previews/${encodeURIComponent(id)}/commit`,{method:'POST',headers:{'X-Qiying-Token':await token(),'Content-Type':'application/json'},body:JSON.stringify({digest,allowIncomplete})});},
  getImportedOrders:()=>request('/orders'),getRevisions:id=>request(`/orders/${encodeURIComponent(id)}/revisions`),
  getAnalysis:(id,q,opts={})=>request(`/orders/${encodeURIComponent(id)}/analysis?${query(q)}`,opts),getTrend:(id,q,opts={})=>request(`/orders/${encodeURIComponent(id)}/trend?${query(q)}`,opts),getPortfolio:(q,opts={})=>request(`/portfolio?${query(q)}`,opts),
 };
}
export const importClient=createImportClient();
