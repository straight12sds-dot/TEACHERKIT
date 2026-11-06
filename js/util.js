export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const uiIcon = name => `<svg class="ui-icon" aria-hidden="true"><use href="#ui-${name}"/></svg>`;

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// สุ่มที่ปลอดภัยและไม่เอนเอียง
export function randInt(min, max) {
  const range = max - min + 1;
  if (range <= 0) return min;
  const a = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / range) * range;
  do crypto.getRandomValues(a); while (a[0] >= limit);
  return min + (a[0] % range);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = arr => arr[randInt(0, arr.length - 1)];

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

let audioCtx;
export function beep({ freq = 880, dur = 0.15, times = 1, gap = 0.12, type = 'sine', vol = 0.25 } = {}) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    let t = audioCtx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + dur);
      t += dur + gap;
    }
  } catch { /* ไม่มีเสียงก็ไม่เป็นไร */ }
}

export function download(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// CSV พร้อม BOM เพื่อให้ Excel แสดงภาษาไทยถูกต้อง
export function toCSV(rows) {
  const cell = v => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('คัดลอกแล้ว ✓'); }
  catch { toast('คัดลอกไม่สำเร็จ'); }
}

export function toggleFullscreen(el) {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else el.requestFullscreen?.().catch(() => toast('เบราว์เซอร์นี้ไม่รองรับเต็มจอ'));
}

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function thaiDate(iso) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

export const parseNames = text => text.split(/\r?\n/).map(s => s.replace(/^\s*\d+[.)\s]+/, '').trim()).filter(Boolean);

export const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4', '#e11d48'];

export function noStudents() {
  return `<div class="card empty-state">
    <p>ยังไม่มีรายชื่อนักเรียนในห้องนี้</p>
    <a class="btn btn-primary" href="#/classes">➕ เพิ่มรายชื่อนักเรียน</a>
  </div>`;
}

export function pageHead(title, extra = '') {
  return `<div class="page-head">
    <div><a class="back no-print" href="#/">← เครื่องมือทั้งหมด</a><h1>${title}</h1></div>
    <div class="row">${extra}</div>
  </div>`;
}

