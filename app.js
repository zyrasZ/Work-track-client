// ===== DATA LAYER — localStorage only (client version) =====
let _data = { attendance: [], expenses: [], settings: {} };

function loadData() {
  try {
    _data = {
      attendance: JSON.parse(localStorage.getItem('wt_attendance') || '[]'),
      expenses:   JSON.parse(localStorage.getItem('wt_expenses')   || '[]'),
      settings:   JSON.parse(localStorage.getItem('wt_settings')   || '{}'),
    };
  } catch { _data = { attendance: [], expenses: [], settings: {} }; }
}

function saveData() {
  localStorage.setItem('wt_attendance', JSON.stringify(_data.attendance));
  localStorage.setItem('wt_expenses',   JSON.stringify(_data.expenses));
  localStorage.setItem('wt_settings',   JSON.stringify(_data.settings));
}

const DB = {
  get:    (key) => _data[key] ?? [],
  set:    (key, val) => { _data[key] = val; saveData(); },
  getObj: (key) => _data[key] ?? {},
};

// ===== UTILS =====
const $ = id => document.getElementById(id);
const fmt = n => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
const fmtNum = n => new Intl.NumberFormat('vi-VN').format(n);
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function formatHours(h) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h${mins}m` : `${hrs}h`;
}

const STATUS_MAP = {
  normal:   { label: 'Bình thường', cls: 'badge-green'  },
  overtime: { label: 'Tăng ca',     cls: 'badge-purple' },
  leave:    { label: 'Nghỉ phép',   cls: 'badge-gray'   },
};

const CAT_MAP = {
  food:          { label: 'Ăn uống',   icon: '🍜', color: '#c49a3c' },
  transport:     { label: 'Di chuyển', icon: '🚗', color: '#5b7fa6' },
  shopping:      { label: 'Mua sắm',   icon: '🛍️', color: '#8b6fa8' },
  health:        { label: 'Sức khoẻ',  icon: '💊', color: '#6a9e7f' },
  entertainment: { label: 'Giải trí',  icon: '🎮', color: '#c4784a' },
  bill:          { label: 'Hoá đơn',   icon: '📄', color: '#8a7f74' },
  other:         { label: 'Khác',      icon: '📦', color: '#b5aa9e' },
};

let toastTimer;
function showToast(msg, type = 'success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = 'toast', 3000);
}

// ===== CLOCK =====
function updateClock() {
  const now = new Date();
  $('live-clock').textContent = now.toLocaleTimeString('vi-VN');
  $('current-date').textContent = now.toLocaleDateString('vi-VN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}
setInterval(updateClock, 1000);
updateClock();

// ===== NAVIGATION =====
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    $(`tab-${tab}`).classList.add('active');
    const titles = { dashboard: 'Tổng quan', attendance: 'Chấm công', expense: 'Chi tiêu', report: 'Báo cáo', settings: 'Cài đặt' };
    $('page-title').textContent = titles[tab];
    if (tab === 'dashboard')  renderDashboard();
    if (tab === 'attendance') renderAttendanceTable();
    if (tab === 'expense')    renderExpenseTable();
    if (tab === 'report')     renderReport();
    if (tab === 'settings')   loadSettings();
  });
});

// ===== WAGE =====
function getCurrentWage() { return parseFloat(DB.getObj('settings').wage) || 0; }

function setWage(val) {
  const s = DB.getObj('settings');
  s.wage = val;
  DB.set('settings', s);
  updateWageUI();
}

function updateWageUI() {
  const wage = getCurrentWage();
  $('wage-display').textContent = wage ? fmtNum(wage) + 'đ/giờ' : 'Chưa đặt';
  if ($('wage-custom')) $('wage-custom').value = wage || '';
  document.querySelectorAll('.wage-btn').forEach(b => {
    b.classList.toggle('active', parseFloat(b.dataset.wage) === wage);
  });
}

document.querySelectorAll('.wage-btn').forEach(btn => {
  btn.addEventListener('click', () => setWage(parseFloat(btn.dataset.wage)));
});
$('wage-custom').addEventListener('input', () => {
  const v = parseFloat($('wage-custom').value);
  if (v > 0) setWage(v);
});

// ===== ATTENDANCE SUMMARY =====
function renderAttSummary(records) {
  const workRecs    = records.filter(r => r.status !== 'leave');
  const totalHours  = workRecs.reduce((s, r) => s + r.hours, 0);
  const totalIncome = workRecs.reduce((s, r) => s + r.hours * (r.wage || getCurrentWage()), 0);
  const offDays     = records.filter(r => r.status === 'leave').length;
  const overtime    = records.filter(r => r.status === 'overtime').length;
  const avgHours    = workRecs.length ? totalHours / workRecs.length : 0;
  $('sum-days').textContent     = workRecs.length;
  $('sum-hours').textContent    = formatHours(totalHours);
  $('sum-off').textContent      = offDays;
  $('sum-income').textContent   = fmt(totalIncome);
  $('sum-avg').textContent      = workRecs.length ? formatHours(avgHours) : '—';
  $('sum-overtime').textContent = overtime + ' ngày';
  $('sum-wage').textContent     = getCurrentWage() ? fmt(getCurrentWage()) + '/giờ' : 'Chưa đặt';
}

// ===== ATTENDANCE TABLE =====
function renderAttendanceTable() {
  const month = $('attendance-month-filter').value || thisMonth();
  const records = DB.get('attendance').filter(r => r.date.startsWith(month));
  records.sort((a, b) => b.date.localeCompare(a.date));

  const totalHours  = records.filter(r => r.status !== 'leave').reduce((s, r) => s + r.hours, 0);
  const totalIncome = records.filter(r => r.status !== 'leave').reduce((s, r) => s + r.hours * (r.wage || getCurrentWage()), 0);
  $('att-month-summary').textContent = `${records.length} ngày | ${formatHours(totalHours)} | ${fmt(totalIncome)}`;

  renderAttSummary(records);
  renderAttCalendar(month, records);

  const tbody = $('attendance-table').querySelector('tbody');
  tbody.innerHTML = records.length
    ? records.map(r => {
        const d = new Date(r.date + 'T00:00:00');
        const s = STATUS_MAP[r.status] || STATUS_MAP.normal;
        const w = r.wage || getCurrentWage();
        const income = r.status !== 'leave' ? r.hours * w : 0;
        return `<tr>
          <td>${r.date}</td>
          <td>${dayNames[d.getDay()]}</td>
          <td>${r.status !== 'leave' ? formatHours(r.hours) : '—'}</td>
          <td>${fmt(w)}</td>
          <td class="text-green">${r.status !== 'leave' ? fmt(income) : '—'}</td>
          <td><span class="badge ${s.cls}">${s.label}</span></td>
          <td>${r.note || ''}</td>
          <td><button class="btn-icon" onclick="deleteAttendance(${r.id})">🗑️</button></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:20px">Không có dữ liệu</td></tr>';
}

// ===== CALENDAR =====
function renderAttCalendar(month, records) {
  const [y, m] = month.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const recordMap = {};
  records.forEach(r => { recordMap[r.date] = r; });

  let html = '<div class="att-calendar-grid">';
  ['CN','T2','T3','T4','T5','T6','T7'].forEach(d => {
    html += `<div class="cal-header-cell">${d}</div>`;
  });
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2,'0')}`;
    const rec = recordMap[dateStr];
    const isToday = dateStr === today();
    let cls = 'cal-day clickable';
    if (rec) cls += rec.status === 'leave' ? ' has-off' : ' has-work';
    if (isToday) cls += ' today-mark';
    html += `<div class="${cls}" onclick="openCalPopup('${dateStr}')"><span class="cal-day-num">${d}</span>`;
    if (rec && rec.status !== 'leave') {
      const w = rec.wage || getCurrentWage();
      html += `<span class="cal-day-hours">${formatHours(rec.hours)}</span>`;
      if (w) html += `<span class="cal-day-income">${fmtNum(Math.round(rec.hours * w / 1000))}k</span>`;
    } else if (rec && rec.status === 'leave') {
      html += `<span class="cal-day-off">OFF</span>`;
    }
    html += '</div>';
  }
  html += '</div>';
  $('att-calendar').innerHTML = html;
}

// ===== CALENDAR POPUP =====
window.openCalPopup = (dateStr) => {
  const existing  = DB.get('attendance').find(r => r.date === dateStr);
  const [y, m, d] = dateStr.split('-');
  const isOff     = existing?.status === 'leave';
  const curHours  = existing?.hours || '';
  const curStatus = existing?.status || 'normal';
  const curNote   = existing?.note || '';

  const overlay = document.createElement('div');
  overlay.className = 'cal-popup-overlay';
  overlay.innerHTML = `
    <div class="cal-popup" onclick="event.stopPropagation()">
      <div class="cal-popup-header">
        <span>📅 ${d}/${m}/${y}</span>
        <button class="cal-popup-close" onclick="this.closest('.cal-popup-overlay').remove()">✕</button>
      </div>
      <div class="cal-popup-toggle">
        <button class="day-type-btn ${!isOff?'active':''}" data-type="work">✅ Đi làm</button>
        <button class="day-type-btn ${isOff?'active':''}" data-type="off">🔴 Nghỉ (OFF)</button>
      </div>
      <div id="pop-work-fields" style="${isOff?'display:none':''}">
        <div class="cal-popup-hours">
          ${[6,7,8,9].map(h=>`<button class="hours-btn pop-h-btn ${curHours==h?'active':''}" data-h="${h}">${h}h</button>`).join('')}
        </div>
        <input type="number" id="pop-hours" class="input" style="margin-top:8px" placeholder="Hoặc nhập số giờ..." min="0.5" max="24" step="0.5" value="${curHours}" />
        <select id="pop-status" class="input" style="margin-top:8px">
          <option value="normal" ${curStatus==='normal'?'selected':''}>Bình thường</option>
          <option value="overtime" ${curStatus==='overtime'?'selected':''}>Tăng ca</option>
        </select>
      </div>
      <div id="pop-off-badge" style="${isOff?'':'display:none'}">
        <div class="off-display">🔴 OFF — Ngày nghỉ</div>
      </div>
      <input type="text" id="pop-note" class="input" style="margin-top:8px" placeholder="Ghi chú..." value="${curNote}" />
      <div class="cal-popup-actions">
        ${existing?`<button class="btn btn-danger btn-sm" onclick="deleteCalDay('${dateStr}')">🗑️ Xoá</button>`:'<span></span>'}
        <button class="btn btn-primary" onclick="saveCalPopup('${dateStr}')">💾 Lưu</button>
      </div>
    </div>`;

  overlay.querySelectorAll('.day-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.day-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isWork = btn.dataset.type === 'work';
      overlay.querySelector('#pop-work-fields').style.display = isWork ? '' : 'none';
      overlay.querySelector('#pop-off-badge').style.display   = isWork ? 'none' : '';
    });
  });
  overlay.querySelectorAll('.pop-h-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.pop-h-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      overlay.querySelector('#pop-hours').value = btn.dataset.h;
    });
  });
  overlay.querySelector('#pop-hours')?.addEventListener('input', function() {
    overlay.querySelectorAll('.pop-h-btn').forEach(b => {
      b.classList.toggle('active', parseFloat(b.dataset.h) === parseFloat(this.value));
    });
  });
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
};

window.saveCalPopup = (dateStr) => {
  const overlay = document.querySelector('.cal-popup-overlay');
  const isOff   = overlay.querySelector('[data-type="off"]').classList.contains('active');
  const note    = overlay.querySelector('#pop-note').value.trim();
  const wage    = getCurrentWage();
  let record;
  if (isOff) {
    record = { id: Date.now(), date: dateStr, hours: 0, wage, status: 'leave', note };
  } else {
    const hours  = parseFloat(overlay.querySelector('#pop-hours').value);
    const status = overlay.querySelector('#pop-status').value;
    if (!hours || hours <= 0) { showToast('Vui lòng nhập số giờ làm', 'error'); return; }
    record = { id: Date.now(), date: dateStr, hours, wage, status, note };
  }
  const records = DB.get('attendance').filter(r => r.date !== dateStr);
  records.push(record);
  records.sort((a, b) => b.date.localeCompare(a.date));
  DB.set('attendance', records);
  overlay.remove();
  const [y, m, d] = dateStr.split('-');
  showToast(isOff ? `Đã lưu ${d}/${m}/${y} — OFF` : `Đã lưu ${d}/${m}/${y} — ${formatHours(record.hours)}`);
  renderAttendanceTable();
};

window.deleteCalDay = (dateStr) => {
  DB.set('attendance', DB.get('attendance').filter(r => r.date !== dateStr));
  document.querySelector('.cal-popup-overlay')?.remove();
  renderAttendanceTable();
  showToast('Đã xoá');
};

window.deleteAttendance = id => {
  if (!confirm('Xoá bản ghi này?')) return;
  DB.set('attendance', DB.get('attendance').filter(r => r.id !== id));
  renderAttendanceTable();
  showToast('Đã xoá');
};

$('attendance-month-filter').value = thisMonth();
$('attendance-month-filter').addEventListener('change', renderAttendanceTable);

// Export attendance as JSON
$('btn-export-attendance').addEventListener('click', () => {
  const month = $('attendance-month-filter').value || thisMonth();
  const data  = DB.get('attendance').filter(r => r.date.startsWith(month));
  const blob  = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `chamcong_${month}.json`;
  a.click();
  showToast('Đã xuất file JSON');
});

// ===== EXPENSE =====
$('expense-date').value = today();

$('btn-add-expense').addEventListener('click', () => {
  const date     = $('expense-date').value;
  const category = $('expense-category').value;
  const desc     = $('expense-desc').value.trim();
  const amount   = parseFloat($('expense-amount').value);
  const type     = $('expense-type').value;
  if (!date || !desc || isNaN(amount) || amount <= 0) { showToast('Vui lòng điền đầy đủ thông tin', 'error'); return; }
  const records = DB.get('expenses');
  records.push({ id: Date.now(), date, category, desc, amount, type });
  records.sort((a, b) => b.date.localeCompare(a.date));
  DB.set('expenses', records);
  $('expense-desc').value = $('expense-amount').value = '';
  showToast(type === 'income' ? 'Đã thêm thu nhập' : 'Đã thêm chi tiêu');
  renderExpenseTable();
});

function renderExpenseTable() {
  const month     = $('expense-month-filter').value || thisMonth();
  const catFilter = $('expense-cat-filter').value;
  let records = DB.get('expenses').filter(r => r.date.startsWith(month));
  if (catFilter) records = records.filter(r => r.category === catFilter);
  records.sort((a, b) => b.date.localeCompare(a.date));

  const tbody = $('expense-table').querySelector('tbody');
  tbody.innerHTML = records.length
    ? records.map(r => {
        const cat = CAT_MAP[r.category] || CAT_MAP.other;
        const isIncome = r.type === 'income';
        return `<tr>
          <td>${r.date}</td>
          <td>${cat.icon} ${cat.label}</td>
          <td>${r.desc}</td>
          <td><span class="badge ${isIncome?'badge-green':'badge-red'}">${isIncome?'Thu':'Chi'}</span></td>
          <td class="${isIncome?'text-green':'text-red'}">${isIncome?'+':'-'}${fmt(r.amount)}</td>
          <td><button class="btn-icon" onclick="deleteExpense(${r.id})">🗑️</button></td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text2);padding:20px">Không có dữ liệu</td></tr>';

  renderExpenseSummary();
}

function renderExpenseSummary() {
  const month   = $('expense-month-filter').value || thisMonth();
  const records = DB.get('expenses').filter(r => r.date.startsWith(month));
  const totalIncome  = records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const balance = totalIncome - totalExpense;
  $('summary-income').textContent        = fmt(totalIncome);
  $('summary-expense-total').textContent = fmt(totalExpense);
  $('summary-balance').textContent       = fmt(balance);
  $('summary-balance').className         = balance >= 0 ? 'text-green' : 'text-red';

  const catTotals = {};
  records.filter(r => r.type === 'expense').forEach(r => {
    catTotals[r.category] = (catTotals[r.category] || 0) + r.amount;
  });
  const maxVal = Math.max(...Object.values(catTotals), 1);
  $('category-breakdown').innerHTML = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat,val]) => {
    const c = CAT_MAP[cat] || CAT_MAP.other;
    const pct = Math.round(val / maxVal * 100);
    return `<div class="cat-bar-row">
      <div class="cat-bar-label"><span>${c.icon} ${c.label}</span><span>${fmt(val)}</span></div>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%;background:${c.color}"></div></div>
    </div>`;
  }).join('');
}

window.deleteExpense = id => {
  if (!confirm('Xoá bản ghi này?')) return;
  DB.set('expenses', DB.get('expenses').filter(r => r.id !== id));
  renderExpenseTable();
  showToast('Đã xoá');
};

$('expense-month-filter').value = thisMonth();
$('expense-month-filter').addEventListener('change', renderExpenseTable);
$('expense-cat-filter').addEventListener('change', renderExpenseTable);

// ===== DASHBOARD =====
function renderDashboard() {
  const month      = thisMonth();
  const attendance = DB.get('attendance').filter(r => r.date.startsWith(month));
  const expenses   = DB.get('expenses').filter(r => r.date.startsWith(month));
  const settings   = DB.getObj('settings');
  const wage       = parseFloat(settings.wage) || 0;

  $('stat-days').textContent    = attendance.filter(r => r.status !== 'leave').length;
  $('stat-hours').textContent   = formatHours(attendance.reduce((s,r) => s + r.hours, 0));
  $('stat-expense').textContent = fmt(expenses.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0));
  $('stat-income').textContent  = fmt(attendance.reduce((s,r) => s + r.hours*(r.wage||wage), 0));

  const recentAtt = [...attendance].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  $('recent-attendance').querySelector('tbody').innerHTML = recentAtt.length
    ? recentAtt.map(r => {
        const s = STATUS_MAP[r.status] || STATUS_MAP.normal;
        const w = r.wage || wage;
        return `<tr><td>${r.date}</td><td>${formatHours(r.hours)}</td><td>${fmt(r.hours*w)}</td><td><span class="badge ${s.cls}">${s.label}</span></td></tr>`;
      }).join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:16px">Chưa có dữ liệu</td></tr>';

  const recentExp = [...expenses].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  $('recent-expense').querySelector('tbody').innerHTML = recentExp.length
    ? recentExp.map(r => {
        const cat = CAT_MAP[r.category] || CAT_MAP.other;
        const isIncome = r.type === 'income';
        return `<tr><td>${r.date}</td><td>${cat.icon} ${cat.label}</td><td>${r.desc}</td><td class="${isIncome?'text-green':'text-red'}">${isIncome?'+':'-'}${fmt(r.amount)}</td></tr>`;
      }).join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--text2);padding:16px">Chưa có dữ liệu</td></tr>';
}

// ===== REPORT =====
$('report-month').value = thisMonth();

function getWeekNumber(d) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  return Math.ceil((d.getDate() + start.getDay()) / 7);
}

function renderReport() {
  const month      = $('report-month').value || thisMonth();
  const attendance = DB.get('attendance').filter(r => r.date.startsWith(month));
  const expenses   = DB.get('expenses').filter(r => r.date.startsWith(month));
  const settings   = DB.getObj('settings');
  const wage       = parseFloat(settings.wage) || 0;

  const workDays    = attendance.filter(r => r.status !== 'leave').length;
  const totalHours  = attendance.reduce((s,r) => s + r.hours, 0);
  const avgHours    = workDays ? totalHours / workDays : 0;
  const totalEarned = attendance.reduce((s,r) => s + r.hours*(r.wage||wage), 0);

  $('report-attendance-stats').innerHTML = [
    ['Tổng ngày có mặt',  attendance.length + ' ngày'],
    ['Ngày làm việc',     workDays + ' ngày'],
    ['Tổng giờ làm',      formatHours(totalHours)],
    ['Giờ làm TB/ngày',   formatHours(avgHours)],
    ['Số lần tăng ca',    attendance.filter(r=>r.status==='overtime').length],
    ['Ngày nghỉ (OFF)',   attendance.filter(r=>r.status==='leave').length],
    ['Thu nhập ước tính', fmt(totalEarned)],
  ].map(([k,v]) => `<div class="report-row"><span>${k}</span><span>${v}</span></div>`).join('');

  const totalIncome  = expenses.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const totalExpense = expenses.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  const balance      = totalIncome - totalExpense;
  const budget       = parseFloat(settings.budget) || 0;

  $('report-expense-stats').innerHTML = [
    ['Tổng thu nhập',     `<span class="text-green">${fmt(totalIncome)}</span>`],
    ['Tổng chi tiêu',     `<span class="text-red">${fmt(totalExpense)}</span>`],
    ['Số dư',             `<span class="${balance>=0?'text-green':'text-red'}">${fmt(balance)}</span>`],
    ['Ngân sách tháng',   fmt(budget)],
    ['Đã dùng ngân sách', budget ? Math.round(totalExpense/budget*100)+'%' : 'Chưa đặt'],
    ['Số giao dịch',      expenses.length],
  ].map(([k,v]) => `<div class="report-row"><span>${k}</span><span>${v}</span></div>`).join('');

  const catTotals = {};
  expenses.filter(r=>r.type==='expense').forEach(r => {
    catTotals[r.category] = (catTotals[r.category]||0) + r.amount;
  });
  const maxCat = Math.max(...Object.values(catTotals), 1);
  $('chart-container').innerHTML = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).map(([cat,val]) => {
    const c = CAT_MAP[cat] || CAT_MAP.other;
    const h = Math.round(val/maxCat*90);
    return `<div class="chart-item">
      <div class="chart-bar-wrap"><div class="chart-bar" style="height:${h}px;background:${c.color}"></div></div>
      <div class="chart-label">${c.icon}<br>${c.label}</div>
      <div class="chart-value">${fmtNum(Math.round(val/1000))}k</div>
    </div>`;
  }).join('') || '<p style="color:var(--text2);font-size:13px">Chưa có dữ liệu chi tiêu</p>';

  const weekMap = {};
  attendance.forEach(r => {
    const d = new Date(r.date+'T00:00:00');
    const w = getWeekNumber(d);
    weekMap[w] = (weekMap[w]||0) + r.hours;
  });
  const weeks = Object.entries(weekMap).sort((a,b)=>a[0]-b[0]);
  const maxH  = Math.max(...weeks.map(w=>w[1]), 1);
  $('weekly-chart').innerHTML = weeks.length
    ? weeks.map(([w,h]) => {
        const barH = Math.round(h/maxH*90);
        return `<div class="bar-item">
          <div class="bar-val">${formatHours(h)}</div>
          <div class="bar-fill" style="height:${barH}px"></div>
          <div class="bar-label">T${w}</div>
        </div>`;
      }).join('')
    : '<p style="color:var(--text2);font-size:13px">Chưa có dữ liệu</p>';
}

$('btn-gen-report').addEventListener('click', renderReport);

// ===== SETTINGS =====
function loadSettings() {
  const s = DB.getObj('settings');
  $('setting-name').value   = s.name   || '';
  $('setting-wage').value   = s.wage   || '';
  $('setting-budget').value = s.budget || '';
  updateWageUI();
  const attLen = DB.get('attendance').length;
  const expLen = DB.get('expenses').length;
  $('storage-info').innerHTML = `
    Dữ liệu lưu trong trình duyệt (localStorage)<br>
    Chấm công: <strong>${attLen}</strong> bản ghi &nbsp;|&nbsp; Chi tiêu: <strong>${expLen}</strong> bản ghi
  `;
}

$('btn-save-settings').addEventListener('click', () => {
  DB.set('settings', {
    name:   $('setting-name').value.trim(),
    wage:   parseFloat($('setting-wage').value)   || 0,
    budget: parseFloat($('setting-budget').value) || 0,
  });
  updateWageUI();
  showToast('Đã lưu cài đặt');
});

// Export all data as JSON
$('btn-export-all').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(_data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `worktrack_backup_${today()}.json`;
  a.click();
  showToast('Đã xuất dữ liệu');
});

$('import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.attendance) _data.attendance = data.attendance;
      if (data.expenses)   _data.expenses   = data.expenses;
      if (data.settings)   _data.settings   = data.settings;
      saveData();
      showToast('Đã nhập dữ liệu thành công');
      loadSettings();
      renderDashboard();
      renderAttendanceTable();
    } catch { showToast('Lỗi: File không hợp lệ', 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

$('btn-clear-data').addEventListener('click', () => {
  if (!confirm('Xoá toàn bộ dữ liệu? Hành động này không thể hoàn tác!')) return;
  _data = { attendance: [], expenses: [], settings: _data.settings };
  saveData();
  showToast('Đã xoá toàn bộ dữ liệu', 'error');
  loadSettings();
  renderDashboard();
  renderAttendanceTable();
});

// ===== INIT =====
loadData();
updateWageUI();
renderDashboard();
renderAttendanceTable();
