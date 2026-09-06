import{b as c,r as p,a as u}from"./index-D_J-y0Rp.js";const t="fd-demo-bar",s="fdDemo.hintsHidden",b=[{href:"/projects/landing/deploys",text:"Запустите деплой и смотрите живой лог"},{href:"/projects/shop/deploys",text:"Откатитесь на прошлый релиз"},{href:"/cms",text:"Посмотрите, как клиент получает доступ к своему сайту"}];function l(){try{return sessionStorage.getItem(s)==="1"}catch{return!1}}function m(){return new URL("..",window.location.origin+c()).pathname}function f(){if(document.getElementById(t))return;const e=document.createElement("style");e.textContent=`
    #${t} {
      position: fixed; inset: auto 0 0 0; z-index: 2147483000;
      display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
      gap: 8px 18px; padding: 9px 16px;
      background: #101012; color: rgba(255,255,255,.86);
      border-top: 1px solid rgba(255,255,255,.14);
      font: 500 13px/1.4 ui-sans-serif, system-ui, sans-serif;
    }
    #${t} b { color: #fff; font-weight: 700; }
    #${t} span { color: rgba(255,255,255,.6); font-weight: 400; }
    #${t} a, #${t} button {
      appearance: none; cursor: pointer;
      padding: 4px 12px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,.24); background: transparent;
      color: inherit; font: inherit; text-decoration: none;
    }
    #${t} a:hover, #${t} button:hover { background: rgba(255,255,255,.1); }
    #${t}-hints {
      position: fixed; inset: auto 0 46px 0; z-index: 2147482999;
      display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
      gap: 8px 10px; padding: 10px 16px;
      background: #17171a; border-top: 1px solid rgba(255,255,255,.08);
      font: 500 13px/1.4 ui-sans-serif, system-ui, sans-serif;
    }
    #${t}-hints b { color: rgba(255,255,255,.55); font-weight: 500; margin-right: 4px; }
    #${t}-hints a {
      padding: 5px 12px; border-radius: 999px; text-decoration: none;
      border: 1px solid rgba(255,255,255,.2); color: rgba(255,255,255,.9);
    }
    #${t}-hints a:hover { background: rgba(255,255,255,.12); }
    #${t}-hints button {
      appearance: none; border: 0; background: transparent; cursor: pointer;
      color: rgba(255,255,255,.45); font: inherit; padding: 5px 6px;
    }
    #${t}-hints button:hover { color: rgba(255,255,255,.8); }
    /* Полоса перекрыла бы последнюю строку страницы — отдаём ей место.
       На дашборде над ней ещё и подсказки, поэтому места нужно больше. */
    body { padding-bottom: 46px; }
    body[data-demo-hints] { padding-bottom: 96px; }
  `,document.head.appendChild(e);const n=document.createElement("div");n.id=t,n.setAttribute("role","status");const o=document.createElement("div"),a=document.createElement("b");a.textContent="Демо.";const r=document.createElement("span");r.textContent=" Данные вымышленные, сервера за ними нет. Изменения живут до перезагрузки страницы.",o.append(a,r);const d=document.createElement("button");d.type="button",d.textContent="Сбросить данные",d.addEventListener("click",()=>window.location.reload());const i=document.createElement("a");i.href=m(),i.textContent="Вернуться на сайт",n.append(o,d,i),document.body.appendChild(n),x()}function x(){if(p()!=="/"||l())return;const e=document.createElement("div");e.id=`${t}-hints`;const n=document.createElement("b");n.textContent="С чего начать:",e.appendChild(n);for(const a of b){const r=document.createElement("a");r.href=u(a.href),r.textContent=a.text,e.appendChild(r)}const o=document.createElement("button");o.type="button",o.textContent="Скрыть",o.addEventListener("click",()=>{e.remove(),document.body.removeAttribute("data-demo-hints");try{sessionStorage.setItem(s,"1")}catch{}}),e.appendChild(o),document.body.appendChild(e),document.body.setAttribute("data-demo-hints","")}export{f as mountDemoBanner};
