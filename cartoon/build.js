// Builds the one-page cartoon as HTML (inline SVG) and renders it to PNG.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const K = '#111';            // ink
const SKIN = '#f8c79b';
const S = 5;                 // outline width

// ---------- helpers ----------
const line = (x1,y1,x2,y2,w,c) =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${K}" stroke-width="${w+2*S}" stroke-linecap="round" fill="none"/>
   <path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
const limb = (pts,w,c) => {
  const d = 'M' + pts.map(p=>p.join(' ')).join(' L');
  return `<path d="${d}" stroke="${K}" stroke-width="${w+2*S}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
};
const hand = (x,y,r=11) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${SKIN}" stroke="${K}" stroke-width="${S-1}"/>`;

function bubble(x,y,w,h,html,tx,ty,{think=false,font=24,shout=false}={}) {
  let s = '';
  const cx = x + w/2, cy = y + h/2;
  if (think) {
    s += `<circle cx="${tx}" cy="${ty}" r="7" fill="#fff" stroke="${K}" stroke-width="3.5"/>`;
    s += `<circle cx="${(tx*2+cx)/3}" cy="${(ty*2+cy)/3 + 10}" r="12" fill="#fff" stroke="${K}" stroke-width="3.5"/>`;
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${w/2+18}" ry="${h/2+16}" fill="#fff" stroke="${K}" stroke-width="4" stroke-dasharray="1 0"/>`;
  } else if (shout) {
    // spiky burst
    const n = 18, pts = [];
    for (let i=0;i<n*2;i++){
      const a = i*Math.PI/n, r = i%2? 0.82:1.08;
      pts.push([cx + Math.cos(a)*(w/2+26)*r, cy + Math.sin(a)*(h/2+24)*r]);
    }
    s += `<path d="M${tx} ${ty} L${cx-20} ${cy+h/4} L${cx+10} ${cy+h/4} Z" fill="#fff" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`;
    s += `<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="#fff" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`;
  } else {
    const bx = Math.max(x+20, Math.min(x+w-50, tx<x? x+20 : tx>x+w? x+w-50 : tx-15));
    const by = ty > y ? y+h-2 : y+2;
    s += `<path d="M${bx} ${by} L${tx} ${ty} L${bx+34} ${by}" fill="#fff" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(h/2,40)}" fill="#fff" stroke="${K}" stroke-width="4"/>`;
    s += `<path d="M${bx+3} ${by} L${bx+31} ${by}" stroke="#fff" stroke-width="6"/>`;
  }
  s += `<foreignObject x="${x+8}" y="${y}" width="${w-16}" height="${h}">
          <div xmlns="http://www.w3.org/1999/xhtml" class="bub" style="font-size:${font}px;height:${h}px"><span>${html}</span></div>
        </foreignObject>`;
  return s;
}
function caption(x,y,w,h,html,{bg='#ffe14d',font=22}={}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}" stroke="${K}" stroke-width="4"/>
  <foreignObject x="${x+6}" y="${y}" width="${w-12}" height="${h}">
    <div xmlns="http://www.w3.org/1999/xhtml" class="cap" style="font-size:${font}px;height:${h}px"><span>${html}</span></div>
  </foreignObject>`;
}
function sfx(x,y,text,{size=60,fill='#ffdd00',rot=-8}={}) {
  return `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" class="sfx" font-size="${size}"
     fill="${fill}" stroke="${K}" stroke-width="${size/9}" paint-order="stroke" text-anchor="middle">${text}</text>`;
}

// ---------- characters ----------
// AJ: spiky ginger-brown hair, yellow jumper with green £ sign. Origin = feet centre.
function AJ(x,y,s=1,o={}) {
  const jumper = '#ffd21f', trousers = '#2d4fb3';
  const {arms='down', mouth='grin', sit=false, old=false, eyes='front', flip=false} = o;
  let g = '';
  // legs
  if (sit) {
    g += limb([[-14,-92],[45,-80],[70,-20]],22,trousers);
    g += limb([[14,-92],[75,-85],[100,-25]],22,trousers);
    g += `<ellipse cx="80" cy="-12" rx="24" ry="11" fill="#222" stroke="${K}" stroke-width="${S}"/>`;
    g += `<ellipse cx="112" cy="-17" rx="24" ry="11" fill="#222" stroke="${K}" stroke-width="${S}"/>`;
  } else {
    g += limb([[-16,-92],[-20,-14]],24,trousers);
    g += limb([[16,-92],[20,-14]],24,trousers);
    g += `<ellipse cx="-28" cy="-8" rx="26" ry="12" fill="#222" stroke="${K}" stroke-width="${S}"/>`;
    g += `<ellipse cx="28" cy="-8" rx="26" ry="12" fill="#222" stroke="${K}" stroke-width="${S}"/>`;
  }
  // arms behind torso handled after torso for simplicity
  // torso
  g += `<path d="M-46 -95 Q-52 -150 -36 -178 L36 -178 Q52 -150 46 -95 Z" fill="${jumper}" stroke="${K}" stroke-width="${S}" stroke-linejoin="round"/>`;
  g += `<path d="M-46 -104 L46 -104" stroke="${K}" stroke-width="3"/>`;
  g += `<text x="0" y="-122" text-anchor="middle" class="sfx" font-size="44" fill="#1a9c3c" stroke="${K}" stroke-width="3" paint-order="stroke">£</text>`;
  // arms
  const A = {
    down:   [[[-38,-168],[-62,-130],[-60,-95]], [[38,-168],[62,-130],[60,-95]]],
    up:     [[[-38,-168],[-75,-200],[-85,-245]], [[38,-168],[75,-200],[85,-245]]],
    point:  [[[-38,-168],[-62,-130],[-60,-95]], [[38,-168],[90,-185],[135,-210]]],
    hips:   [[[-38,-168],[-80,-140],[-46,-110]], [[38,-168],[80,-140],[46,-110]]],
    hold:   [[[-38,-168],[-70,-150],[-40,-190]], [[38,-168],[70,-150],[40,-190]]],
    shrug:  [[[-38,-168],[-80,-150],[-95,-185]], [[38,-168],[80,-150],[95,-185]]],
    binos:  [[[-38,-168],[-55,-200],[-22,-232]], [[38,-168],[55,-200],[22,-232]]],
    type:   [[[-38,-168],[-30,-120],[20,-118]], [[38,-168],[70,-130],[95,-128]]],
  }[arms];
  g += limb(A[0],22,jumper) + limb(A[1],22,jumper);
  g += hand(...A[0][2]) + hand(...A[1][2]);
  // head
  const hy = -228;
  g += `<circle cx="-50" cy="${hy+4}" r="13" fill="${SKIN}" stroke="${K}" stroke-width="${S-1}"/>`;
  g += `<circle cx="50" cy="${hy+4}" r="13" fill="${SKIN}" stroke="${K}" stroke-width="${S-1}"/>`;
  // hair (spiky) or old-man bald + white tufts
  if (!old) {
    g += `<path d="M-50 ${hy-5} L-62 ${hy-40} L-38 ${hy-38} L-40 ${hy-78} L-14 ${hy-52} L-2 ${hy-92} L14 ${hy-54} L40 ${hy-80} L38 ${hy-40} L64 ${hy-42} L50 ${hy-5} Z" fill="#c4561b" stroke="${K}" stroke-width="${S}" stroke-linejoin="round"/>`;
  }
  g += `<ellipse cx="0" cy="${hy}" rx="50" ry="52" fill="${SKIN}" stroke="${K}" stroke-width="${S}"/>`;
  if (!old) {
    g += `<path d="M-48 ${hy-14} Q-40 ${hy-50} -10 ${hy-50} L-18 ${hy-32} L0 ${hy-48} L8 ${hy-30} L24 ${hy-48} L26 ${hy-28} Q40 ${hy-40} 48 ${hy-14} Q50 ${hy-56} 0 ${hy-56} Q-50 ${hy-56} -48 ${hy-14} Z" fill="#c4561b" stroke="${K}" stroke-width="${S-1}" stroke-linejoin="round"/>`;
  } else {
    g += `<path d="M-50 ${hy-10} q-14 -10 -6 -26 q6 8 14 6 M50 ${hy-10} q14 -10 6 -26 q-6 8 -14 6" fill="#fff" stroke="${K}" stroke-width="3"/>`;
    g += `<path d="M-20 ${hy-44} q-6 -20 8 -26 M6 ${hy-48} q4 -22 16 -20" fill="none" stroke="${K}" stroke-width="3"/>`;
  }
  // eyes
  const ex = eyes==='side'? 6 : 0, ey = eyes==='up'? -5 : 0;
  g += `<ellipse cx="-17" cy="${hy-10}" rx="13" ry="16" fill="#fff" stroke="${K}" stroke-width="3.5"/>`;
  g += `<ellipse cx="17" cy="${hy-10}" rx="13" ry="16" fill="#fff" stroke="${K}" stroke-width="3.5"/>`;
  if (eyes==='closed') {
    g += `<path d="M-28 ${hy-8} q11 8 22 0 M6 ${hy-8} q11 8 22 0" stroke="${K}" stroke-width="4" fill="none"/>`;
  } else {
    g += `<circle cx="${-14+ex}" cy="${hy-6+ey}" r="6" fill="${K}"/><circle cx="${20+ex}" cy="${hy-6+ey}" r="6" fill="${K}"/>`;
  }
  // brows
  g += o.sly
    ? `<path d="M-32 ${hy-34} L-4 ${hy-24} M4 ${hy-24} L32 ${hy-34}" stroke="${K}" stroke-width="5" stroke-linecap="round"/>`
    : `<path d="M-30 ${hy-34} Q-17 ${hy-42} -4 ${hy-34} M4 ${hy-34} Q17 ${hy-42} 30 ${hy-34}" stroke="${K}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  // nose
  g += `<ellipse cx="0" cy="${hy+10}" rx="14" ry="11" fill="#f2a27a" stroke="${K}" stroke-width="3.5"/>`;
  // freckles
  g += old ? '' : `<g fill="#c4561b"><circle cx="-28" cy="${hy+12}" r="2.5"/><circle cx="-34" cy="${hy+6}" r="2.5"/><circle cx="28" cy="${hy+12}" r="2.5"/><circle cx="34" cy="${hy+6}" r="2.5"/></g>`;
  // mouth
  const M = {
    grin: `<path d="M-26 ${hy+24} Q0 ${hy+56} 26 ${hy+24} Z" fill="#7a1b1b" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M-22 ${hy+27} L22 ${hy+27} L18 ${hy+33} L-18 ${hy+33} Z" fill="#fff"/>`,
    smug: `<path d="M-20 ${hy+30} Q4 ${hy+42} 26 ${hy+24}" stroke="${K}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    open: `<ellipse cx="0" cy="${hy+34}" rx="12" ry="10" fill="#7a1b1b" stroke="${K}" stroke-width="4"/>`,
    flat: `<path d="M-14 ${hy+32} L14 ${hy+32}" stroke="${K}" stroke-width="5" stroke-linecap="round"/>`,
  }[mouth];
  g += M;
  if (old) {
    // long white beard over everything below the nose
    g += `<path d="M-46 ${hy+10} Q-50 ${hy+60} -30 ${hy+110} Q-16 ${hy+170} 0 ${hy+200} Q16 ${hy+170} 30 ${hy+110} Q50 ${hy+60} 46 ${hy+10} Q30 ${hy+30} 14 ${hy+22} Q0 ${hy+30} -14 ${hy+22} Q-30 ${hy+30} -46 ${hy+10} Z" fill="#fafafa" stroke="${K}" stroke-width="4" stroke-linejoin="round"/>`;
    g += `<path d="M-20 ${hy+60} q6 20 0 40 M0 ${hy+70} q6 30 0 60 M20 ${hy+60} q-6 20 0 40" stroke="#bbb" stroke-width="3" fill="none"/>`;
    g += `<path d="M-30 ${hy-26} L30 ${hy-26}" stroke="#fff" stroke-width="0"/>`;
    g += `<rect x="-36" y="${hy-22}" width="30" height="22" rx="8" fill="none" stroke="${K}" stroke-width="3.5"/><rect x="6" y="${hy-22}" width="30" height="22" rx="8" fill="none" stroke="${K}" stroke-width="3.5"/><path d="M-6 ${hy-12} L6 ${hy-12}" stroke="${K}" stroke-width="3.5"/>`;
  }
  return `<g transform="translate(${x} ${y}) scale(${flip?-s:s} ${s})">${g}</g>`;
}

// Spud: round, blue jumper, red bobble hat
function Spud(x,y,s=1,o={}) {
  const jumper = '#2fa3e6', trousers = '#5a3b1f';
  const {arms='down', mouth='open', flip=false, kid=false} = o;
  let g = '';
  g += limb([[-18,-80],[-22,-14]],26,trousers) + limb([[18,-80],[22,-14]],26,trousers);
  g += `<ellipse cx="-30" cy="-8" rx="26" ry="12" fill="#6b2a10" stroke="${K}" stroke-width="${S}"/>`;
  g += `<ellipse cx="30" cy="-8" rx="26" ry="12" fill="#6b2a10" stroke="${K}" stroke-width="${S}"/>`;
  g += `<ellipse cx="0" cy="-125" rx="62" ry="62" fill="${jumper}" stroke="${K}" stroke-width="${S}"/>`;
  g += `<path d="M-58 -105 Q0 -90 58 -105" stroke="${K}" stroke-width="3" fill="none"/><path d="M-60 -140 Q0 -125 60 -140" stroke="#fff" stroke-width="7" fill="none"/>`;
  const A = {
    down:  [[[-48,-160],[-80,-120],[-78,-90]], [[48,-160],[80,-120],[78,-90]]],
    up:    [[[-48,-160],[-90,-190],[-100,-235]], [[48,-160],[90,-190],[100,-235]]],
    scratch:[[[-48,-160],[-80,-120],[-78,-90]], [[48,-160],[85,-200],[40,-262]]],
    point: [[[-48,-160],[-80,-120],[-78,-90]], [[48,-160],[100,-170],[140,-180]]],
    shrug: [[[-48,-160],[-90,-150],[-105,-185]], [[48,-160],[90,-150],[105,-185]]],
  }[arms];
  g += limb(A[0],22,jumper) + limb(A[1],22,jumper) + hand(...A[0][2]) + hand(...A[1][2]);
  const hy = -228;
  g += `<circle cx="-46" cy="${hy+6}" r="12" fill="${SKIN}" stroke="${K}" stroke-width="${S-1}"/><circle cx="46" cy="${hy+6}" r="12" fill="${SKIN}" stroke="${K}" stroke-width="${S-1}"/>`;
  g += `<ellipse cx="0" cy="${hy+4}" rx="48" ry="46" fill="${SKIN}" stroke="${K}" stroke-width="${S}"/>`;
  // bobble hat
  g += `<path d="M-50 ${hy-6} Q-50 ${hy-70} 0 ${hy-72} Q50 ${hy-70} 50 ${hy-6} Z" fill="#e3262b" stroke="${K}" stroke-width="${S}"/>`;
  g += `<rect x="-54" y="${hy-18}" width="108" height="18" rx="8" fill="#fff" stroke="${K}" stroke-width="4"/>`;
  g += `<circle cx="0" cy="${hy-78}" r="15" fill="#fff" stroke="${K}" stroke-width="4"/>`;
  // eyes
  g += `<ellipse cx="-16" cy="${hy+8}" rx="11" ry="14" fill="#fff" stroke="${K}" stroke-width="3.5"/><ellipse cx="16" cy="${hy+8}" rx="11" ry="14" fill="#fff" stroke="${K}" stroke-width="3.5"/>`;
  g += `<circle cx="-14" cy="${hy+10}" r="5.5" fill="${K}"/><circle cx="18" cy="${hy+10}" r="5.5" fill="${K}"/>`;
  g += `<ellipse cx="0" cy="${hy+24}" rx="10" ry="8" fill="#f2a27a" stroke="${K}" stroke-width="3"/>`;
  g += `<g fill="#b5651d"><circle cx="-26" cy="${hy+24}" r="2.5"/><circle cx="-32" cy="${hy+19}" r="2.5"/><circle cx="26" cy="${hy+24}" r="2.5"/><circle cx="32" cy="${hy+19}" r="2.5"/></g>`;
  g += {
    open: `<ellipse cx="0" cy="${hy+38}" rx="13" ry="9" fill="#7a1b1b" stroke="${K}" stroke-width="4"/>`,
    wide: `<ellipse cx="0" cy="${hy+38}" rx="10" ry="12" fill="#7a1b1b" stroke="${K}" stroke-width="4"/>`,
    grin: `<path d="M-20 ${hy+32} Q0 ${hy+54} 20 ${hy+32} Z" fill="#7a1b1b" stroke="${K}" stroke-width="4"/>`,
    wobbly:`<path d="M-16 ${hy+38} q5 -6 10 0 q5 6 10 0 q5 -6 10 0" stroke="${K}" stroke-width="4" fill="none"/>`,
  }[mouth];
  return `<g transform="translate(${x} ${y}) scale(${flip?-s:s} ${s})">${g}</g>`;
}

// ---------- page ----------
const W = 1200, H = 1720;
const P = [ // panels x,y,w,h
  [30, 290, 560, 450], [610, 290, 560, 450],
  [30, 760, 560, 450], [610, 760, 560, 450],
  [30, 1230, 1140, 440],
];
const clip = (i) => { const [x,y,w,h]=P[i]; return `<clipPath id="c${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`; };
const frame = (i) => { const [x,y,w,h]=P[i]; return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${K}" stroke-width="7"/>`; };
const dots = (id, c1, c2, r=3, gap=12) =>
  `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse"><rect width="${gap}" height="${gap}" fill="${c1}"/><circle cx="${gap/2}" cy="${gap/2}" r="${r}" fill="${c2}"/></pattern>`;

let svg = '';
svg += `<defs>
  ${dots('dRed','#e3262b','#c41418',3.2)}
  ${dots('dBlue','#9fd6f5','#7cc3ec',3)}
  ${dots('dYel','#ffe866','#ffd21f',3)}
  ${dots('dPink','#ffd0c2','#ffb8a5',3)}
  ${dots('dNight','#1d2b6b','#24357f',3)}
  ${dots('dGreen','#9be29b','#7fd27f',3)}
  <radialGradient id="burst" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#fff59a"/><stop offset="1" stop-color="#ffb000"/></radialGradient>
  ${[0,1,2,3,4].map(clip).join('')}
</defs>`;

// paper background
svg += `<rect width="${W}" height="${H}" fill="#fffdf4"/>`;

// ===== TITLE BANNER =====
svg += `<rect x="30" y="30" width="1140" height="240" fill="url(#dRed)" stroke="${K}" stroke-width="7"/>`;
// starburst behind title
{
  let pts=[]; const cx=600, cy=150, n=28;
  for(let i=0;i<n*2;i++){const a=i*Math.PI/n, r=i%2?260:560; pts.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r*0.32]);}
  svg += `<g clip-path="url(#tclip)"><clipPath id="tclip"><rect x="34" y="34" width="1132" height="232"/></clipPath><polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="#ff4a3d" opacity="0.6"/></g>`;
}
svg += `<text x="600" y="128" text-anchor="middle" class="title" font-size="104" fill="#ffdd00" stroke="${K}" stroke-width="14" paint-order="stroke" transform="rotate(-2 600 128)">AJ THE INVESTOR</text>`;
svg += `<text x="600" y="128" text-anchor="middle" class="title" font-size="104" fill="none" stroke="#fff" stroke-width="2" transform="rotate(-2 600 128) translate(-3 -3)" opacity="0.6">AJ THE INVESTOR</text>`;
svg += `<g transform="rotate(-2 600 200)"><rect x="235" y="165" width="730" height="66" fill="#fff" stroke="${K}" stroke-width="5"/>
  <text x="600" y="211" text-anchor="middle" class="title" font-size="40" fill="${K}">in &#8220;THIRD TIME&#8217;S THE CHARM!&#8221;</text></g>`;
// price tag / issue badge
svg += `<g transform="rotate(10 1080 95)"><circle cx="1080" cy="95" r="58" fill="#ffdd00" stroke="${K}" stroke-width="5"/>
  <text x="1080" y="88" text-anchor="middle" class="title" font-size="26">ONLY</text>
  <text x="1080" y="122" text-anchor="middle" class="title" font-size="38">£4.50</text></g>`;
svg += `<g transform="rotate(-10 130 100)"><rect x="55" y="60" width="160" height="82" fill="#fff" stroke="${K}" stroke-width="5"/>
  <text x="135" y="94" text-anchor="middle" class="title" font-size="24">NOT FINANCIAL</text>
  <text x="135" y="126" text-anchor="middle" class="title" font-size="24">ADVICE!</text></g>`;
svg += AJ(1065, 268, 0.42, {arms:'up', mouth:'grin', sly:true});

// ===== PANEL 1: the chart is mooning =====
{
  const [x,y,w,h]=P[0];
  let p = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#dBlue)"/>`;
  // wall poster & window
  p += `<rect x="${x+262}" y="${y+100}" width="120" height="84" fill="#fff" stroke="${K}" stroke-width="4"/>
        <text x="${x+322}" y="${y+128}" text-anchor="middle" class="title" font-size="20">BUY LOW</text>
        <text x="${x+322}" y="${y+152}" text-anchor="middle" class="title" font-size="20">SELL HIGH</text>
        <text x="${x+322}" y="${y+174}" text-anchor="middle" class="cap2" font-size="14">(eventually)</text>`;
  // floor
  p += `<rect x="${x}" y="${y+380}" width="${w}" height="70" fill="#c98a4b" stroke="${K}" stroke-width="4"/>`;
  // desk
  p += `<rect x="${x+170}" y="${y+300}" width="220" height="20" fill="#8a5a2b" stroke="${K}" stroke-width="4"/>
        <rect x="${x+180}" y="${y+318}" width="16" height="70" fill="#8a5a2b" stroke="${K}" stroke-width="4"/>
        <rect x="${x+364}" y="${y+318}" width="16" height="70" fill="#8a5a2b" stroke="${K}" stroke-width="4"/>`;
  // laptop with rocketing chart
  p += `<path d="M${x+215} ${y+300} L${x+345} ${y+300} L${x+355} ${y+290} L${x+205} ${y+290} Z" fill="#999" stroke="${K}" stroke-width="4"/>
        <rect x="${x+215}" y="${y+200}" width="135" height="92" rx="4" fill="#222" stroke="${K}" stroke-width="4"/>
        <rect x="${x+222}" y="${y+207}" width="121" height="78" fill="#0d1f0d"/>
        <path d="M${x+226} ${y+275} L${x+250} ${y+268} L${x+266} ${y+272} L${x+285} ${y+252} L${x+300} ${y+258} L${x+318} ${y+228} L${x+338} ${y+212}" stroke="#3cff5a" stroke-width="4" fill="none"/>
        <path d="M${x+328} ${y+212} L${x+340} ${y+210} L${x+336} ${y+222}" stroke="#3cff5a" stroke-width="4" fill="none"/>
        <text x="${x+232}" y="${y+224}" class="cap2" font-size="13" fill="#3cff5a">NVDA</text>`;
  p += AJ(x+130, y+392, 0.95, {arms:'down', mouth:'smug', eyes:'side', sly:true});
  // door & Spud
  p += `<rect x="${x+430}" y="${y+240}" width="120" height="150" fill="#6b3e18" stroke="${K}" stroke-width="4"/>`;
  p += Spud(x+480, y+410, 0.78, {arms:'up', mouth:'wide', flip:true});
  p += sfx(x+500, y+232, 'BURST!', {size:38, rot:12});
  p += caption(x, y, 330, 70, '<span>Meet AJ &#8212; the most <b>PATIENT</b> investor in Britain!</span>', {font:21});
  p += bubble(x+330, y+20, 220, 80, 'Oi, AJ! Nvidia&#8217;s gone to the MOON!', x+470, y+150, {font:21});
  p += bubble(x+20, y+96, 230, 64, 'I know, Spud. I&#8217;m waiting.', x+120, y+150, {font:21});
  svg += `<g clip-path="url(#c0)">${p}</g>` + frame(0);
}

// ===== PANEL 2: the newspaper =====
{
  const [x,y,w,h]=P[1];
  let p = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#dYel)"/>`;
  // speed lines
  for (let i=0;i<24;i++){ const a=i*Math.PI/12; p += `<path d="M${x+280} ${y+250} L${x+280+Math.cos(a)*600} ${y+250+Math.sin(a)*600}" stroke="#ffbf00" stroke-width="14"/>`; }
  // newspaper
  p += `<g transform="rotate(-4 ${x+260} ${y+260})">
    <rect x="${x+90}" y="${y+150}" width="340" height="230" fill="#f4f1e6" stroke="${K}" stroke-width="5"/>
    <text x="${x+260}" y="${y+180}" text-anchor="middle" class="news" font-size="22">THE DAILY GOSSIP</text>
    <path d="M${x+100} ${y+190} L${x+420} ${y+190}" stroke="${K}" stroke-width="3"/>
    <text x="${x+260}" y="${y+232}" text-anchor="middle" class="title" font-size="40">CHIP BOSS</text>
    <text x="${x+260}" y="${y+274}" text-anchor="middle" class="title" font-size="40" fill="#d11">ADMITS AFFAIR!</text>
    <rect x="${x+105}" y="${y+290}" width="90" height="78" fill="#ccc" stroke="${K}" stroke-width="3"/>
    <path d="M${x+120} ${y+368} Q${x+150} ${y+320} ${x+180} ${y+368} Z" fill="#222"/><circle cx="${x+150}" cy="${y+318}" r="16" fill="${SKIN}" stroke="${K}" stroke-width="2"/>
    <path d="M${x+134} ${y+312} Q${x+150} ${y+292} ${x+166} ${y+312}" fill="#777"/>
    ${[0,1,2,3,4,5].map(i=>`<path d="M${x+210} ${y+300+i*12} L${x+415} ${y+300+i*12}" stroke="#888" stroke-width="4"/>`).join('')}
  </g>`;
  // hands holding paper
  p += hand(x+92, y+275, 16) + hand(x+430, y+245, 16);
  // AJ's eyes peeking over top
  p += `<g transform="translate(${x+260} ${y+150})">
     <path d="M-60 6 Q-62 -60 0 -64 Q62 -60 60 6 Z" fill="${SKIN}" stroke="${K}" stroke-width="5"/>
     <path d="M-58 -30 L-66 -70 L-40 -62 L-36 -100 L-12 -74 L0 -112 L14 -76 L40 -100 L40 -62 L66 -70 L58 -30 Q40 -66 0 -66 Q-40 -66 -58 -30 Z" fill="#c4561b" stroke="${K}" stroke-width="5" stroke-linejoin="round"/>
     <ellipse cx="-18" cy="-20" rx="14" ry="17" fill="#fff" stroke="${K}" stroke-width="3.5"/><ellipse cx="18" cy="-20" rx="14" ry="17" fill="#fff" stroke="${K}" stroke-width="3.5"/>
     <circle cx="-12" cy="-16" r="6" fill="${K}"/><circle cx="24" cy="-16" r="6" fill="${K}"/>
     <path d="M-32 -42 L-6 -34 M6 -34 L32 -42" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
  </g>`;
  p += Spud(x+500, y+470, 0.7, {arms:'point', mouth:'wide', flip:true});
  p += bubble(x+300, y+18, 245, 92, 'Blimey! The boss admitted an AFFAIR! Is THAT your signal?', x+470, y+260, {font:20});
  p += bubble(x+18, y+18, 250, 70, 'Nope! That&#8217;s only number <b>ONE!</b>', x+200, y+92, {font:22});
  svg += `<g clip-path="url(#c1)">${p}</g>` + frame(1);
}

// ===== PANEL 3: the chalkboard system =====
{
  const [x,y,w,h]=P[2];
  let p = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#dGreen)"/>`;
  p += `<rect x="${x+175}" y="${y+76}" width="375" height="270" fill="#244b33" stroke="#7a4b1f" stroke-width="14"/>`;
  p += `<text x="${x+362}" y="${y+118}" text-anchor="middle" class="chalk" font-size="25" fill="#fff">AJ&#8217;S FOOLPROOF SYSTEM</text>
        <path d="M${x+205} ${y+128} L${x+520} ${y+128}" stroke="#fff" stroke-width="3"/>
        <text x="${x+238}" y="${y+170}" class="chalk" font-size="21" fill="#fff">Affair 1 &#8594; WAIT</text>
        <text x="${x+238}" y="${y+212}" class="chalk" font-size="19" fill="#fff">Affair 2 &#8594; WAIT A BIT MORE</text>
        <text x="${x+238}" y="${y+258}" class="chalk" font-size="21" fill="#ffe14d">Affair 3 &#8594; BUY! BUY! BUY!</text>
        <path d="M${x+236} ${y+268} Q${x+390} ${y+286} ${x+535} ${y+264}" stroke="#ffe14d" stroke-width="3" fill="none"/>
        <text x="${x+238}" y="${y+316}" class="chalk" font-size="16" fill="#ccc">(Peer-reviewed by: me)</text>`;
  p += `<rect x="${x}" y="${y+400}" width="${w}" height="50" fill="#b77b40" stroke="${K}" stroke-width="4"/>`;
  p += AJ(x+95, y+430, 0.88, {arms:'point', mouth:'grin', sly:true});
  // pointer stick
  p += `<path d="M${x+212} ${y+245} L${x+232} ${y+252}" stroke="#8a5a2b" stroke-width="7" stroke-linecap="round"/>`;
  p += Spud(x+470, y+460, 0.6, {arms:'scratch', mouth:'wobbly', flip:true});
  p += `<text x="${x+515}" y="${y+290}" class="title" font-size="50" fill="#e3262b" stroke="${K}" stroke-width="3" paint-order="stroke">?!</text>`;
  p += bubble(x+15, y+12, 300, 60, 'Third time&#8217;s the CHARM, Spud!', x+110, y+120, {font:22});
  svg += `<g clip-path="url(#c2)">${p}</g>` + frame(2);
}

// ===== PANEL 4: the stakeout / reality check =====
{
  const [x,y,w,h]=P[3];
  let p = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#dNight)"/>`;
  // stars + moon
  [[60,60],[140,110],[220,40],[330,90],[480,60],[520,150],[260,140]].forEach(([a,b])=> p+=`<path d="M${x+a} ${y+b-8} L${x+a+3} ${y+b-2} L${x+a+9} ${y+b} L${x+a+3} ${y+b+2} L${x+a} ${y+b+8} L${x+a-3} ${y+b+2} L${x+a-9} ${y+b} L${x+a-3} ${y+b-2} Z" fill="#fff6a0"/>`);
  p += `<circle cx="${x+470}" cy="${y+95}" r="38" fill="#fff6c0" stroke="${K}" stroke-width="4"/><circle cx="${x+488}" cy="${y+82}" r="34" fill="#24357f"/>`;
  // HQ building
  p += `<rect x="${x+330}" y="${y+170}" width="230" height="230" fill="#3a3f55" stroke="${K}" stroke-width="5"/>
        <rect x="${x+350}" y="${y+180}" width="190" height="36" fill="#76b900" stroke="${K}" stroke-width="4"/>
        <text x="${x+445}" y="${y+208}" text-anchor="middle" class="title" font-size="26" fill="#fff" stroke="${K}" stroke-width="3" paint-order="stroke">CHIP CO. HQ</text>`;
  for (let r=0;r<4;r++) for (let c=0;c<4;c++) p += `<rect x="${x+352+c*48}" y="${y+232+r*42}" width="32" height="26" fill="${(r+c)%3?'#ffe866':'#1d2b6b'}" stroke="${K}" stroke-width="3"/>`;
  // ground
  p += `<rect x="${x}" y="${y+390}" width="${w}" height="60" fill="#2f6b2f" stroke="${K}" stroke-width="4"/>`;
  // deckchair
  p += `<path d="M${x+60} ${y+400} L${x+150} ${y+290} M${x+160} ${y+400} L${x+90} ${y+310}" stroke="#8a5a2b" stroke-width="9" stroke-linecap="round"/>
        <path d="M${x+75} ${y+320} L${x+150} ${y+290} L${x+185} ${y+370} L${x+120} ${y+385} Z" fill="#e3262b" stroke="${K}" stroke-width="4"/>
        <path d="M${x+95} ${y+313} L${x+160} ${y+375} M${x+118} ${y+303} L${x+172} ${y+372}" stroke="#fff" stroke-width="6"/>`;
  p += AJ(x+115, y+395, 0.72, {arms:'binos', mouth:'flat', sit:true});
  // binoculars over the eyes
  p += `<g transform="translate(${x+115} ${y+395}) scale(0.72)">
     <rect x="-36" y="-258" width="30" height="34" rx="6" fill="#222" stroke="${K}" stroke-width="4"/><rect x="6" y="-258" width="30" height="34" rx="6" fill="#222" stroke="${K}" stroke-width="4"/>
     <circle cx="-21" cy="-258" r="13" fill="#7fd0ff" stroke="${K}" stroke-width="4"/><circle cx="21" cy="-258" r="13" fill="#7fd0ff" stroke="${K}" stroke-width="4"/></g>`;
  // thermos + calendar
  p += `<rect x="${x+215}" y="${y+350}" width="22" height="46" rx="5" fill="#e3262b" stroke="${K}" stroke-width="4"/>`;

  p += caption(x, y, 330, 46, 'DAY 437 OF THE STAKEOUT&#8230;', {font:21});
  p += bubble(x+45, y+70, 200, 92, 'Two&#8230; three&#8230; c&#8217;mon, any minute now&#8230;', x+110, y+200, {think:true, font:19});
  p += Spud(x+290, y+448, 0.5, {arms:'shrug', mouth:'wide'});
  p += bubble(x+300, y+14, 240, 74, 'But AJ&#8230; there&#8217;s only been ONE!', x+300, y+300, {font:20});
  svg += `<g clip-path="url(#c3)">${p}</g>` + frame(3);
}

// ===== PANEL 5: MANY YEARS LATER (wide) =====
{
  const [x,y,w,h]=P[4];
  let p = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#dPink)"/>`;
  // giant chart rocketing through the top of the panel
  p += `<path d="M${x+520} ${y+400} L${x+600} ${y+360} L${x+640} ${y+380} L${x+720} ${y+300} L${x+770} ${y+320} L${x+860} ${y+190} L${x+910} ${y+210} L${x+1020} ${y+30} L${x+1080} ${y-40}"
           stroke="${K}" stroke-width="30" fill="none" stroke-linejoin="round"/>
        <path d="M${x+520} ${y+400} L${x+600} ${y+360} L${x+640} ${y+380} L${x+720} ${y+300} L${x+770} ${y+320} L${x+860} ${y+190} L${x+910} ${y+210} L${x+1020} ${y+30} L${x+1080} ${y-40}"
           stroke="#1fbf3f" stroke-width="18" fill="none" stroke-linejoin="round"/>`;
  p += `<rect x="${x}" y="${y+380}" width="${w}" height="60" fill="#c98a4b" stroke="${K}" stroke-width="4"/>`;
  // cobwebs in corner
  p += `<g stroke="#777" stroke-width="2.5" fill="none">
     <path d="M${x} ${y+150} L${x+150} ${y}"/><path d="M${x} ${y} L${x+110} ${y+110}"/><path d="M${x} ${y+75} L${x+130} ${y+55}"/><path d="M${x+75} ${y} L${x+60} ${y+130}"/>
     <path d="M${x} ${y+40} Q${x+30} ${y+30} ${x+38} ${y}"/><path d="M${x} ${y+85} Q${x+60} ${y+60} ${x+85} ${y}"/><path d="M${x} ${y+125} Q${x+90} ${y+90} ${x+125} ${y}"/></g>`;
  // deckchair, old AJ
  p += `<path d="M${x+170} ${y+395} L${x+270} ${y+260} M${x+290} ${y+395} L${x+200} ${y+280}" stroke="#8a5a2b" stroke-width="10" stroke-linecap="round"/>
        <path d="M${x+185} ${y+295} L${x+270} ${y+260} L${x+310} ${y+360} L${x+240} ${y+380} Z" fill="#e3262b" stroke="${K}" stroke-width="4"/>`;
  p += AJ(x+235, y+390, 0.82, {arms:'down', mouth:'flat', sit:true, old:true, eyes:'side'});
  // cobweb from head to chair
  p += `<path d="M${x+200} ${y+170} L${x+150} ${y+120} M${x+215} ${y+165} L${x+180} ${y+110}" stroke="#888" stroke-width="2"/>`;
  // walking stick
  p += `<path d="M${x+330} ${y+395} L${x+300} ${y+250} q-6 -20 12 -24" stroke="#5a3b1f" stroke-width="8" fill="none" stroke-linecap="round"/>`;
  // grandkid (Spud's grandkid)
  p += Spud(x+430, y+410, 0.62, {arms:'point', mouth:'open', flip:true});
  // ticker sign
  p += `<g transform="rotate(-6 ${x+870} ${y+340})"><rect x="${x+780}" y="${y+300}" width="230" height="70" fill="#111" stroke="#ffdd00" stroke-width="5"/>
        <text x="${x+895}" y="${y+348}" text-anchor="middle" class="title" font-size="38" fill="#3cff5a">NVDA &#9650;&#9650;&#9650;</text></g>`;
  p += sfx(x+1035, y+120, 'WHOOSH!', {size:62, rot:-30});
  p += caption(x, y, 420, 50, '&#8230;MANY, MANY YEARS LATER&#8230;', {font:24});
  p += bubble(x+380, y+40, 300, 96, 'Grandad AJ&#8230; did you EVER buy Nvidia shares?', x+440, y+220, {font:22});
  p += bubble(x+40, y+70, 290, 104, 'Not yet, sonny&#8230; still waiting for number THREE! Any day now&#8230;', x+215, y+190, {font:21});
  svg += `<g clip-path="url(#c4)">${p}</g>` + frame(4);
}

// footer
svg += `<text x="40" y="1702" class="cap2" font-size="17" fill="#333">A satirical cartoon. AJ&#8217;s trading strategy is entirely fictional and deeply unwise.</text>`;
svg += `<text x="1160" y="1704" text-anchor="end" class="title" font-size="30" fill="#e3262b" stroke="${K}" stroke-width="1.5">THE END&#8230; OR IS IT?</text>`;

const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>AJ the Investor</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@700&family=Permanent+Marker&family=Oswald:wght@700&display=block">
<style>
  html,body{margin:0;background:#fffdf4}
  svg{display:block;width:${W}px;height:${H}px}
  .title{font-family:'Bangers',Impact,sans-serif;letter-spacing:2px}
  .sfx{font-family:'Bangers',Impact,sans-serif;letter-spacing:2px}
  .news{font-family:'Oswald',sans-serif;letter-spacing:3px}
  .chalk{font-family:'Permanent Marker',cursive}
  .cap2{font-family:'Comic Neue',sans-serif;font-weight:700}
  .bub,.cap{font-family:'Comic Neue','Comic Sans MS',sans-serif;font-weight:700;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.08;text-transform:uppercase;color:#111;box-sizing:border-box;padding:2px 6px}
  .cap{justify-content:flex-start;text-align:left}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${svg}</svg>
</body></html>`;

const out = path.join(__dirname);
fs.writeFileSync(path.join(out,'aj-the-investor.html'), html);
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({viewport:{width:W,height:H}, deviceScaleFactor: Number(process.env.DSF||1)});
  await pg.goto('file://' + path.join(out,'aj-the-investor.html'));
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForTimeout(500);
  await pg.screenshot({path: process.env.OUT || path.join(out,'aj-the-investor.png')});
  await b.close();
})();
