// ═══════════════════════════════════════════════════════════════
//  KEPFIN FINANCE — app.js
//  Firebase + รายรับ/รายจ่าย logic
// ═══════════════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc,
  collection, getDocs, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase config ──────────────────────────────────────────
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAltWpihSEs9-DyKY4CmWsI0vVSgH8k1jc",
  authDomain: "repo-cc3b7.firebaseapp.com",
  projectId: "repo-cc3b7",
  storageBucket: "repo-cc3b7.firebasestorage.app",
  messagingSenderId: "576083682172",
  appId: "1:576083682172:web:cdaaec86029a2cdd34baf9",
  measurementId: "G-QKDNC7HB4Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db  = getFirestore(app);

// ── STATE ────────────────────────────────────────────────────
let currentUser = null;
// transactions: { id, type:'income'|'expense', amount, category, note, date }
let localUD = { transactions: [] };

function getUD()           { return localUD; }
async function saveUD(d)   { localUD = d; await setDoc(doc(db, 'financeData', currentUser.email), d); }

// ── HELPERS ──────────────────────────────────────────────────
function formatDate(iso) {
  const d = new Date(iso);
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

function thisMonthKey() {
  const n = new Date();
  return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
}

function monthKey(iso) { return iso.slice(0, 7); }

function todayISO() { return new Date().toISOString().slice(0, 10); }

// ── AUTH ─────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.login-tab').forEach((t, i) =>
    t.classList.toggle('active', (i === 0) === (tab === 'signin')));
  document.getElementById('tab-signin').classList.toggle('active', tab === 'signin');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
}
window.switchTab = switchTab;

async function doLogin() {
  const email = document.getElementById('si-email').value.trim().toLowerCase();
  const pass  = document.getElementById('si-pass').value;
  const err   = document.getElementById('si-err');
  err.style.display = 'none';
  if (!email || !pass) { err.style.display = 'block'; err.textContent = 'กรุณากรอกอีเมลและรหัสผ่าน'; return; }
  try {
    const ref  = doc(db, 'users', email);
    const snap = await getDoc(ref);
    if (!snap.exists() || snap.data().password !== pass) {
      err.style.display = 'block'; err.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'; return;
    }
    await updateDoc(ref, { lastLogin: serverTimestamp() });
    currentUser = { email, ...snap.data() };
    await loadUserData();
  } catch(e) { err.style.display = 'block'; err.textContent = 'เกิดข้อผิดพลาด: ' + e.message; }
}
window.doLogin = doLogin;

async function doSignup() {
  const fname = document.getElementById('su-fname').value.trim();
  const lname = document.getElementById('su-lname').value.trim();
  const email = document.getElementById('su-email').value.trim().toLowerCase();
  const pass  = document.getElementById('su-pass').value;
  const err   = document.getElementById('su-err');
  err.style.display = 'none';
  if (!fname || !lname || !email || pass.length < 6) {
    err.style.display = 'block'; err.textContent = 'กรุณากรอกข้อมูลให้ครบและรหัสผ่านอย่างน้อย 6 ตัว'; return;
  }
  try {
    const ref  = doc(db, 'users', email);
    const snap = await getDoc(ref);
    if (snap.exists()) { err.style.display = 'block'; err.textContent = 'อีเมลนี้ถูกใช้แล้ว'; return; }
    const userData = { fname, lname, email, password: pass, role: 'member', createdAt: serverTimestamp(), lastLogin: serverTimestamp() };
    await setDoc(ref, userData);
    currentUser = { email, fname, lname, role: 'member' };
    localUD = { transactions: [] };
    await setDoc(doc(db, 'financeData', email), localUD);
    enterDash();
  } catch(e) { err.style.display = 'block'; err.textContent = 'เกิดข้อผิดพลาด: ' + e.message; }
}
window.doSignup = doSignup;

async function loadUserData() {
  const snap = await getDoc(doc(db, 'financeData', currentUser.email));
  // migrate: ถ้ามีข้อมูล savings เก่าให้แปลงเป็น transactions
  if (snap.exists()) {
    const data = snap.data();
    if (data.transactions) {
      localUD = data;
    } else if (data.savings) {
      localUD = {
        transactions: data.savings.map(s => ({
          id: s.id, type: 'income', amount: s.amount,
          category: '💰', note: s.note || 'ออมเงิน', date: s.date
        }))
      };
    } else {
      localUD = { transactions: [] };
    }
  } else {
    localUD = { transactions: [] };
  }
  enterDash();
}

function enterDash() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('dash-page').classList.add('show');
  const name = currentUser.fname || currentUser.email.split('@')[0];
  document.getElementById('sb-avatar').textContent = name.slice(0, 2).toUpperCase();
  document.getElementById('sb-name').textContent = (currentUser.fname || '') + ' ' + (currentUser.lname || '');
  document.getElementById('sb-email').textContent = currentUser.email;
  renderAll();
}

function doLogout() {
  currentUser = null; localUD = { transactions: [] };
  document.getElementById('dash-page').classList.remove('show');
  document.getElementById('login-page').style.display = 'flex';
}
window.doLogout = doLogout;

// ── NAVIGATION ───────────────────────────────────────────────
function navClick(btn, page) {
  document.querySelectorAll('.sb-link').forEach(l => l.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const titles = { overview:'ภาพรวมรายรับ-รายจ่าย', transactions:'รายการทั้งหมด', members:'สมาชิกโปรเจค' };
  if (page) {
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
    document.querySelector('.topbar-title').textContent = titles[page] || page;
    if (page === 'members') renderMembersPage();
    if (page === 'transactions') renderTransactionsPage();
  }
}
window.navClick = navClick;

// ── RENDER ALL ───────────────────────────────────────────────
function renderAll() {
  const d = getUD();
  renderOverview(d);
  renderRecentTx(d);
}

// ── OVERVIEW ─────────────────────────────────────────────────
function renderOverview(d) {
  const mk    = thisMonthKey();
  const txAll = d.transactions || [];

  const totalIncome  = txAll.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = txAll.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance      = totalIncome - totalExpense;

  const monthIncome  = txAll.filter(t => t.type === 'income'  && monthKey(t.date) === mk).reduce((s, t) => s + t.amount, 0);
  const monthExpense = txAll.filter(t => t.type === 'expense' && monthKey(t.date) === mk).reduce((s, t) => s + t.amount, 0);
  const monthBalance = monthIncome - monthExpense;

  // hero cards
  setEl('ov-income',  '฿' + totalIncome.toLocaleString());
  setEl('ov-expense', '฿' + totalExpense.toLocaleString());
  const balEl = document.getElementById('ov-balance');
  if (balEl) { balEl.textContent = (balance >= 0 ? '+' : '') + '฿' + balance.toLocaleString(); balEl.className = 'hero-val ' + (balance >= 0 ? 'green' : 'red'); }

  setEl('ov-m-income',  '฿' + monthIncome.toLocaleString());
  setEl('ov-m-expense', '฿' + monthExpense.toLocaleString());
  const mbalEl = document.getElementById('ov-m-balance');
  if (mbalEl) { mbalEl.textContent = (monthBalance >= 0 ? '+' : '') + '฿' + monthBalance.toLocaleString(); mbalEl.className = 'hero-val ' + (monthBalance >= 0 ? 'green' : 'red'); }

  // greeting
  const name = currentUser?.fname || 'คุณ';
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'อรุณสวัสดิ์' : hr < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  setEl('greeting-name', greet + ', ' + name + ' 👋');

  const today = todayISO();
  const todayIncome  = txAll.filter(t => t.type === 'income'  && t.date === today).reduce((s, t) => s + t.amount, 0);
  const todayExpense = txAll.filter(t => t.type === 'expense' && t.date === today).reduce((s, t) => s + t.amount, 0);
  setEl('greeting-sub', `วันนี้: รับ ฿${todayIncome.toLocaleString()} · จ่าย ฿${todayExpense.toLocaleString()}`);

  // category breakdown (expense, this month)
  renderCatBreakdown(txAll.filter(t => t.type === 'expense' && monthKey(t.date) === mk));
}

function renderCatBreakdown(expenses) {
  const map = {};
  expenses.forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const el = document.getElementById('cat-breakdown');
  if (!el) return;
  if (sorted.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🗂️</div><div class="empty-title">ยังไม่มีค่าใช้จ่ายเดือนนี้</div></div>';
    return;
  }
  el.innerHTML = sorted.map(([cat, amt]) => `
    <div class="cat-item">
      <div class="cat-icon">${cat}</div>
      <div class="cat-name">${CAT_LABELS[cat] || cat}</div>
      <div class="cat-amt">฿${amt.toLocaleString()}</div>
    </div>`).join('');
}

// ── RECENT TX (overview card) ────────────────────────────────
function renderRecentTx(d) {
  const list = document.getElementById('tx-list');
  const sub  = document.getElementById('tx-sub');
  if (!list) return;
  const txAll = (d.transactions || []);
  sub.textContent = 'ทั้งหมด ' + txAll.length + ' รายการ';
  if (txAll.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">💳</div><div class="empty-title">ยังไม่มีรายการ</div><div class="empty-text">กด "+ รายรับ" หรือ "+ รายจ่าย" เพื่อเริ่มต้น</div></div>`;
    return;
  }
  list.innerHTML = '';
  [...txAll].reverse().slice(0, 20).forEach(t => {
    const isIn = t.type === 'income';
    const el   = document.createElement('div');
    el.className = 'tx-item';
    el.innerHTML = `
      <div class="tx-icon ${isIn ? 'income' : 'expense'}">${t.category || (isIn ? '💚' : '🔴')}</div>
      <div class="tx-info">
        <div class="tx-name">${t.note || (isIn ? 'รายรับ' : 'รายจ่าย')}</div>
        <div class="tx-meta">${formatDate(t.date)} <span class="tx-type-badge ${isIn ? 'in' : 'out'}">${isIn ? 'รับ' : 'จ่าย'}</span></div>
      </div>
      <div class="tx-amt ${isIn ? 'pos' : 'neg'}">${isIn ? '+' : '-'}฿${t.amount.toLocaleString()}</div>`;
    list.appendChild(el);
  });
}

// ── TRANSACTIONS PAGE ────────────────────────────────────────
function renderTransactionsPage() {
  const d     = getUD();
  const txAll = d.transactions || [];

  // populate month filter
  const monthSel = document.getElementById('tp-filter-month');
  if (monthSel) {
    const months = [...new Set(txAll.map(t => monthKey(t.date)))].sort().reverse();
    monthSel.innerHTML = '<option value="">📅 ทุกเดือน</option>';
    months.forEach(m => {
      const [y, mo] = m.split('-');
      const thaiY   = parseInt(y) + 543;
      const MONTHS  = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = MONTHS[parseInt(mo)] + ' ' + thaiY;
      monthSel.appendChild(opt);
    });
  }
  filterAndRenderTxPage();
}
window.renderTransactionsPage = renderTransactionsPage;

function filterAndRenderTxPage() {
  const d      = getUD();
  const txAll  = d.transactions || [];
  const fType  = document.getElementById('tp-filter-type')?.value  || '';
  const fMonth = document.getElementById('tp-filter-month')?.value || '';
  const fCat   = document.getElementById('tp-filter-cat')?.value   || '';

  let filtered = txAll;
  if (fType)  filtered = filtered.filter(t => t.type === fType);
  if (fMonth) filtered = filtered.filter(t => monthKey(t.date) === fMonth);
  if (fCat)   filtered = filtered.filter(t => t.category === fCat);

  const income  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  setEl('tp-income',  '฿' + income.toLocaleString());
  setEl('tp-expense', '฿' + expense.toLocaleString());
  const balEl = document.getElementById('tp-balance');
  const bal   = income - expense;
  if (balEl) { balEl.textContent = (bal >= 0 ? '+' : '') + '฿' + bal.toLocaleString(); balEl.className = 'sum-val balance ' + (bal >= 0 ? 'pos' : 'neg'); }

  const list = document.getElementById('tp-tx-list');
  if (!list) return;
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">💳</div><div class="empty-title">ไม่พบรายการ</div><div class="empty-text">ลองเปลี่ยนตัวกรอง</div></div>';
    return;
  }
  list.innerHTML = '';
  [...filtered].sort((a, b) => b.date.localeCompare(a.date)).forEach(t => {
    const isIn = t.type === 'income';
    const el   = document.createElement('div');
    el.className = 'tx-item';
    el.innerHTML = `
      <div class="tx-icon ${isIn ? 'income' : 'expense'}">${t.category || (isIn ? '💚' : '🔴')}</div>
      <div class="tx-info">
        <div class="tx-name">${t.note || (isIn ? 'รายรับ' : 'รายจ่าย')}</div>
        <div class="tx-meta">${formatDate(t.date)} <span class="tx-type-badge ${isIn ? 'in' : 'out'}">${isIn ? 'รับ' : 'จ่าย'}</span></div>
      </div>
      <div class="tx-amt ${isIn ? 'pos' : 'neg'}">${isIn ? '+' : '-'}฿${t.amount.toLocaleString()}</div>`;
    list.appendChild(el);
  });
}
window.filterAndRenderTxPage = filterAndRenderTxPage;

// ── MEMBERS PAGE ─────────────────────────────────────────────
async function renderMembersPage() {
  try {
    const snap  = await getDocs(collection(db, 'users'));
    const users = [];
    snap.forEach(d => users.push({ email: d.id, ...d.data() }));
    users.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

    setEl('mem-count', users.length);
    let totalTx = 0, totalIncome = 0;

    // gather finance data for each user
    const tbody = document.getElementById('members-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    for (const u of users) {
      const fd = await getDoc(doc(db, 'financeData', u.email));
      const txs = fd.exists() ? (fd.data().transactions || []) : [];
      const inc = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const exp = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      totalTx += txs.length; totalIncome += inc;
      const isYou = u.email === currentUser.email;
      const initials = ((u.fname||'?').slice(0,1) + (u.lname||'?').slice(0,1)).toUpperCase();
      const joinDate = u.createdAt?.toDate ? formatDate(u.createdAt.toDate().toISOString().slice(0,10)) : '—';
      const loginDate = u.lastLogin?.toDate ? formatDate(u.lastLogin.toDate().toISOString().slice(0,10)) : '—';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><div class="member-info"><div class="member-avatar">${initials}</div><div><div class="member-name">${u.fname||''} ${u.lname||''}${isYou?'<span class="you-tag">คุณ</span>':''}</div><div class="member-email">${u.email}</div></div></div></td>
        <td><span class="badge-role ${u.role==='admin'?'badge-admin':'badge-member'}">${u.role==='admin'?'👑 Admin':'👤 Member'}</span></td>
        <td>${joinDate}</td>
        <td class="member-stat" style="color:var(--accent)">฿${inc.toLocaleString()}</td>
        <td class="member-stat" style="color:var(--red)">฿${exp.toLocaleString()}</td>
        <td class="member-stat">${txs.length}</td>
        <td>${loginDate}</td>`;
      tbody.appendChild(tr);
    }
    setEl('mem-total', '฿' + totalIncome.toLocaleString());
    setEl('mem-tx',    totalTx + ' รายการ');
  } catch(e) { console.error(e); }
}

// ── MODAL: ADD TRANSACTION ───────────────────────────────────
let modalType = 'income'; // 'income' | 'expense'

function openTxModal(type) {
  modalType = type || 'income';
  const modal = document.getElementById('tx-modal');
  modal.classList.add('open');
  // update UI
  const titleEl = document.getElementById('tx-modal-title');
  const subEl   = document.getElementById('tx-modal-sub');
  const confirmBtn = document.getElementById('tx-modal-confirm');
  const incBtn  = document.getElementById('type-btn-income');
  const expBtn  = document.getElementById('type-btn-expense');
  incBtn.className  = 'type-btn' + (modalType === 'income'  ? ' active-income'  : '');
  expBtn.className  = 'type-btn' + (modalType === 'expense' ? ' active-expense' : '');
  if (modalType === 'income')  { titleEl.textContent = 'บันทึกรายรับ'; subEl.textContent = 'เงินเข้าบัญชีหรือได้รับวันนี้'; confirmBtn.style.background = 'var(--accent)'; }
  else                         { titleEl.textContent = 'บันทึกรายจ่าย'; subEl.textContent = 'เงินออกหรือค่าใช้จ่ายวันนี้'; confirmBtn.style.background = 'var(--red)'; }
  // update category options
  refreshCatSelect(modalType);
  document.getElementById('tx-amount').focus();
}
window.openTxModal = openTxModal;

function switchModalType(type) {
  modalType = type;
  const incBtn = document.getElementById('type-btn-income');
  const expBtn = document.getElementById('type-btn-expense');
  incBtn.className  = 'type-btn' + (type === 'income'  ? ' active-income'  : '');
  expBtn.className  = 'type-btn' + (type === 'expense' ? ' active-expense' : '');
  const titleEl = document.getElementById('tx-modal-title');
  const subEl   = document.getElementById('tx-modal-sub');
  const confirmBtn = document.getElementById('tx-modal-confirm');
  if (type === 'income')  { titleEl.textContent = 'บันทึกรายรับ'; subEl.textContent = 'เงินเข้าบัญชีหรือได้รับวันนี้'; confirmBtn.style.background = 'var(--accent)'; }
  else                    { titleEl.textContent = 'บันทึกรายจ่าย'; subEl.textContent = 'เงินออกหรือค่าใช้จ่ายวันนี้'; confirmBtn.style.background = 'var(--red)'; }
  refreshCatSelect(type);
}
window.switchModalType = switchModalType;

function closeTxModal() {
  document.getElementById('tx-modal').classList.remove('open');
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-note').value   = '';
  document.getElementById('tx-date').value   = '';
}
window.closeTxModal = closeTxModal;

async function saveTx() {
  const amt = parseFloat(document.getElementById('tx-amount').value);
  if (!amt || amt <= 0) { document.getElementById('tx-amount').style.borderColor = 'var(--red)'; return; }
  document.getElementById('tx-amount').style.borderColor = '';
  const d = getUD();
  const dateVal = document.getElementById('tx-date').value || todayISO();
  d.transactions.push({
    id:       Date.now().toString(),
    type:     modalType,
    amount:   amt,
    category: document.getElementById('tx-cat').value,
    note:     document.getElementById('tx-note').value.trim(),
    date:     dateVal
  });
  await saveUD(d);
  renderAll();
  closeTxModal();
  const label = modalType === 'income' ? 'รายรับ' : 'รายจ่าย';
  showToast(`บันทึก${label} ฿${amt.toLocaleString()} เรียบร้อย ${modalType === 'income' ? '💚' : '🧾'}`);
}
window.saveTx = saveTx;

// ── CATEGORIES ───────────────────────────────────────────────
const CAT_INCOME = ['💵','💼','🏦','🎁','📈','💰','🌟'];
const CAT_EXPENSE = ['🍔','🚌','🛍️','🏥','🎮','📱','🏠','📚','💊','🌟'];
const CAT_LABELS = {
  '💵':'เงินเดือน','💼':'รายได้จากงาน','🏦':'ดอกเบี้ย/ลงทุน','🎁':'รับของขวัญ/เงินพิเศษ',
  '📈':'ผลตอบแทน','💰':'อื่นๆ (รายรับ)','🌟':'อื่นๆ',
  '🍔':'อาหาร & เครื่องดื่ม','🚌':'เดินทาง','🛍️':'ช้อปปิ้ง','🏥':'สุขภาพ',
  '🎮':'บันเทิง','📱':'โทรศัพท์ & อินเทอร์เน็ต','🏠':'ค่าที่พัก & สาธารณูปโภค',
  '📚':'การศึกษา','💊':'ยา & วิตามิน'
};

function refreshCatSelect(type) {
  const sel  = document.getElementById('tx-cat');
  const cats = type === 'income' ? CAT_INCOME : CAT_EXPENSE;
  sel.innerHTML = cats.map(c => `<option value="${c}">${c} ${CAT_LABELS[c]||c}</option>`).join('');
}

// ── EXPORT CSV ───────────────────────────────────────────────
function exportCSV() {
  const d = getUD();
  const txAll = d.transactions || [];
  if (txAll.length === 0) { showToast('ยังไม่มีข้อมูลให้ export'); return; }
  const rows = [['วันที่','ประเภท','จำนวนเงิน (บาท)','หมวดหมู่','หมายเหตุ']];
  txAll.forEach(t => {
    rows.push([t.date, t.type === 'income' ? 'รายรับ' : 'รายจ่าย', t.amount, CAT_LABELS[t.category] || t.category, t.note || '']);
  });
  const csv  = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'KEPFIN_finance_' + todayISO() + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('Export CSV เรียบร้อย 📥');
}
window.exportCSV = exportCSV;

// ── TOAST ────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
window.showToast = showToast;

// ── UTIL ─────────────────────────────────────────────────────
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}