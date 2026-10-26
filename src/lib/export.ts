import type { LayoutResult, Project } from '../types';
import { multiPolygonPath } from './geometry';
import { formatNumber, MATERIAL_COLORS } from './project';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function svgDimensions(result:LayoutResult,scale:number) {
  return {width:result.bounds.width/scale+18,height:result.bounds.height/scale+18};
}
export function createPlanSvg(project:Project,result:LayoutResult,scale=25):string {
  const b=result.bounds,margin=scale*9,font=scale*2.8,size=svgDimensions(result,scale);
  const colors=MATERIAL_COLORS[project.material.color];
  const start=result.start, first=start?result.pieces.find(piece=>piece.id===start.pieceId):undefined;
  const labelOnLeft=!!start&&start.point.x>(b.minX+b.maxX)/2;
  const startMarkup=start&&first?`<g aria-label="Startfliese 1: ${escape(start.label)}"><path d="${multiPolygonPath(first.polygons)}" fill="none" stroke="#245d4a" stroke-width="${scale*.5}"/><circle cx="${start.point.x}" cy="${start.point.y}" r="${scale*2.8}" fill="#245d4a" stroke="white" stroke-width="${scale*.25}"/><text x="${start.point.x}" y="${start.point.y}" text-anchor="middle" dominant-baseline="central" font-family="Arial,sans-serif" font-size="${font}" fill="white">1</text><text x="${start.point.x+scale*3.8*(labelOnLeft?-1:1)}" y="${start.point.y}" text-anchor="${labelOnLeft?'end':'start'}" dominant-baseline="central" font-family="Arial,sans-serif" font-size="${font}" fill="#245d4a" stroke="white" stroke-width="${scale*.7}" paint-order="stroke">Start</text></g>`:'';
  const outline=result.roomPolygon.map(p=>`${p.x},${p.y}`).join(' ');
  const winding=Math.sign(result.roomPolygon.reduce((sum,p,i)=>{const next=result.roomPolygon[(i+1)%result.roomPolygon.length];return sum+p.x*next.y-next.x*p.y;},0))||1;
  const dim=result.roomPolygon.map((a,i)=>{
    const z=result.roomPolygon[(i+1)%result.roomPolygon.length],dx=z.x-a.x,dy=z.y-a.y,len=Math.hypot(dx,dy),gap=scale*4;
    const nx=winding*dy/len*gap,ny=-winding*dx/len*gap,ax=a.x+nx,ay=a.y+ny,zx=z.x+nx,zy=z.y+ny,mx=(ax+zx)/2,my=(ay+zy)/2;
    let angle=Math.atan2(dy,dx)*180/Math.PI;if(angle>90)angle-=180;if(angle< -90)angle+=180;
    return `<path d="M${a.x+nx*.6},${a.y+ny*.6}L${a.x+nx*1.3},${a.y+ny*1.3} M${z.x+nx*.6},${z.y+ny*.6}L${z.x+nx*1.3},${z.y+ny*1.3} M${ax},${ay}L${zx},${zy}" fill="none" stroke="#526258" stroke-width="${scale*.15}"/><text x="${mx}" y="${my}" transform="rotate(${angle} ${mx} ${my})" text-anchor="middle" dominant-baseline="central" fill="#263630" stroke="white" stroke-width="${scale*1.2}" paint-order="stroke">${formatNumber(len/10)} cm</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}mm" height="${size.height}mm" viewBox="${b.minX-margin} ${b.minY-margin} ${b.width+2*margin} ${b.height+2*margin}" role="img" aria-label="${escape(project.name)}"><title>${escape(project.name)} · Maßstab 1:${scale}</title><desc>Alle Geometriemaße in mm. Beim Drucken 100 Prozent einstellen. Produkt ${project.material.width} × ${project.material.height} mm. Fuge ${project.material.grout} mm. Randabstand ${project.material.edgeGap} mm.${start?` Startfliese 1: ${escape(start.label)}.`:''}</desc><rect x="${b.minX-margin}" y="${b.minY-margin}" width="${b.width+margin*2}" height="${b.height+margin*2}" fill="white"/><polygon points="${outline}" fill="#d9ddd6"/><path d="${multiPolygonPath(result.usablePolygons)}" fill="white" fill-rule="evenodd"/>${result.pieces.map((p,i)=>`<path d="${multiPolygonPath(p.polygons)}" fill="${colors[i%colors.length]}" fill-rule="evenodd"/>`).join('')}<polygon points="${outline}" fill="none" stroke="#263630" stroke-width="${scale*.25}"/>${startMarkup}<g font-family="Arial,sans-serif" font-size="${font}">${dim}</g></svg>`;
}
export function createCutCsv(result:LayoutResult):string {
  const n=(v:number)=>v.toFixed(2).replace('.',',');
  const rows=[['Element','Typ','Hüllmaß Länge (mm)','Hüllmaß Breite (mm)','Verlegte Fläche (mm²)','Teilflächen','Konturpunkte (mm)','Startfliese']];
  result.pieces.forEach((p,i)=>rows.push([String(i+1),p.cut?'Zuschnitt':'Ganz',n(p.width),n(p.height),n(p.area),String(p.polygons.length),JSON.stringify(p.polygons),p.id===result.start?.pieceId?'Ja':'']));
  return '\uFEFF'+rows.map(row=>row.map(cell=>`"${cell.replace(/"/g,'""')}"`).join(';')).join('\r\n');
}
