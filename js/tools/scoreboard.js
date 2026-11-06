import { save, toolData } from '../store.js';
import { esc, pageHead, beep, COLORS, toggleFullscreen } from '../util.js';

const makeTeams = n => Array.from({ length: n }, (_, i) => ({ name: `ทีม ${i + 1}`, score: 0, color: COLORS[i % COLORS.length] }));

export default {
  id: 'scoreboard',
  icon: '🏆',
  title: 'กระดานคะแนนทีม',
  desc: 'เพิ่ม/ลดคะแนนกลุ่มระหว่างทำกิจกรรมหรือเกมในห้อง',
  render(el) {
    const d = toolData('scoreboard', { teams: makeTeams(4) });

    el.innerHTML = `
      ${pageHead('🏆 กระดานคะแนนทีม', `
        <button class="btn" data-act="add">➕ เพิ่มทีม</button>
        <button class="btn" data-act="zero">↺ รีเซ็ตคะแนน</button>
        <button class="btn" data-act="fs">⛶ เต็มจอ</button>`)}
      <div class="fs-target" id="fs"><div class="teams" id="teams"></div></div>`;

    const teamsEl = el.querySelector('#teams');
    function draw() {
      const top = Math.max(...d.teams.map(t => t.score));
      teamsEl.innerHTML = d.teams.map((t, i) => `
        <div class="team ${top > 0 && t.score === top ? 'leader' : ''}" style="--c:${t.color}" data-i="${i}">
          <input class="tname" value="${esc(t.name)}" aria-label="ชื่อทีม">
          <div class="score">${t.score}</div>
          <div class="row" style="justify-content:center">
            <button class="btn" data-d="-1">−1</button>
            <button class="btn btn-primary" data-d="1">+1</button>
            <button class="btn" data-d="5">+5</button>
          </div>
          ${d.teams.length > 1 ? `<button class="btn btn-sm btn-ghost btn-danger" data-act="del" style="margin-top:8px">ลบทีม</button>` : ''}
        </div>`).join('');
    }

    el.addEventListener('click', e => {
      const card = e.target.closest('.team');
      const b = e.target.closest('button');
      if (!b) return;
      if (card && b.dataset.d) {
        const t = d.teams[+card.dataset.i];
        const delta = +b.dataset.d;
        t.score += delta;
        beep({ freq: delta > 0 ? 880 : 300, dur: 0.08, vol: 0.12 });
        save(); draw(); return;
      }
      const act = b.dataset.act;
      if (act === 'del' && card && confirm(`ลบ ${d.teams[+card.dataset.i].name}?`)) { d.teams.splice(+card.dataset.i, 1); save(); draw(); }
      if (act === 'add' && d.teams.length < 12) { const n = d.teams.length; d.teams.push({ name: `ทีม ${n + 1}`, score: 0, color: COLORS[n % COLORS.length] }); save(); draw(); }
      if (act === 'zero' && confirm('รีเซ็ตคะแนนทุกทีมเป็น 0?')) { d.teams.forEach(t => { t.score = 0; }); save(); draw(); }
      if (act === 'fs') toggleFullscreen(el.querySelector('#fs'));
    });
    el.addEventListener('input', e => {
      if (!e.target.classList.contains('tname')) return;
      d.teams[+e.target.closest('.team').dataset.i].name = e.target.value;
      save();
    });
    draw();
  },
};
