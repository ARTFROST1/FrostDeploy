import{n as e,t}from"./clipboard.CYJoVzbl.js";var n=`${{url:`https://artfrost1.github.io/FreimDeploy`,name:`Freim Deploy`,shortName:`Freim`,legalName:`Freim Deploy`,tagline:`Все сайты клиентов в одной панели. Без Docker.`,description:`Self-hosted платформа деплоя на ваш VPS: сборка из GitHub, автоматический HTTPS, откат в один клик и CMS-портал для клиента. Без Docker, от 1 ГБ RAM.`,lang:`ru`,locale:`ru_RU`,schemaType:`Organization`,priceRange:``,productionLeadDays:30,contact:{phone:``,phoneRaw:``,email:``},workingHours:{display:``,schema:``},address:{country:`RU`,region:``,locality:``,street:``,postalCode:``,full:``},geo:{lat:0,lng:0},social:{telegram:`https://t.me/ArtFrost`,whatsapp:``,max:``,vk:``,instagram:`https://www.instagram.com/art_frostt`,youtube:`https://www.youtube.com/@artfrostt`,rutube:``,linkedin:`https://www.linkedin.com/in/artemiy-morozov-79015b3b4`,x:`https://x.com/artfrostt`},ogImage:`/og/og-default.jpg`,logo:`/logo.png`,repo:`https://github.com/ARTFROST1/FreimDeploy`,starsMin:25}.url}${{agents:`/agents.md`,llms:`/llms.txt`}.agents}`,r={ru:{terminal:`Установи мне Freim Deploy на сервер и доведи до рабочей панели.

Инструкция — ${n}
Прочитай её целиком и иди по шагам.

Мой сервер:  root@<IP-СЕРВЕРА>
Мой домен:   <example.com>

Доступ к серверу у тебя есть — выполняй команды сам, не пересказывай их мне.
Спрашивай, если понадобятся DNS, токен GitHub или пароли.
Остановись, когда панель откроется в браузере на моём домене.`,chat:`Помоги мне установить Freim Deploy на мой сервер.

Инструкция — ${n}
Прочитай её и веди меня по шагам.

Мой сервер:  root@<IP-СЕРВЕРА>
Мой домен:   <example.com>

Доступа к серверу у тебя нет — диктуй мне команды по одной и жди,
пока я пришлю вывод. Объясняй каждый шаг одним предложением.`},en:{terminal:`Install Freim Deploy on my server and take it to a working panel.

Instructions — ${n}
Read them in full and follow the steps. They are written in Russian —
translate as you go.

My server:  root@<SERVER-IP>
My domain:  <example.com>

You have access to the server — run the commands yourself, do not narrate them.
Ask me if you need DNS records, a GitHub token or passwords.
Stop when the panel opens in a browser on my domain.`,chat:`Help me install Freim Deploy on my server.

Instructions — ${n}
Read them and walk me through the steps. They are written in Russian —
translate as you go.

My server:  root@<SERVER-IP>
My domain:  <example.com>

You have no access to the server — give me one command at a time and wait
until I paste the output back. Explain each step in a single sentence.`}};if(!window.__aiPromptInit){window.__aiPromptInit=!0;let n=e=>e.closest(`[data-ai-split]`)?.querySelector(`[data-ai-menu]`)??null,i=e=>e.closest(`[data-ai-split]`)?.querySelector(`[data-ai-toggle]`)??null;function a(e){document.querySelectorAll(`[data-ai-menu]`).forEach(e=>e.hidden=!0),document.querySelectorAll(`[data-ai-toggle]`).forEach(e=>e.setAttribute(`aria-expanded`,`false`)),e?.focus()}document.addEventListener(`click`,async o=>{let s=o.target;if(!s)return;let c=s.closest(`[data-ai-toggle]`);if(c){let e=n(c);if(!e)return;let t=e.hidden;a(),e.hidden=!t,c.setAttribute(`aria-expanded`,String(t)),t&&e.querySelector(`.split__item`)?.focus();return}let l=s.closest(`[data-ai-copy]`);if(l){let n=document.documentElement.lang===`en`?`en`:`ru`,o=l.dataset.aiCopy;await t(r[n]?.[o]??``);let s=l.closest(`[data-ai-split]`)?.querySelector(`.split__main`);s?.dataset.labelIdle&&e(s,s.dataset.labelIdle,s.dataset.labelDone??`Copied`),l.matches(`[role="menuitem"]`)&&a(i(l)??void 0);return}s.closest(`[data-ai-menu]`)||a()}),document.addEventListener(`keydown`,e=>{let t=document.querySelector(`[data-ai-menu]:not([hidden])`);if(t){if(e.key===`Escape`){e.preventDefault(),a(i(t)??void 0);return}if(e.key===`ArrowDown`||e.key===`ArrowUp`){let n=[...t.querySelectorAll(`.split__item`)];if(!n.length)return;e.preventDefault();let r=n.indexOf(document.activeElement);n[((e.key===`ArrowDown`?r+1:r-1)+n.length)%n.length].focus()}}}),document.addEventListener(`astro:before-swap`,()=>a())}