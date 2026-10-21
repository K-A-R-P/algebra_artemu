/* lib.js — общее ядро: дроби, парсер, поиск корней, движок графиков, скрин */
const $=(s,r=document)=>r.querySelector(s);
const gcd=(a,b)=>{a=Math.abs(a);b=Math.abs(b);while(b)[a,b]=[b,a%b];return a||1};
const MINUS='−';

/* ---------- числа и дроби ---------- */
function toFr(x,maxD=64,tol=1e-9){if(!isFinite(x))return null;for(let d=1;d<=maxD;d++){const n=Math.round(x*d);if(Math.abs(x-n/d)<tol*Math.max(1,Math.abs(x)))return[n,d]}return null}
const frHTML=(n,d)=>`<span class="fr"><span class="n">${n}</span><span class="d">${d}</span></span>`;
const dec=x=>String(Math.round(x*1e4)/1e4).replace('.',',').replace('-',MINUS);
function num(x){if(typeof x!=='number'||isNaN(x))return'—';if(!isFinite(x))return x>0?'+∞':'−∞';
  const f=toFr(x);if(!f)return dec(x);const[n,d]=f,s=n<0?MINUS:'';return d===1?s+Math.abs(n):s+frHTML(Math.abs(n),d)}
const numT=x=>{const f=toFr(x,12);return f?(f[1]===1?String(f[0]):f[0]+'/'+f[1]).replace('-',MINUS):dec(x)}; // текстовая версия (для canvas/svg)
const snap=(x,tol=1e-8)=>{const f=toFr(x,48,tol);return f?f[0]/f[1]:Math.round(x*1e6)/1e6};
/* текст выражения -> HTML с дробями «числитель над знаменателем» */
function fm(s){
  const P=a=>a.replace(/^\((.*)\)$/,'$1');
  return s.replace(/\(([^()]+)\)\/\(([^()]+)\)/g,(m,a,b)=>frHTML(a,b))
    .replace(/\(([^()\/]+)\/([^()\/]+)\)/g,(m,a,b)=>frHTML(a,b))
    .replace(/([\w.²]+)\/\(([^()]+)\)/g,(m,a,b)=>frHTML(a,b))
    .replace(/\(([^()]+)\)\/([\w.²]+)/g,(m,a,b)=>frHTML(a,b))
    .replace(/([\w.²]+)\/([\w.²]+)/g,(m,a,b)=>frHTML(a,b));
}
const prettyT=s=>s.replace(/\^2/g,'²').replace(/\^3/g,'³').replace(/\^4/g,'⁴').replace(/\*/g,'·').replace(/-/g,MINUS).replace(/\s+/g,' ').trim();
const rt=h=>`<span class="rt"><span class="rs">√</span><span class="rb">${h}</span></span>`;
const ref=n=>n.type==='ParenthesisNode'?ref(n.content):n;
function H(n,c){switch(n.type){
  case'ConstantNode':return String(n.value).replace('.',',');
  case'SymbolNode':return n.name==='pi'?'π':n.name;
  case'ParenthesisNode':{const k=n.content,t=k.type,op=t==='OperatorNode'?k.op:'',inner=['frac','sqrt','sup'].includes(c)?c:'top';
    const atom=t==='ConstantNode'||t==='SymbolNode'||t==='FunctionNode'||(c!=='base'&&(op==='/'||op==='^'));
    if(['frac','sqrt','sup','top'].includes(c)||atom||(c==='sum'&&['*','/','^'].includes(op)))return H(k,inner);return'('+H(k,'top')+')'}
  case'FunctionNode':{const nm=n.fn.name,a=n.args;if(nm==='sqrt')return rt(H(a[0],'sqrt'));if(nm==='abs')return'|'+H(a[0],'top')+'|';
    if(nm==='nthRoot')return`<sup class="idx">${H(a[1],'sup')}</sup>`+rt(H(a[0],'sqrt'));return nm+'('+a.map(x=>H(x,'top')).join('; ')+')'}
  case'OperatorNode':{const a=n.args,f=n.fn;
    if(f==='add')return H(a[0],'sum')+(a[1].fn==='unaryMinus'?' − '+H(a[1].args[0],'sum'):' + '+H(a[1],'sum'));
    if(f==='subtract')return H(a[0],'sum')+' − '+H(a[1],'sum');
    if(f==='unaryMinus')return'−'+H(a[0],'neg');if(f==='unaryPlus')return H(a[0],c);
    if(f==='divide')return frHTML(H(a[0],'frac'),H(a[1],'frac'));
    if(f==='pow')return H(a[0],'base')+`<sup>${H(a[1],'sup')}</sup>`;
    if(f==='multiply')return H(a[0],'mul')+(ref(a[1]).type==='ConstantNode'?' · ':'')+H(a[1],'mul')}}
  return n.toString()}
function pretty(s){try{const p=s.replace(/≤/g,'<=').replace(/≥/g,'>=').split(/(<=|>=|!=|<|>|=)/);
  return p.map((x,i)=>i%2?` ${({'<=':'≤','>=':'≥','!=':'≠'})[x]||x} `:H(math.parse(normExpr(x)),'top')).join('')}catch(e){return fm(prettyT(s))}}
/* ---------- ЕДИНОЕ форматирование чисел: fmtNum(x, ctx) ----------
 chip — только десятичные, до 2 знаков (подписи на графике); table — компактная таблица;
 solution — шаги решения (обе формы: 3/5 = 0,6; √2/2 ≈ 0,7071); answer — точная форма, приближение в скобках */
function decStr(x,k=4){let v=Math.round(x*10**k)/10**k;if(Object.is(v,-0))v=0;return String(v).replace('.',',').replace('-',MINUS)}
const termDigits=d=>{let a=0,b=0;while(d%2===0){d/=2;a++}while(d%5===0){d/=5;b++}return d===1?Math.max(a,b):-1};
function sqrtHTML(x){if(!isFinite(x)||toFr(x,200,1e-9))return null;const r=toFr(x*x,400,1e-9);if(!r)return null;const[n,d]=r;let s=1,m=n*d;for(let i=2;i*i<=m;i++)while(m%(i*i)===0){m/=i*i;s*=i}
  if(m===1)return null;const g=gcd(s,d),cs=s/g,dd=d/g,body=(cs>1?cs:'')+rt(String(m));return(x<0?MINUS:'')+(dd===1?body:frHTML(body,dd))}
function fracMix(n,d){const a=Math.abs(n),sg=n<0?MINUS:'';if(a>d){const w=Math.floor(a/d),r=a%d;return r?sg+w+frHTML(r,d):sg+w}return sg+frHTML(a,d)}
function fmtNum(x,ctx='solution'){if(typeof x!=='number'||isNaN(x))return'—';if(!isFinite(x))return x>0?'+∞':'−∞';if(ctx==='chip')return decStr(x,2);
  const f=toFr(x,200,1e-9);
  if(f){const[n,d]=f;if(d===1)return String(n).replace('-',MINUS);const fr=ctx==='coef'?(n<0?MINUS:'')+frHTML(Math.abs(n),d):fracMix(n,d),td=termDigits(d),ex=td>=0&&td<=4;
    if(ctx==='table'||ctx==='coef')return ex?decStr(x,4):fr;if(ctx==='answer')return fr+(ex?` (= ${decStr(x,4)})`:` (≈ ${decStr(x,2)})`);return fr+(ex?` = ${decStr(x,4)}`:` ≈ ${decStr(x,4)}`)}
  const sq=sqrtHTML(x);if(ctx==='table'||ctx==='coef')return decStr(x,2);if(ctx==='answer')return(sq?sq+' ':'')+`(≈ ${decStr(x,2)})`;return(sq?sq+' ':'')+`≈ ${decStr(x,4)}`}
/* многочлен [c0,c1,c2..] -> HTML */
function polyStr(c,v='x'){let s='';for(let i=c.length-1;i>=0;i--){const k=c[i];if(Math.abs(k)<1e-12)continue;const a=Math.abs(k),p=i===0?'':i===1?v:v+(i===2?'²':i===3?'³':'⁴');
  s+=(k<0?(s?' − ':MINUS):(s?' + ':''))+((a===1&&p)?'':num(a))+p}return s||'0'}

/* ---------- выражения (math.js) ---------- */
const SUPM={'⁰':0,'¹':1,'²':2,'³':3,'⁴':4,'⁵':5,'⁶':6,'⁷':7,'⁸':8,'⁹':9};const supN=s=>s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,m=>'^'+[...m].map(c=>SUPM[c]).join(''));
const FUNCS=new Set(['sqrt','abs','nthRoot','cbrt','sin','cos','tan','log','ln','exp','pi','max','min','floor','ceil']);
function normExpr(s){return s.replace(/[−–—]/g,'-').replace(/[·×]/g,'*').replace(/[÷:]/g,'/').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,m=>supN(m))
  .replace(/½/g,'(1/2)').replace(/¼/g,'(1/4)').replace(/¾/g,'(3/4)').replace(/√\(/g,'sqrt(').replace(/√(\w+)/g,'sqrt($1)').replace(/π/g,'pi')
  .replace(/\|([^|]+)\|/g,'abs($1)').replace(/(\d),(\d)/g,'$1.$2').replace(/[A-Za-z]+/g,w=>FUNCS.has(w)||/^e$/.test(w)?w:w.split('').join('*'))
  .replace(/([\d)])\s*\(/g,'$1*(').replace(/(?<![A-Za-z])([A-Za-z])\s*\(/g,'$1*(').replace(/\)\s*([A-Za-z\d])/g,')*$1')}
function compile(expr,vars=['x']){const c=math.compile(normExpr(expr));
  return(...a)=>{try{const sc={};vars.forEach((v,i)=>sc[v]=a[i]);const r=c.evaluate(sc);return typeof r==='number'?r:NaN}catch(e){return NaN}}}
const stripY=s=>s.replace(/^\s*(y|f\s*\(\s*x\s*\)|у)\s*=/i,'');
const evalConst=s=>{const v=compile(s,[])();if(!isFinite(v))throw new Error('не число: '+s);return v};

/* ---------- анализ функций ---------- */
function polyFit(f,deg){const xs=[];for(let i=0;i<=deg;i++)xs.push(i-Math.floor(deg/2));const ys=xs.map(f);if(ys.some(v=>!isFinite(v)))return null;
  let c;try{c=math.lusolve(xs.map(x=>Array.from({length:deg+1},(_,j)=>x**j)),ys).map(r=>r[0])}catch(e){return null}
  c=c.map(v=>Math.abs(v)<1e-9?0:v);
  const ok=[.37,-2.3,3.1,-.9,5.3].every(x=>{const p=c.reduce((s,v,j)=>s+v*x**j,0),y=f(x);return isFinite(y)&&Math.abs(p-y)<1e-7*Math.max(1,Math.abs(y))});
  return ok?c:null}
function polyDeg(f){const c=polyFit(f,4);if(!c)return null;while(c.length>1&&Math.abs(c[c.length-1])<1e-9)c.pop();return c.map(v=>snap(v))}
function findRoots(g,a=-60,b=60,N=6000){
  const h=(b-a)/N,xs=[],ys=[];for(let i=0;i<=N;i++){const x=a+i*h;xs.push(x);ys.push(g(x))}
  const roots=[],poles=[],add=(arr,x)=>{if(!arr.some(r=>Math.abs(r-x)<1e-5))arr.push(x)};
  for(let i=0;i<N;i++){const y0=ys[i],y1=ys[i+1];
    if(y0===0){add(roots,xs[i]);continue}
    if(Math.abs(y0)===Infinity&&isFinite(ys[i-1]??NaN)){add(poles,xs[i]);continue}
    if(isFinite(y0)&&isFinite(y1)&&y0*y1<0){let lo=xs[i],hi=xs[i+1],fl=y0;
      for(let k=0;k<70;k++){const m=(lo+hi)/2,fv=g(m);if(!isFinite(fv))break;if(fl*fv<=0)hi=m;else{lo=m;fl=fv}}
      const r=(lo+hi)/2,v=g(r);(isFinite(v)&&Math.abs(v)<1e-4?roots:poles).push(r)}
    else if(i>0&&[ys[i-1],y0,y1].every(isFinite)){const A=Math.abs(ys[i-1]),B=Math.abs(y0),C=Math.abs(y1);
      if(B<=A&&B<=C&&B<1e-3){let lo=xs[i-1],hi=xs[i+1];for(let k=0;k<80;k++){const m1=lo+(hi-lo)/3,m2=hi-(hi-lo)/3;if(Math.abs(g(m1))<Math.abs(g(m2)))hi=m2;else lo=m1}
        const r=(lo+hi)/2;if(Math.abs(g(r))<1e-9)add(roots,r)}}}
  const cl=arr=>[...new Set(arr.map(x=>snap(x)))].sort((p,q)=>p-q);return{roots:cl(roots),poles:cl(poles)}}
function extrema(g,a=-60,b=60){const dg=x=>(g(x+1e-5)-g(x-1e-5))/2e-5;
  return findRoots(dg,a,b,4000).roots.map(x=>({x,y:g(x),min:g(x+.01)+g(x-.01)-2*g(x)>0})).filter(e=>isFinite(e.y)).map(e=>({...e,x:snap(e.x,1e-7),y:snap(e.y,1e-7)}))}

/* ---------- UI-помощники ---------- */
function stepsHTML(steps,answer){return steps.map((s,i)=>`<div class="step"><div class="step-t"><span class="step-n">${i+1}</span>${s.t}</div><div class="step-b">${s.b}</div></div>`).join('')+(answer?`<div class="answer"><div class="l">Ответ</div><div class="v">${answer}</div></div>`:'')}
function mount(id){const box=document.getElementById(id);box.classList.add('out');box.innerHTML='<div class="in"></div>';addShot(box);return box.firstChild}
function put(inner,html){inner.innerHTML=html;inner.parentNode.classList.toggle('has',!!html)}
const KEYS={
  frac:[frHTML('□','□'),'\\frac{#@}{#?}','()/()'],
  pow:['<span class="pwn">n</span>','^{#?}','^',[['typedText','^']]],
  sq:['<span class="pwn">2</span>','^{2}','^2',[['typedText','^'],['typedText','2'],'moveToNextChar']],
  x2:['x²','x^{2}','x^2'],
  sqrt:['<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3l3 7 5-15h6"/></svg>','\\sqrt{#?}','sqrt('],
  div:[':',':','/'],
  mul:['·','\\cdot ','*'],
  lp:['(','(','('],
  rp:[')',')',')'],
  plus:['+','+','+'],
  minus:['−','-','-'],
  lt:['&lt;','<','<'],
  gt:['&gt;','>','>'],
  eq:['=','=','='],
  abs:['|x|','\\left|#?\\right|','abs('],
  le:['≤','\\le ','<='],
  ge:['≥','\\ge ','>='],
  pi:['π','\\pi ','pi']
};
const TIPS={plus:'Сложение',minus:'Вычитание',mul:'Умножение',div:'Деление',frac:'Дробь: числитель над знаменателем',pow:'Степень: поставь показатель',sq:'Квадрат (степень 2) — для любого выражения',sqrt:'Квадратный корень',abs:'Модуль',lp:'Левая скобка',rp:'Правая скобка',x:'Переменная x',x2:'x в квадрате',y:'Переменная y',a:'Переменная a',b:'Переменная b',pi:'Число π',lt:'Меньше',gt:'Больше',le:'Меньше или равно',ge:'Больше или равно',eq:'Равно'};
function kbInit(host,keys,target){host.classList.add('kb');keys.forEach(k=>{const d=KEYS[k]||[k,k,k],b=document.createElement('button');b.type='button';b.innerHTML=d[0];if(TIPS[k])b.dataset.tip=TIPS[k];b.onmousedown=e=>e.preventDefault();
  b.onclick=()=>{const t=target?target():MI.last;t&&t.insert(d[1],d[2],d[3])};host.appendChild(b)})}
const defLabel=t=>t.split('\n').map(pretty).join('<span style="opacity:.4"> ; </span>');
function chipsInit(host,list,cb,lab){host.className='row';list.forEach(t=>{const b=document.createElement('button');b.type='button';b.className='chip';b.innerHTML=(lab||defLabel)(t);b.onclick=()=>cb(t);host.appendChild(b)})}
/* ---------- визуальный ввод формул (MathLive; без него — обычное поле) ---------- */
function texToPlain(t){
  t=t.replace(/\{,\}/g,'.').replace(/\\left\|(.*?)\\right\|/g,'abs($1)').replace(/\\(left|right|displaystyle|quad|,|;|!|:)/g,' ').replace(/\\placeholder(\[[^\]]*\])?\{[^}]*\}/g,'');
  const grp=(s,i)=>{let d=0,j=i;for(;j<s.length;j++){if(s[j]==='{')d++;else if(s[j]==='}'&&!--d)break}return[s.slice(i+1,j),j+1]};
  const sk=(s,i)=>{while(s[i]===' ')i++;return i};
  const arg=(s,i)=>{i=sk(s,i);if(s[i]==='{')return grp(s,i);if(s[i]==='\\'){const m=/^\\([A-Za-z]+|.)/.exec(s.slice(i));return[m[0],i+m[0].length]}return[s[i]||'',i+1]};
  function cv(s){let o='',i=0;while(i<s.length){const c=s[i];
    if(c==='\\'){const m=/^\\([A-Za-z]+|.)/.exec(s.slice(i)),nm=m?m[1]:'';i+=nm.length+1;
      if(/^[dt]?frac$/.test(nm)){let a,b;[a,i]=arg(s,i);[b,i]=arg(s,i);o+=`((${cv(a)})/(${cv(b)}))`}
      else if(nm==='sqrt'){let n=null,a;if(s[i]==='['){const j=s.indexOf(']',i);n=s.slice(i+1,j);i=j+1}[a,i]=arg(s,i);o+=n?`nthRoot(${cv(a)},${cv(n)})`:`sqrt(${cv(a)})`}
      else if(nm==='cdot'||nm==='times')o+='*';else if(nm==='div')o+='/';else if(nm==='le'||nm==='leq')o+='<=';else if(nm==='ge'||nm==='geq')o+='>=';else if(nm==='ne'||nm==='neq')o+='!=';else if(nm==='pi')o+=' pi ';
      else if(/^(mathrm|text|operatorname|mathit)$/.test(nm)){let a;[a,i]=arg(s,i);o+=cv(a)}
      continue}
    if(c==='^'||c==='_'){i=sk(s,i+1);let a;if(s[i]==='{')[a,i]=grp(s,i);else if(s[i]==='\\'){const m=/^\\([A-Za-z]+)/.exec(s.slice(i));a=m?m[0]:'';i+=a.length||1}else{a=s[i];i++}if(c==='^')o+=`^(${cv(a)})`;continue}
    if(c==='{'){let a;[a,i]=grp(s,i);o+=`(${cv(a)})`;continue}
    o+=(c===':'||c==='÷')?'/':c==='−'?'-':c;i++}return o}
  return cv(t).replace(/\s+/g,' ').trim()}
function plainToTex(s){try{const rel={'<=':'\\le ','>=':'\\ge ','!=':'\\ne ','<':'<','>':'>','=':'='};
  return s.replace(/≤/g,'<=').replace(/≥/g,'>=').split(/(<=|>=|!=|<|>|=)/).map((x,i)=>i%2?rel[x]:x.trim()?math.parse(x.replace(/[−–—]/g,'-').replace(/[·×]/g,'*').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,m=>supN(m))
    .replace(/½/g,'(1/2)').replace(/¼/g,'(1/4)').replace(/¾/g,'(3/4)').replace(/√\(/g,'sqrt(').replace(/√(\w+)/g,'sqrt($1)').replace(/π/g,'pi').replace(/\|([^|]+)\|/g,'abs($1)').replace(/(\d),(\d)/g,'$1.$2').replace(/[÷:]/g,'/')
    .replace(/[A-Za-z]+/g,w=>FUNCS.has(w)?w:w.split('').join(' '))).toTex({parenthesis:'auto',implicit:'hide'}).replace(/\\mathrm\{([A-Za-z])\}/g,'$1').replace(/~/g,' ').replace(/\{ /g,'{'):'').join('')}catch(e){return s}}
try{if(window.mathVirtualKeyboard)mathVirtualKeyboard.targetOrigin='*'}catch(e){}
function MI(host,o={}){const api={};let el;
  if(customElements.get('math-field')){el=document.createElement('math-field');el.setAttribute('math-virtual-keyboard-policy','manual');if(o.placeholder)el.setAttribute('placeholder',o.placeholder);
    el.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();o.onEnter&&o.onEnter()}},true);
    api.get=()=>{let v;try{v=el.getValue('latex-expanded')}catch(e){}return texToPlain(v||el.value)};api.set=p=>{el.value=plainToTex(p)};api.insert=(tex,pl,cmds)=>{el.focus();try{if(cmds)cmds.forEach(c=>el.executeCommand(c));else el.insert(tex,{format:'latex',focus:true})}catch(e){el.insert(tex,{format:'latex',focus:true})}}}
  else{el=document.createElement('input');el.type='text';if(o.placeholder)el.placeholder=o.placeholder;el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();o.onEnter&&o.onEnter()}});
    api.get=()=>el.value;api.set=p=>{el.value=p};api.insert=(t,pl)=>{const a=el.selectionStart,b=el.selectionEnd;el.value=el.value.slice(0,a)+pl+el.value.slice(b);el.focus();el.selectionStart=el.selectionEnd=a+pl.length}}
  el.className='mi'+(o.small?' sm':'');host.appendChild(el);
  if(el.tagName==='MATH-FIELD')setTimeout(()=>{if(typeof el.insert==='function'&&el.shadowRoot)return;const old=api.get();const inp=document.createElement('input');inp.type='text';inp.className=el.className;inp.value=old;el.replaceWith(inp);el=inp;api.el=inp;
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();o.onEnter&&o.onEnter()}});inp.addEventListener('focusin',()=>MI.last=api);api.get=()=>inp.value;api.set=p=>{inp.value=p};api.focus=()=>inp.focus();
    api.insert=(t,pl)=>{const a=inp.selectionStart,b=inp.selectionEnd;inp.value=inp.value.slice(0,a)+pl+inp.value.slice(b);inp.focus();inp.selectionStart=inp.selectionEnd=a+pl.length}},600);el.addEventListener('focusin',()=>MI.last=api);if(!MI.last)MI.last=api;
  api.el=el;Object.defineProperty(api,'value',{get:()=>api.get(),set:v=>api.set(v)});api.focus=()=>el.focus();if(o.value!=null)api.set(o.value);return api}
function MathList(host,o={}){const rows=[];const box=document.createElement('div');host.appendChild(box);
  const add=v=>{const r=document.createElement('div');r.className='mirow';const mi=MI(r,{onEnter:o.onEnter,placeholder:o.placeholder});const d=document.createElement('button');d.type='button';d.className='del';d.title='Удалить строку';d.textContent='×';
    d.onclick=()=>{if(rows.length>1){rows.splice(rows.findIndex(x=>x.mi===mi),1);r.remove()}else mi.set('')};r.appendChild(d);box.appendChild(r);rows.push({mi,r});if(v)mi.set(v);return mi};
  const b=document.createElement('button');b.type='button';b.className='btn g';b.style.cssText='height:32px;font-size:13px;padding:0 12px';b.textContent='+ строка';b.onclick=()=>add('').focus();(o.addHost||host).appendChild(b);add('');
  return{values:()=>rows.map(x=>x.mi.value.trim()).filter(Boolean),set:a=>{rows.splice(0).forEach(x=>x.r.remove());(a.length?a:['']).forEach(add)}}}
function tabsInit(host,names,cb){names.forEach((n,i)=>{const b=document.createElement('button');b.textContent=n;b.onclick=()=>{[...host.children].forEach((c,j)=>c.classList.toggle('on',i===j));cb(i)};host.appendChild(b)});host.firstChild.classList.add('on');cb(0)}
function toast(t){const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),2200)}

/* ---------- скриншот в буфер ---------- */
let _h2c;const loadH2C=()=>_h2c||(_h2c=new Promise((ok,no)=>{if(window.html2canvas)return ok();const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';s.onload=ok;s.onerror=no;document.head.appendChild(s)}));
const SHOT_ICON='<svg viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M19.75 3H7.25C6.56 3 6 3.56 6 4.25v12.5c0 .69.56 1.25 1.25 1.25h12.5c.69 0 1.25-.56 1.25-1.25V4.25C21 3.56 20.44 3 19.75 3m-.25 1.5v5.44l-1.115-1.115a1.26 1.26 0 0 0-1.77 0L12.5 12.94l-1.365-1.365a1.26 1.26 0 0 0-1.77 0L7.5 13.44V4.5zm-12 12v-.94l2.75-2.75l2.25 2.25l5-5l2 2v4.44zm-3 1.75V6H3v12.25A2.755 2.755 0 0 0 5.75 21H18v-1.5H5.75c-.69 0-1.25-.56-1.25-1.25M13 7.75C13 8.99 11.99 10 10.75 10S8.5 8.99 8.5 7.75S9.51 5.5 10.75 5.5S13 6.51 13 7.75m-1.5 0a.749.749 0 1 0-1.5 0a.749.749 0 1 0 1.5 0" clip-rule="evenodd"/></svg>';
function addShot(box){box.classList.add('shotbox');const b=document.createElement('button');b.className='shot';b.title='Скопировать как картинку';b.innerHTML=SHOT_ICON;
  b.onclick=async e=>{e.stopPropagation();box.classList.add('capturing');
    try{await loadH2C();const cv=await html2canvas(box,{backgroundColor:'#ffffff',scale:2,logging:false});const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
      try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);toast('Скопировано в буфер обмена')}
      catch(_){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='algebra.png';a.click();toast('Буфер недоступен — картинка скачана')}
    }catch(_){toast('Не получилось сделать скрин (нужен интернет для html2canvas)')}
    box.classList.remove('capturing')};box.appendChild(b)}

/* ---------- ДВИЖОК ГРАФИКОВ (тетрадный лист в клетку) ----------
 items: {type:'fn',f,color,label,dash} {type:'imp',F,color,label} {type:'pt',x,y,color,label,guide,pulse,small}
        {type:'vline',x,color,dash} {type:'hline',y,color,dash} */
class Plot{
  constructor(host,o={}){this.host=host;host.classList.add('plotbox');this.ratio=o.ratio||.64;
    const cv=this.cv=document.createElement('canvas');host.appendChild(cv);this.ctx=cv.getContext('2d');
    this.items=[];this.v={cx:0,cy:0,s:40};this.home={...this.v};this.hover=null;this.t0=performance.now();
    const rs=()=>{const w=Math.max(300,host.clientWidth);if(w===this.W)return;this.W=w;this.H=Math.round(w*this.ratio);const d=this.dpr=Math.max(2,window.devicePixelRatio||1);cv.width=w*d;cv.height=this.H*d;cv.style.height=this.H+'px';this.draw()};
    new ResizeObserver(rs).observe(host);rs();let drag=null;
    cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,cx:this.v.cx,cy:this.v.cy};cv.setPointerCapture(e.pointerId)});
    cv.addEventListener('pointermove',e=>{const r=cv.getBoundingClientRect();if(drag){this.v.cx=drag.cx-(e.clientX-drag.x)/this.v.s;this.v.cy=drag.cy+(e.clientY-drag.y)/this.v.s}this.hover=drag?null:[e.clientX-r.left,e.clientY-r.top];this.draw()});
    cv.addEventListener('pointerup',()=>drag=null);cv.addEventListener('pointerleave',()=>{this.hover=null;this.draw()});
    cv.addEventListener('wheel',e=>{e.preventDefault();const r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top,v=this.v,wx=v.cx+(px-this.W/2)/v.s,wy=v.cy-(py-this.H/2)/v.s;
      v.s=Math.min(300,Math.max(6,v.s*(e.deltaY<0?1.12:1/1.12)));v.cx=wx-(px-this.W/2)/v.s;v.cy=wy+(py-this.H/2)/v.s;this.draw()},{passive:false});
    cv.addEventListener('dblclick',()=>{this.v={...this.home};this.draw()});this.lg=document.createElement('div');this.lg.className='legend';host.appendChild(this.lg);addShot(host)}
  fit(P){let x0=0,x1=0,y0=0,y1=0;(P||[]).forEach(p=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])});
    const xs=Math.max(12,(x1-x0)*1.5),ys=Math.max(12*this.H/this.W,(y1-y0)*1.5);const s=Math.min(this.W/xs,this.H/ys,60);
    this.v={cx:(x0+x1)/2,cy:(y0+y1)/2,s:Math.max(s,9)};this.home={...this.v}}
  set(items,P){this.items=items;const L=items.filter(i=>(i.type==='fn'||i.type==='imp')&&(i.html||i.label));this.lg.style.display=L.length?'':'none';this.lg.innerHTML=L.map(i=>`<div><i style="background:${i.color}"></i>${i.html||i.label}</div>`).join('');if(P)this.fit(P);cancelAnimationFrame(this.raf);this.raf=0;if(items.some(i=>i.pulse)){const tick=()=>{this.draw();this.raf=requestAnimationFrame(tick)};tick()}else this.draw()}
  chip(t,x,y,c){const k=this.ctx;k.font='600 12px Segoe UI,sans-serif';const w=k.measureText(t).width+10;k.fillStyle=c;k.beginPath();k.roundRect(x-w/2,y-9,w,18,5);k.fill();k.fillStyle='#fff';k.textAlign='center';k.textBaseline='middle';k.fillText(t,x,y+.5)}
  draw(){const k=this.ctx,{W,H,v}=this;if(!W)return;const t=performance.now()-this.t0;k.setTransform(this.dpr,0,0,this.dpr,0,0);k.fillStyle='#fff';k.fillRect(0,0,W,H);
    const X=x=>W/2+(x-v.cx)*v.s,Y=y=>H/2-(y-v.cy)*v.s;this.X=X;this.Y=Y;
    const x0=v.cx-W/2/v.s,x1=v.cx+W/2/v.s,y0=v.cy-H/2/v.s,y1=v.cy+H/2/v.s;
    let st=1;for(const m of [.1,.2,.5,1,2,5,10,20,50,100,200,500,1000]){st=m;if(m*v.s>=22)break}
    k.strokeStyle='#c6d8ee';k.lineWidth=1;k.beginPath();
    for(let i=Math.ceil(x0/st);i*st<=x1;i++){const p=Math.round(X(i*st))+.5;k.moveTo(p,0);k.lineTo(p,H)}
    for(let i=Math.ceil(y0/st);i*st<=y1;i++){const p=Math.round(Y(i*st))+.5;k.moveTo(0,p);k.lineTo(W,p)}k.stroke();
    const ax=Math.min(W-22,Math.max(22,X(0))),ay=Math.min(H-22,Math.max(22,Y(0)));this.axX=ax;this.axY=ay;
    k.strokeStyle='#1d2433';k.fillStyle='#1d2433';k.lineWidth=1.8;k.beginPath();k.moveTo(0,ay);k.lineTo(W-4,ay);k.moveTo(ax,H);k.lineTo(ax,4);k.stroke();
    k.beginPath();k.moveTo(W-2,ay);k.lineTo(W-12,ay-4.5);k.lineTo(W-12,ay+4.5);k.fill();k.beginPath();k.moveTo(ax,2);k.lineTo(ax-4.5,12);k.lineTo(ax+4.5,12);k.fill();
    k.font='italic 600 15px Georgia,serif';k.textAlign='left';k.fillText('x',W-16,ay+(ay>H-30?-10:18));k.fillText('y',ax+(ax>W-30?-14:9),16);
    k.font='12px Segoe UI,sans-serif';k.fillStyle='#4a556e';k.strokeStyle='#fff';k.lineWidth=3;
    const lab=(t,x,y,al)=>{k.textAlign=al;k.strokeText(t,x,y);k.fillText(t,x,y)};const every=st*v.s>=40?1:2;
    k.textBaseline='alphabetic';
    for(let i=Math.ceil(x0/st);i*st<=x1;i++){if(i===0||i%every)continue;lab(fmtNum(i*st,'chip'),X(i*st),ay+(ay>H-28?-8:16),'center')}
    for(let i=Math.ceil(y0/st);i*st<=y1;i++){if(i===0||i%every)continue;lab(fmtNum(i*st,'chip'),ax+(ax<36?8:-7),Y(i*st)+4,ax<36?'left':'right')}
    lab('0',ax+(ax<36?8:-7),ay+(ay>H-28?-8:16),ax<36?'left':'right');
    // оси-подписи единичного отрезка
    for(const it of this.items){
      if(it.type==='vline'||it.type==='hline'){k.save();k.strokeStyle=it.color||'#888';k.lineWidth=it.w||1.8;k.setLineDash(it.dash||[8,6]);k.globalAlpha=.85;k.beginPath();
        if(it.type==='vline'){k.moveTo(X(it.x),0);k.lineTo(X(it.x),H)}else{k.moveTo(0,Y(it.y));k.lineTo(W,Y(it.y))}k.stroke();k.restore()}
      else if(it.type==='imp')this.imp(it);
      else if(it.type==='fn'){k.save();k.strokeStyle=it.color;k.lineWidth=it.w||3;k.lineJoin='round';if(it.dash)k.setLineDash([9,6]);if(it.alpha)k.globalAlpha=it.alpha;k.beginPath();let pen=false,py=0;
        for(let px=0;px<=W;px+=1){const y=it.f(x0+px/v.s),Yp=Y(y);if(!isFinite(y)||Math.abs(Yp)>1e5){pen=false;continue}if(pen&&Math.abs(Yp-py)>H*1.2)pen=false;pen?k.lineTo(px,Yp):k.moveTo(px,Yp);pen=true;py=Yp}k.stroke();k.restore()}}
    for(const it of this.items)if(it.type==='pt')this.pt(it,t);
    // наведение
    if(this.hover){const[hx0,hy0]=this.hover,r2=q=>Math.round(q*100)/100;let best=null,bd=18;
      for(const it of this.items)if(it.type==='pt'){const d=Math.hypot(X(it.x)-hx0,Y(it.y)-hy0);if(d<bd){bd=d;best=it}}
      this.cv.style.cursor=best?'pointer':'grab';
      if(best){const c=best.color||'#e11d48',px=X(best.x),py=Y(best.y);k.fillStyle='rgba(255,255,255,.75)';k.strokeStyle=c;k.lineWidth=3;k.beginPath();k.arc(px,py,12,0,7);k.fill();k.stroke();k.fillStyle=c;k.beginPath();k.arc(px,py,5,0,7);k.fill();this.bubble(`(${fmtNum(best.x,'chip')}; ${fmtNum(best.y,'chip')})`,px,py,c)}
      else{const hx=x0+hx0/v.s;for(const it of this.items){if(it.type!=='fn'||it.dash)continue;const y=it.f(hx);if(!isFinite(y)||Math.abs(Y(y))>H*3)continue;
        k.fillStyle='#fff';k.strokeStyle=it.color;k.lineWidth=2.5;k.beginPath();k.arc(hx0,Y(y),5,0,7);k.fill();k.stroke();this.bubble(`(${fmtNum(hx,'chip')}; ${fmtNum(y,'chip')})`,hx0,Y(y),it.color)}}}}
  bubble(txt,px,py,c){const k=this.ctx,{W,H}=this;k.font='700 13px Segoe UI,sans-serif';const w=k.measureText(txt).width+16;let bx=px+12,by=py-36;if(bx+w>W-4)bx=px-12-w;if(by<4)by=py+14;if(by>H-26)by=H-26;
    k.fillStyle=c;k.beginPath();k.roundRect(bx,by,w,24,7);k.fill();k.fillStyle='#fff';k.textAlign='left';k.textBaseline='middle';k.fillText(txt,bx+8,by+12.5)}
  pt(it,t){const k=this.ctx,px=this.X(it.x),py=this.Y(it.y),c=it.color||'#e11d48';
    if(px<-20||px>this.W+20||py<-20||py>this.H+20)return;
    if(it.guide){k.save();k.setLineDash([6,5]);k.strokeStyle=c;k.lineWidth=1.7;k.globalAlpha=.85;k.beginPath();k.moveTo(px,py);k.lineTo(px,this.axY);k.moveTo(px,py);k.lineTo(this.axX,py);k.stroke();k.restore();
      if(Math.abs(it.x)>1e-9)this.chip(fmtNum(it.x,'chip'),px,this.axY+(py<this.axY?18:-18),c);
      if(Math.abs(it.y)>1e-9)this.chip(fmtNum(it.y,'chip'),this.axX+(px>this.axX?-22:22),py,c)}
    if(it.pulse){const f=(t%1300)/1300;k.strokeStyle=c;k.globalAlpha=1-f;k.lineWidth=3;k.beginPath();k.arc(px,py,8+f*20,0,7);k.stroke();k.globalAlpha=1}
    const r=it.small?4.5:7;k.shadowColor='rgba(0,0,0,.3)';k.shadowBlur=6;k.fillStyle=c;k.beginPath();k.arc(px,py,r,0,7);k.fill();k.shadowBlur=0;k.strokeStyle='#fff';k.lineWidth=it.small?1.5:2.5;k.stroke();
    if(!it.nolabel&&(!it.small||it.label))this.bubble(it.label??`(${fmtNum(it.x,'chip')}; ${fmtNum(it.y,'chip')})`,px,py,c)}
  imp(it){const k=this.ctx,{W,H,v}=this,key=[v.cx,v.cy,v.s,W].join();
    if(it._k!==key){const g=3,cols=Math.ceil(W/g)+1,rows=Math.ceil(H/g)+1,x0=v.cx-W/2/v.s,y1=v.cy+H/2/v.s,st=g/v.s,val=[];
      for(let j=0;j<rows;j++){const r=[];for(let i=0;i<cols;i++)r.push(it.F(x0+i*st,y1-j*st));val.push(r)}
      const ip=(a,b,p,q)=>p+(q-p)*(a/(a-b)),seg=[];
      for(let j=0;j<rows-1;j++)for(let i=0;i<cols-1;i++){const a=val[j][i],b=val[j][i+1],c=val[j+1][i+1],d=val[j+1][i];if(![a,b,c,d].every(isFinite))continue;
        const x=i*g,y=j*g,p=[];if(a*b<0)p.push([ip(a,b,x,x+g),y]);if(b*c<0)p.push([x+g,ip(b,c,y,y+g)]);if(d*c<0)p.push([ip(d,c,x,x+g),y+g]);if(a*d<0)p.push([x,ip(a,d,y,y+g)]);
        if(p.length>=2){seg.push(p[0],p[1]);if(p.length===4)seg.push(p[2],p[3])}}
      it._s=seg;it._k=key}
    k.strokeStyle=it.color;k.lineWidth=3;k.lineCap='round';k.beginPath();for(let i=0;i<it._s.length;i+=2){k.moveTo(...it._s[i]);k.lineTo(...it._s[i+1])}k.stroke()}
}
