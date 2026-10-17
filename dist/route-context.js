export function orderRoute(page,scope){
 if(!scope?.orderId)return '#'+page;
 const q=new URLSearchParams(Object.entries({asOf:scope.asOf,revision:scope.revision,baselineMode:scope.baselineMode,knownAt:scope.knownAt}).filter(([,v])=>v));
 return '#'+page+'/'+encodeURIComponent(scope.orderId)+(q.size?'?'+q:'');
}
