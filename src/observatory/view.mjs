export const wrap=x=>((x%50)+50)%50;
export const delta=(a,b)=>wrap(b-a+25)-25;
export const lerp=(a,b,t)=>wrap(a+delta(a,b)*Math.max(0,Math.min(1,t)));
export function project(x,y,c){return [(delta(c.x,x)+c.span/2)/c.span,(delta(c.y,y)+c.span/2)/c.span];}
export function unproject(x,y,c){return [wrap(c.x+(x-.5)*c.span),wrap(c.y+(y-.5)*c.span)];}
