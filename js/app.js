import { state, onChange, setCurrent, currentClass } from './store.js';
import { $, esc } from './util.js';

import classes from './tools/classes.js';
import picker from './tools/picker.js';
import groups from './tools/groups.js';
import timer from './tools/timer.js';
import attendance from './tools/attendance.js';
import grades from './tools/grades.js';
import scoreboard from './tools/scoreboard.js';
import noise from './tools/noise.js';
import seating from './tools/seating.js';
import random from './tools/random.js';
import qr from './tools/qr.js';
import schedule from './tools/schedule.js';
import behavior from './tools/behavior.js';
import homework from './tools/homework.js';
import exam from './tools/exam.js';
import teachlog from './tools/teachlog.js';

export const TOOLS = [picker, groups, timer, attendance, homework, grades, exam, behavior, schedule, teachlog, scoreboard, noise, seating, random, qr];
const ROUTES = Object.fromEntries([...TOOLS, classes].map(t => [t.id, t]));

const app = $('#app');
let cleanup = null;

function renderHome() {
  const c = currentClass();
  app.innerHTML = `
    <section class="hero">
      <h1>สุดยอดเครื่องมือสำหรับครู 🍎</h1>
      <p>ใช้ได้ทันที ไม่ต้องสมัคร ไม่ต้องติดตั้ง · ห้องปัจจุบัน: <b>${esc(c.name)}</b> (${c.students.length} คน)</p>
    </section>
    <section class="tools">
      ${TOOLS.map(t => `
        <a class="tool" href="#/${t.id}">
          <div class="ico" aria-hidden="true">${t.icon}</div>
          <h3>${t.title}</h3>
          <p>${t.desc}</p>
        </a>`).join('')}
      <a class="tool" href="#/classes">
        <div class="ico" aria-hidden="true">${classes.icon}</div>
        <h3>${classes.title}</h3>
        <p>${classes.desc}</p>
      </a>
    </section>`;
  document.title = 'TEACHERKIT — สุดยอดเครื่องมือสำหรับครู';
}

function route() {
  if (typeof cleanup === 'function') { try { cleanup(); } catch { /* ignore */ } }
  cleanup = null;
  const id = location.hash.replace(/^#\/?/, '').split('?')[0];
  const tool = ROUTES[id];
  if (!tool) renderHome();
  else {
    // สร้างกล่องใหม่ทุกครั้ง เพื่อไม่ให้ event listener ของหน้าเก่าค้าง
    const view = document.createElement('div');
    app.replaceChildren(view);
    cleanup = tool.render(view) || null;
    document.title = `${tool.title} · TEACHERKIT`;
  }
  window.scrollTo(0, 0);
}

// ตัวเลือกห้องเรียนบนแถบด้านบน
const sel = $('#classSelect');
function renderClassSelect() {
  sel.innerHTML = state.classes.map(c =>
    `<option value="${c.id}" ${c.id === state.currentId ? 'selected' : ''}>${esc(c.name)} (${c.students.length})</option>`
  ).join('');
}
sel.addEventListener('change', () => { setCurrent(sel.value); route(); });
onChange(renderClassSelect);

// โหมดมืด/สว่าง
const THEME_KEY = 'teacherkit:theme';
function applyTheme(t) { document.documentElement.dataset.theme = t; }
let theme;
try { theme = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
applyTheme(theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('#themeToggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
});

window.addEventListener('hashchange', route);
renderClassSelect();
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
