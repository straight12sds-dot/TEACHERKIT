// ที่เก็บข้อมูลกลาง — บันทึกลง localStorage ของเบราว์เซอร์เท่านั้น ไม่ส่งข้อมูลออกไปที่ใด
const KEY = 'teacherkit:v1';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const SAMPLE = [
  'ด.ช. กิตติ ใจดี', 'ด.ญ. ขวัญใจ รักเรียน', 'ด.ช. คณิน เก่งกล้า', 'ด.ญ. จิราพร มีสุข',
  'ด.ช. ชยพล ศรีสวัสดิ์', 'ด.ญ. ณัฐธิดา แก้วใส', 'ด.ช. ธนากร พากเพียร', 'ด.ญ. นภัสสร ทองดี',
  'ด.ช. ปกรณ์ สายบุญ', 'ด.ญ. พิมพ์ชนก ดวงแก้ว', 'ด.ช. ภูมิ รุ่งเรือง', 'ด.ญ. มนัสนันท์ ใจงาม',
  'ด.ช. ยศพล ชัยมงคล', 'ด.ญ. รินรดา สุขใจ', 'ด.ช. วรวิทย์ ปัญญาดี', 'ด.ญ. ศิริวรรณ บุญมา',
];

function defaultState() {
  const id = uid();
  return {
    version: 1,
    currentId: id,
    classes: [{ id, name: 'ห้องตัวอย่าง ม.1/1', students: SAMPLE.map(name => ({ id: uid(), name })) }],
    attendance: {}, // classId -> { 'YYYY-MM-DD': { studentId: 'P'|'L'|'E'|'A' } }
    grades: {},     // classId -> { max, scores: { studentId: number } }
    seating: {},    // classId -> { rows, cols, seats: [studentId|null] }
    tools: {},      // พื้นที่เก็บค่าตั้งของแต่ละเครื่องมือ
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.classes)) return null;
    return { ...defaultState(), ...s };
  } catch { return null; }
}

export const state = load() || defaultState();
if (!state.classes.length) state.classes.push({ id: uid(), name: 'ห้องเรียนใหม่', students: [] });
if (!state.classes.find(c => c.id === state.currentId)) state.currentId = state.classes[0].id;

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* โหมดส่วนตัว/พื้นที่เต็ม */ }
  listeners.forEach(fn => fn());
}

export const currentClass = () => state.classes.find(c => c.id === state.currentId) || state.classes[0];
export const students = () => currentClass().students;

export function setCurrent(id) { state.currentId = id; save(); }

export function addClass(name, names = []) {
  const c = { id: uid(), name: name || 'ห้องเรียนใหม่', students: names.map(n => ({ id: uid(), name: n })) };
  state.classes.push(c);
  state.currentId = c.id;
  save();
  return c;
}

export function deleteClass(id) {
  state.classes = state.classes.filter(c => c.id !== id);
  for (const k of ['attendance', 'grades', 'seating']) delete state[k][id];
  if (!state.classes.length) state.classes.push({ id: uid(), name: 'ห้องเรียนใหม่', students: [] });
  if (!state.classes.find(c => c.id === state.currentId)) state.currentId = state.classes[0].id;
  save();
}

// ค่าตั้งของเครื่องมือ (ต่อห้องเรียน หรือรวม)
export function toolData(name, fallback) {
  if (!(name in state.tools)) state.tools[name] = fallback;
  return state.tools[name];
}

export function exportAll() { return JSON.stringify(state, null, 2); }

export function importAll(json) {
  const s = JSON.parse(json);
  if (!s || !Array.isArray(s.classes) || !s.classes.length) throw new Error('ไฟล์ไม่ถูกต้อง');
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, defaultState(), s);
  if (!state.classes.find(c => c.id === state.currentId)) state.currentId = state.classes[0].id;
  save();
}
