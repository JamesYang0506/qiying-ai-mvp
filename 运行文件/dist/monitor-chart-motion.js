// Play only after a successful data refresh. Static markup is always the final frame.
const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function trendMotion(root,scope,play){
 for(const layer of root.querySelectorAll(`${scope} .trend-reveal-layer,${scope} .trend-area-layer`)){
  play(layer,[{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)'}],{duration:1200,easing:'linear'});
 }
 for(const point of root.querySelectorAll(`${scope} .chart-point,${scope} .trend-expected-point`)){
  const x=Number(point.querySelector('circle')?.getAttribute('cx')??64);
  play(point,[{opacity:0},{opacity:1}],{duration:160,delay:Math.max(0,Math.min(1040,(x-64)/(800-64-25)*1040)),easing:'ease-out',fill:'backwards'});
 }
}
export function animateMonitorCharts(root){
 if(reduced())return ()=>{};
 const animations=[];
 const play=(element,frames,options)=>{if(typeof element?.animate==='function')animations.push(element.animate(frames,options));};
 trendMotion(root,'.bm-trend',play);
 const ring=root.querySelector('.bm-donut-ring');
 const segments=[...root.querySelectorAll('.bm-donut-segment')].filter(s=>Number(s.getAttribute('stroke-dasharray')?.split(' ')[0])>0);
 if(segments.length){
  play(ring,[{transform:'rotate(-150deg) scale(.94)',opacity:.25},{transform:'rotate(0deg) scale(1)',opacity:1}],{duration:1200,easing:'linear'});
  for(const segment of segments)play(segment,[{strokeDasharray:'0 408.407'},{strokeDasharray:segment.getAttribute('stroke-dasharray')}],{duration:1200,easing:'linear'});
 }
 return ()=>animations.forEach(animation=>animation.cancel());
}
export function animateAnalysisCharts(root){
 if(reduced())return ()=>{};
 const animations=[];
 const play=(element,frames,options)=>{if(typeof element?.animate==='function')animations.push(element.animate(frames,options));};
 trendMotion(root,'.overview-charts',play);
 const arcs=[...root.querySelectorAll('.overview-charts .donut-arc')].filter(arc=>Number(arc.getAttribute('stroke-dasharray')?.split(' ')[0])>0);
 if(arcs.length){
  play(root.querySelector('.overview-charts .donut'),[{transform:'scale(.94)',opacity:.25},{transform:'scale(1)',opacity:1}],{duration:1200,easing:'linear'});
  for(const arc of arcs){
   const [length,rest]=arc.getAttribute('stroke-dasharray').split(' ').map(Number);
   play(arc,[{strokeDasharray:`0 ${length+rest}`},{strokeDasharray:arc.getAttribute('stroke-dasharray')}],{duration:1200,easing:'linear'});
  }
 }
 return ()=>animations.forEach(animation=>animation.cancel());
}
