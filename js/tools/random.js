import { pageHead, randInt, beep } from '../util.js';

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export default {
  id: 'random',
  icon: '🎲',
  title: 'ลูกเต๋า · โยนเหรียญ · สุ่มเลข',
  desc: 'ทอยลูกเต๋า โยนหัว-ก้อย สุ่มตัวเลขในช่วงที่กำหนด',
  render(el) {
    el.innerHTML = `
      ${pageHead('🎲 ลูกเต๋า · โยนเหรียญ · สุ่มเลข')}
      <div class="grid grid-2">
        <div class="card stack" style="text-align:center">
          <h2>🎲 ทอยลูกเต๋า</h2>
          <div class="dice" id="dice"><div class="die">⚀</div></div>
          <div id="diceSum" class="muted"></div>
          <div class="row" style="justify-content:center">
            <label>จำนวน <input type="number" id="nd" min="1" max="6" value="1"></label>
            <button class="btn btn-primary" data-act="dice">ทอย!</button>
          </div>
        </div>
        <div class="card stack" style="text-align:center">
          <h2>🪙 โยนเหรียญ</h2>
          <div class="dice"><div class="die" id="coin" style="border-radius:50%;font-size:1.6rem">?</div></div>
          <div id="coinStat" class="muted small">หัว 0 · ก้อย 0</div>
          <div class="row" style="justify-content:center"><button class="btn btn-primary" data-act="coin">โยน!</button></div>
        </div>
        <div class="card stack" style="text-align:center">
          <h2>🔢 สุ่มตัวเลข</h2>
          <div class="big-name" id="num" style="font-size:4rem">-</div>
          <div class="row" style="justify-content:center">
            <label>ตั้งแต่ <input type="number" id="lo" value="1"></label>
            <label>ถึง <input type="number" id="hi" value="40"></label>
          </div>
          <div class="row" style="justify-content:center">
            <label class="check"><input type="checkbox" id="norep"> ไม่ซ้ำ</label>
            <button class="btn btn-primary" data-act="num">สุ่ม!</button>
          </div>
          <div class="chips" id="hist" style="justify-content:center"></div>
        </div>
      </div>`;

    let heads = 0, tails = 0;
    let used = new Set();
    const $ = s => el.querySelector(s);

    el.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'dice') {
        const n = Math.max(1, Math.min(6, +$('#nd').value || 1));
        const vals = Array.from({ length: n }, () => randInt(1, 6));
        $('#dice').innerHTML = vals.map(v => `<div class="die roll" title="${v}">${FACES[v - 1]}</div>`).join('');
        $('#diceSum').textContent = n > 1 ? `รวม ${vals.reduce((a, b) => a + b, 0)} (${vals.join(' + ')})` : `ได้ ${vals[0]}`;
        beep({ freq: 600, dur: 0.05, times: 3, gap: 0.03, vol: 0.08 });
      }
      if (act === 'coin') {
        const h = randInt(0, 1) === 1;
        h ? heads++ : tails++;
        const coin = $('#coin');
        coin.classList.remove('roll'); void coin.offsetWidth; coin.classList.add('roll');
        coin.textContent = h ? 'หัว' : 'ก้อย';
        $('#coinStat').textContent = `หัว ${heads} · ก้อย ${tails}`;
      }
      if (act === 'num') {
        let lo = Math.trunc(+$('#lo').value), hi = Math.trunc(+$('#hi').value);
        if (lo > hi) [lo, hi] = [hi, lo];
        const norep = $('#norep').checked;
        if (norep && used.size >= hi - lo + 1) { used = new Set(); $('#hist').innerHTML = ''; }
        let v;
        if (norep) {
          const left = [];
          for (let i = lo; i <= hi && left.length < 100000; i++) if (!used.has(i)) left.push(i);
          v = left[randInt(0, left.length - 1)];
          used.add(v);
        } else v = randInt(lo, hi);
        $('#num').textContent = v;
        $('#num').className = 'big-name win';
        $('#hist').insertAdjacentHTML('afterbegin', `<span class="chip">${v}</span>`);
        beep({ freq: 900, dur: 0.1, vol: 0.1 });
      }
    });
    el.addEventListener('change', e => { if (['lo', 'hi'].includes(e.target.id)) { used = new Set(); $('#hist').innerHTML = ''; } });
  },
};
