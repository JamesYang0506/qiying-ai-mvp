// Play only after a successful data refresh. Static markup is always the final frame.
export function animateMonitorCharts(root){
 if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return ()=>{};
 const animations=[];
 const play=(element,frames,options)=>{if(typeof element?.animate==='function')animations.push(element.animate(frames,options));};
 for(const layer of root.querySelectorAll('.bm-trend .trend-reveal-layer,.bm-trend .trend-area-layer')){
  play(layer,[{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)'}],{duration:1200,easing:'linear'});
 }
 for(const point of root.querySelectorAll('.bm-trend .chart-point,.bm-trend .trend-expected-point')){
  const x=Number(point.querySelector('circle')?.getAttribute('cx')??64);
  play(point,[{opacity:0},{opacity:1}],{duration:160,delay:Math.max(0,Math.min(1040,(x-64)/(800-64-25)*1040)),easing:'ease-out',fill:'backwards'});
 }
 const ring=root.querySelector('.bm-donut-ring');
 const segments=[...root.querySelectorAll('.bm-donut-segment')].filter(s=>Number(s.getAttribute('stroke-dasharray')?.split(' ')[0])>0);
 if(segments.length){
  play(ring,[{transform:'rotate(-150deg) scale(.94)',opacity:.25},{transform:'rotate(0deg) scale(1)',opacity:1}],{duration:1050,easing:'cubic-bezier(.22,.7,.25,1)'});
  for(const segment of segments)play(segment,[{strokeDasharray:'0 408.407'},{strokeDasharray:segment.getAttribute('stroke-dasharray')}],{duration:1000,easing:'cubic-bezier(.22,.7,.25,1)'});
 }
 return ()=>animations.forEach(animation=>animation.cancel());
}
