/* shell.js — общий тёмный сайдбар на каждой странице (без iframe: он ломается на file://) */
(function(){
if(!document.querySelector('link[rel~="icon"]')){const ic=document.createElement('link');ic.rel='icon';ic.type='image/png';ic.href='favicon.png';document.head.appendChild(ic)}
const M=[['Выражения'],['factor','x²','Разложение на множители'],['Функции'],['graph','∿','Построение графиков'],['quadratic','∪','Квадратичная функция'],['Уравнения и неравенства'],['equations','=','Уравнения и системы'],['inequalities','≤','Неравенства'],['Дальше'],['sequences','∑','Прогрессии'],['combinatorics','!','Комбинаторика, вероятность']];
const cur=(location.pathname.split('/').pop()||'').replace('.html','');
const css=`body{padding:26px 30px 60px 282px!important}.a9side{position:fixed;left:0;top:0;bottom:0;width:250px;background:#151824;color:#8b93a7;padding:22px 14px;display:flex;flex-direction:column;overflow-y:auto;z-index:50;font-family:'Segoe UI',system-ui,sans-serif}
.a9side .brand{font-size:22px;font-weight:800;color:#e8eaef;letter-spacing:-.03em;padding:0 8px 18px}.a9side .brand span{color:#4f8cff}
.a9side .grp{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:14px 10px 6px;color:#5c657c}
.a9side a{display:flex;align-items:center;gap:12px;color:#9aa3b8;font:600 14.5px 'Segoe UI',system-ui,sans-serif;text-decoration:none;padding:10px 12px;border-radius:10px;transition:.15s}
.a9side a:hover{background:#1f2333;color:#e8eaef}.a9side a.on{background:rgba(79,140,255,.16);color:#6fa1ff}
.a9side .ic{width:26px;height:26px;border-radius:8px;background:#1f2333;display:grid;place-items:center;font:700 14px Georgia,serif;flex-shrink:0}.a9side a.on .ic{background:rgba(79,140,255,.25)}
.a9side .foot{margin-top:auto;font-size:12px;text-align:center;padding-top:12px}
@media(max-width:760px){body{padding:70px 14px 40px!important}.a9side{width:100%;height:56px;bottom:auto;flex-direction:row;align-items:center;padding:8px;overflow-x:auto;overflow-y:hidden}.a9side .brand,.a9side .grp,.a9side .foot{display:none}.a9side a{white-space:nowrap}}`;
document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  const n=document.createElement('nav');n.className='a9side';n.innerHTML='<div class="brand">Алгебра<span>9</span></div>'+M.map(m=>m.length===1?`<div class="grp">${m[0]}</div>`:`<a href="${m[0]}.html" class="${m[0]===cur?'on':''}"><span class="ic">${m[1]}</span>${m[2]}</a>`).join('')+'<div class="foot">Помощник по алгебре, 9 класс</div>';
  document.body.prepend(n)});
})();
