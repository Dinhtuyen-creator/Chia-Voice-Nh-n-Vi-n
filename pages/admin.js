import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../lib/api';

// Tất cả request dùng GET để tránh CORS
async function apiAction(action, params = {}) {
  return apiGet(action, params);
}
async function apiActionData(action, data) {
  return apiGet(action, { data: encodeURIComponent(JSON.stringify(data)) });
}

const DAYS = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
const COLORS = ['#2563eb','#16a34a','#dc2626','#ea580c','#9333ea','#0891b2','#ca8a04','#be185d'];

function fmtDate(d) {
  try {
    if (!d) { const dt = new Date(); return `${DAYS[dt.getDay()]}, ${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`; }
    const parts = String(d).split('-');
    if (parts.length !== 3) return String(d);
    const dt = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
    return `${DAYS[dt.getDay()]}, ${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
  } catch(e) { return String(d); }
}

function parseVoiceList(text) {
  return String(text || '').split(/[,\s]+/).map(v => parseInt(v, 10)).filter(Boolean);
}

function Avatar({ emp, size = 38 }) {
  const [failed, setFailed] = useState(false);
  const name = emp.name || '?';
  const initials = name.trim().split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase() || '?';
  const color = COLORS[name.charCodeAt(0) % COLORS.length] || COLORS[0];
  useEffect(() => setFailed(false), [emp.avatar]);
  if (emp.avatar && !failed) {
    return (
      <img
        src={emp.avatar}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: Math.floor(size * 0.35), flexShrink: 0 }}>
      {initials}
    </div>
  );
}

const s = {
  card: { background: '#fff', border: '1px solid #dddbd2', borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', cursor: 'pointer', borderBottom: '1px solid #dddbd2', userSelect: 'none' },
  cardTitle: { fontSize: 11, fontWeight: 700, color: '#a8a69e', textTransform: 'uppercase', letterSpacing: 1 },
  cardBody: { padding: '16px 18px' },
  inp: { background: '#f0efe9', border: '1px solid #dddbd2', borderRadius: 10, padding: '9px 12px', color: '#1a1916', fontFamily: 'inherit', fontSize: 14, outline: 'none', width: '100%' },
  btn: { padding: '8px 16px', borderRadius: 10, border: '1px solid transparent', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' },
  empRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: '#f0efe9', border: '1px solid #dddbd2', borderRadius: 10, marginBottom: 8 },
  prodRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0efe9', border: '1px solid #dddbd2', borderRadius: 10, marginBottom: 7, cursor: 'pointer' },
  planRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#eff4ff', border: '1px solid #bfcffd', borderRadius: 10, marginBottom: 7 },
  col: { minWidth: 220, width: 220, flexShrink: 0, background: '#fff', border: '1px solid #dddbd2', borderRadius: 14, overflow: 'hidden' },
  colHead: { padding: '13px 15px', borderBottom: '1px solid #dddbd2', background: '#f5f4f0', display: 'flex', alignItems: 'center', gap: 10 },
  taskRow: { padding: '11px 14px', borderBottom: '1px solid #f0efe9' },
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState('');
  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
  const [dates, setDates] = useState([]);
  const [histData, setHistData] = useState(null);
  const [selectedHistDate, setSelectedHistDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [prodLoading, setProdLoading] = useState(false);
  const [showAllProds, setShowAllProds] = useState(false);
  const [prodSearch, setProdSearch] = useState('');
  const PROD_SHOW_LIMIT = 8;

  // Form state
  const [empName, setEmpName] = useState('');
  const [empAvatar, setEmpAvatar] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [selectedProds, setSelectedProds] = useState([]);
  const [plan, setPlan] = useState({});
  const [assignDate, setAssignDate] = useState('');
  const [quotas, setQuotas] = useState({});
  const [assignResult, setAssignResult] = useState(null);
  const [assignMsg, setAssignMsg] = useState({ text: '', type: '' });
  const [collapsed, setCollapsed] = useState({ emp: false, prod: false, unassigned: true, assign: false, hist: false });
  const [dateWarning, setDateWarning] = useState(null);
  const [unassignedProducts, setUnassignedProducts] = useState([]);
  const [histEditMode, setHistEditMode] = useState(false);
  const [histAdd, setHistAdd] = useState({ empId: '', prodId: '', voices: '' });

  function toggleCollapse(key) {
    setCollapsed(c => ({ ...c, [key]: !c[key] }));
  }

  async function loadData() {
    loadProducts();
    setLoading(true);
    const [emps, dts, unassigned] = await Promise.all([apiGet('getEmployees'), apiGet('getHistory'), apiGet('getUnassignedProducts')]);
    setEmployees(Array.isArray(emps) ? emps : []);
    setDates(Array.isArray(dts) ? dts.filter(d => d && String(d).match(/^\d{4}-\d{2}-\d{2}$/)) : []);
    setUnassignedProducts(Array.isArray(unassigned) ? unassigned : []);
    const q = {};
    (Array.isArray(emps) ? emps : []).forEach(e => q[e.id] = e.quota || 10);
    setQuotas(q);
    setLoading(false);
  }

  async function loadProducts() {
    setProdLoading(true);
    const prods = await apiGet('getProducts');
    setProducts(Array.isArray(prods) ? prods : []);
    setSelectedProds([]);
    setPlan({});
    setAssignDate('');
    setProdLoading(false);
  }

  function login() {
    if (pw === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setAuthed(true);
      loadData();
    } else {
      alert('Sai mật khẩu!');
    }
  }

  const totalPlan = selectedProds.reduce((s, id) => s + (Number(plan[id]) || 0), 0);
  const activeEmps = employees.filter(e => e.active);
  const totalQuota = activeEmps.reduce((s, e) => s + (Number(quotas[e.id]) || e.quota || 0), 0);
  const unassignedDisplayProducts = unassignedProducts.map(item => {
    const prod = products.find(p => String(p.id) === String(item.id) || String(p.name) === String(item.name));
    return prod ? { ...prod, lastAssignedDate: item.lastAssignedDate || '' } : null;
  }).filter(Boolean);

  async function submitAssign(options = {}) {
    if (selectedProds.length === 0) { setAssignMsg({ text: '❌ Chưa chọn sản phẩm!', type: 'red' }); return; }
    const noVoiceProducts = selectedProds.map(id => products.find(p => p.id === id)).filter(p => p && Number(p.totalVoices) === 0);
    if (noVoiceProducts.length > 0) {
      setAssignMsg({ text: '❌ Các sản phẩm chưa có voice: ' + noVoiceProducts.map(p => p.name).join(', '), type: 'red' });
      return;
    }
    if (totalPlan === 0) { setAssignMsg({ text: '❌ Chưa nhập số voice!', type: 'red' }); return; }
    if (totalPlan !== totalQuota) {
      setAssignMsg({ text: `❌ Tổng voice (${totalPlan}) ≠ tổng quota (${totalQuota}). Lệch ${Math.abs(totalPlan - totalQuota)}!`, type: 'red' });
      return;
    }

    const planArr = selectedProds.map(id => {
      const prod = products.find(p => p.id === id);
      return { prodId: id, prodName: prod.name, driveUrl: prod.driveUrl, totalVoices: prod.totalVoices, voiceCount: Number(plan[id]) || 0 };
    }).filter(p => p.voiceCount > 0);

    const quotasArr = activeEmps.map(e => ({ empId: e.id, quota: Number(quotas[e.id]) || e.quota || 0 }));

    setLoading(true);
    const result = await apiActionData('assign', {
      plan: planArr,
      quotas: quotasArr,
      date: options.date || assignDate || undefined,
      allowOverwrite: !!options.allowOverwrite,
    });
    setLoading(false);

    if (result.warning === 'DATE_EXISTS') {
      setDateWarning({ ...result, planArr, quotasArr });
      setAssignMsg({ text: '⚠️ ' + result.message, type: 'red' });
    } else if (result.error) {
      setAssignMsg({ text: '❌ ' + result.error, type: 'red' });
    } else {
      setDateWarning(null);
      setAssignMsg({ text: `✅ Phân công thành công cho ngày ${fmtDate(result.date)}!`, type: 'green' });
      setAssignResult(result);
      loadData();
    }
  }

  async function doAssign() {
    submitAssign({ date: assignDate || undefined });
  }

  async function resolveDateWarning(mode) {
    const warning = dateWarning;
    setDateWarning(null);
    if (!warning || mode === 'cancel') return;
    if (mode === 'overwrite') await submitAssign({ date: warning.date, allowOverwrite: true });
    if (mode === 'suggested') await submitAssign({ date: warning.suggestedDate, allowOverwrite: false });
  }

  async function addEmp() {
    if (!empName.trim()) { alert('Nhập tên nhân viên!'); return; }
    const avatarBase64 = avatarPreview && avatarPreview.startsWith('data:image/') ? avatarPreview : '';
    const avatar = avatarBase64 ? '' : empAvatar.trim();
    try {
      const res = await apiPost('addEmployeeWithAvatar', { name: empName.trim(), quota: 10, avatarBase64, avatar });
      if (res.error) { alert('Lỗi: ' + res.error); return; }
      setEmpName(''); setEmpAvatar(''); setAvatarPreview('');
      loadData();
    } catch(e) {
      alert('Không kết nối được Apps Script. Kiểm tra lại URL API.');
    }
  }

  function handleAvatarPaste(e) {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (ev) => {
          // Nén ảnh xuống 80x80px để tránh base64 quá lớn
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const SIZE = 80;
            canvas.width = SIZE; canvas.height = SIZE;
            const ctx = canvas.getContext('2d');
            // Crop vuông ở giữa
            const min = Math.min(img.width, img.height);
            const sx = (img.width - min) / 2;
            const sy = (img.height - min) / 2;
            ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
            setAvatarPreview(canvas.toDataURL('image/jpeg', 0.7));
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
        e.preventDefault();
        return;
      }
    }
  }

  async function toggleEmp(emp) {
    await apiAction('updateEmployee', { id: emp.id, active: !emp.active });
    loadData();
  }

  async function delEmp(id) {
    if (!confirm('Xoá nhân viên này?')) return;
    await apiAction('deleteEmployee', { id });
    loadData();
  }

  async function updateQuota(id, val) {
    const num = Number(val);
    if (!val || !Number.isFinite(num) || num < 1) {
      const emp = employees.find(e => e.id === id);
      setQuotas(q => ({ ...q, [id]: emp?.quota || 10 }));
      return;
    }
    setQuotas(q => ({ ...q, [id]: num }));
    await apiAction('updateEmployee', { id, quota: num });
  }

  function toggleProd(id) {
    setSelectedProds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  function removePlan(id) {
    setSelectedProds(p => p.filter(x => x !== id));
    setPlan(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function showHist(date) {
    setSelectedHistDate(date);
    setHistEditMode(false);
    const data = await apiGet('getToday', { date });
    setHistData(data);
  }

  function reassignFromHistory() {
    if (!histData || !selectedHistDate) return;
    const nextPlan = {};
    Object.values(histData.byEmployee || {}).forEach(tasks => {
      (tasks || []).forEach(t => {
        nextPlan[t.productId] = (Number(nextPlan[t.productId]) || 0) + (t.voices || []).length;
      });
    });
    const ids = Object.keys(nextPlan).filter(id => products.some(p => p.id === id));
    if (ids.length === 0) { alert('Ngày này chưa có sản phẩm để phân công lại.'); return; }
    setSelectedProds(ids);
    setPlan(nextPlan);
    setAssignDate(selectedHistDate);
    setCollapsed(c => ({ ...c, assign: false }));
    setAssignMsg({ text: `✅ Đã nạp lịch ${fmtDate(selectedHistDate)} vào khung phân công lại.`, type: 'green' });
  }

  async function addHistoryTaskFromForm() {
    const empId = histAdd.empId || activeEmps[0]?.id || employees[0]?.id || '';
    const prodId = histAdd.prodId || products[0]?.id || '';
    const prod = products.find(p => p.id === prodId);
    const voices = parseVoiceList(histAdd.voices);
    if (!selectedHistDate || !empId || !prod || voices.length === 0) { alert('Chọn nhân viên, sản phẩm và nhập danh sách voice.'); return; }
    const res = await apiActionData('addHistoryTask', {
      date: selectedHistDate,
      empId,
      prodId: prod.id,
      prodName: prod.name,
      driveUrl: prod.driveUrl,
      voices,
    });
    if (res.error) { alert('Lỗi: ' + res.error); return; }
    setHistAdd(h => ({ ...h, voices: '' }));
    showHist(selectedHistDate);
    loadData();
  }

  async function editHistoryTask(date, empId, task) {
    const current = (task.voices || []).join(', ');
    const next = prompt('Nhập lại danh sách số voice:', current);
    if (next === null) return;
    const voices = parseVoiceList(next);
    if (voices.length === 0) { alert('Danh sách voice không hợp lệ.'); return; }
    const res = await apiActionData('updateHistoryTask', { date, empId, prodId: task.productId, voices });
    if (res.error) { alert('Lỗi: ' + res.error); return; }
    showHist(date);
  }

  async function deleteHistoryTask(date, empId, task) {
    if (!confirm('Xoá task này?')) return;
    const res = await apiActionData('deleteHistoryTask', { date, empId, prodId: task.productId });
    if (res.error) { alert('Lỗi: ' + res.error); return; }
    showHist(date);
    loadData();
  }

  if (!authed) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f4f0', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 340, border: '1px solid #dddbd2' }}>
        <div style={{ textAlign: 'center', fontSize: 28, marginBottom: 8 }}>🔐</div>
        <div style={{ fontWeight: 800, fontSize: 18, textAlign: 'center', marginBottom: 20 }}>Admin</div>
        <input type="password" placeholder="Mật khẩu..." value={pw}
          onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          style={{ ...s.inp, marginBottom: 10 }} />
        <button onClick={login} style={{ ...s.btn, background: '#1a1916', color: '#fff', width: '100%', justifyContent: 'center' }}>Đăng nhập</button>
      </div>
    </div>
  );

  const empMap = {};
  employees.forEach(e => empMap[e.id] = e);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono&display=swap" rel="stylesheet" />

      {/* Topbar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #dddbd2', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>⚙️ Admin</div>
        <a href="/today" target="_blank" style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, textDecoration: 'none', padding: '6px 14px', background: '#eff4ff', borderRadius: 8 }}>Xem trang nhân viên →</a>
      </div>

      <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
        {dateWarning && (
          <div style={{ ...s.card, borderColor: '#fde68a', background: '#fefce8' }}>
            <div style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ca8a04', marginBottom: 8 }}>{dateWarning.message}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button style={{ ...s.btn, background: '#dc2626', color: '#fff' }} onClick={() => resolveDateWarning('overwrite')}>Ghi đè ngày này</button>
                <button style={{ ...s.btn, background: '#2563eb', color: '#fff' }} onClick={() => resolveDateWarning('suggested')}>Chuyển sang {fmtDate(dateWarning.suggestedDate)}</button>
                <button style={{ ...s.btn, background: '#fff', color: '#6b6960', border: '1px solid #dddbd2' }} onClick={() => resolveDateWarning('cancel')}>Hủy</button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
          {[
            { n: products.length, l: 'Sản phẩm', c: '#2563eb' },
            { n: `${activeEmps.length}/${employees.length}`, l: 'NV active', c: '#16a34a' },
            { n: products.reduce((s, p) => s + p.totalVoices, 0), l: 'Tổng voice', c: '#ea580c' },
          ].map((st, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #dddbd2', borderRadius: 14, padding: '14px 18px' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: st.c }}>{st.n}</div>
              <div style={{ fontSize: 12, color: '#6b6960' }}>{st.l}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* LEFT */}
          <div>
            {/* Nhân viên */}
            <div style={s.card}>
              <div style={s.cardHead} onClick={() => toggleCollapse('emp')}>
                <div style={s.cardTitle}>👥 Nhân viên ({employees.length})</div>
                <span style={{ fontSize: 12, color: '#a8a69e', transform: collapsed.emp ? 'rotate(-90deg)' : 'none', display: 'inline-block', transition: 'transform .2s' }}>▼</span>
              </div>
              {!collapsed.emp && (
                <div style={s.cardBody}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input style={{ ...s.inp, flex: 1 }} placeholder="Tên nhân viên..." value={empName}
                        onChange={e => setEmpName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addEmp()} />
                      <button style={{ ...s.btn, background: '#1a1916', color: '#fff' }} onClick={addEmp}>+ Thêm</button>
                    </div>
                    {/* Avatar paste zone */}
                    <div
                      onPaste={handleAvatarPaste}
                      tabIndex={0}
                      style={{
                        border: '2px dashed #dddbd2', borderRadius: 10, padding: '12px 14px',
                        display: 'flex', alignItems: 'center', gap: 12, cursor: 'text',
                        background: avatarPreview ? '#f0fdf4' : '#fafaf8',
                        outline: 'none', transition: 'border-color .15s',
                      }}
                      onClick={e => e.currentTarget.focus()}
                    >
                      {avatarPreview
                        ? <img src={avatarPreview} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
                        : <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e8e7e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
                      }
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: avatarPreview ? '#16a34a' : '#6b6960' }}>
                          {avatarPreview ? '✅ Đã dán ảnh' : 'Bấm vào đây rồi Ctrl+V để dán avatar'}
                        </div>
                        <div style={{ fontSize: 11, color: '#a8a69e', marginTop: 2 }}>Copy ảnh bất kỳ → Ctrl+V vào đây</div>
                      </div>
                      {avatarPreview && (
                        <button onClick={e => { e.stopPropagation(); setAvatarPreview(''); }}
                          style={{ marginLeft: 'auto', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: '#dc2626', fontSize: 11, fontWeight: 700 }}>
                          Xoá
                        </button>
                      )}
                    </div>
                    <input style={{ ...s.inp, marginTop: 8 }} placeholder="Link avatar (tuỳ chọn)..." value={empAvatar}
                      onChange={e => setEmpAvatar(e.target.value)}
                      disabled={!!avatarPreview} />
                  </div>
                  {employees.map(emp => (
                    <div key={emp.id} style={{ ...s.empRow, opacity: emp.active ? 1 : 0.45 }}>
                      <Avatar emp={emp} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: '#6b6960' }}>{emp.active ? '🟢 Active' : '⛔ Off'}</div>
                      </div>
                      <input type="number" min="1" value={quotas[emp.id] ?? emp.quota ?? 10}
                        onChange={e => setQuotas(q => ({ ...q, [emp.id]: e.target.value }))}
                        onBlur={e => updateQuota(emp.id, e.target.value)}
                        style={{ ...s.inp, width: 65, padding: '5px 8px', fontSize: 13, textAlign: 'center' }} />
                      <span style={{ fontSize: 11, color: '#a8a69e' }}>v/ng</span>
                      <button style={{ ...s.btn, padding: '5px 10px', fontSize: 12, background: emp.active ? '#fef2f2' : '#f0fdf4', color: emp.active ? '#dc2626' : '#16a34a', border: `1px solid ${emp.active ? '#fecaca' : '#bbf7d0'}` }} onClick={() => toggleEmp(emp)}>
                        {emp.active ? 'Tắt' : 'Bật'}
                      </button>
                      <button style={{ ...s.btn, padding: '5px 8px', fontSize: 12, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }} onClick={() => delEmp(emp.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Sản phẩm */}
              <div style={s.card}>
                <div style={s.cardHead} onClick={() => toggleCollapse('prod')}>
                  <div style={s.cardTitle}>📦 Sản phẩm ({products.length})</div>
                  <span style={{ fontSize: 12, color: '#a8a69e', transform: collapsed.prod ? 'rotate(-90deg)' : 'none', display: 'inline-block', transition: 'transform .2s' }}>▼</span>
                </div>
                {!collapsed.prod && (
                  <div style={s.cardBody}>
                    <button style={{ ...s.btn, background: '#1a1916', color: '#fff', marginBottom: 12 }} onClick={loadProducts} disabled={prodLoading}>
                      {prodLoading ? 'Đang kéo...' : '🔄 Kéo từ Google Drive'}
                    </button>
                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: 10 }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#a8a69e' }}>🔍</span>
                      <input
                        placeholder="Tìm sản phẩm..."
                        value={prodSearch}
                        onChange={e => { setProdSearch(e.target.value); setShowAllProds(true); }}
                        style={{ ...s.inp, paddingLeft: 32, fontSize: 13 }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: '#a8a69e', marginBottom: 8 }}>
                      {prodSearch ? `${products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase())).length} kết quả` : `${products.length} sản phẩm`}
                    </div>
                    {/* Scrollable list */}
                    <div style={{ maxHeight: showAllProds ? 400 : 320, overflowY: 'auto', paddingRight: 2 }}>
                      {(prodSearch
                        ? products.filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()))
                        : showAllProds ? products : products.slice(0, PROD_SHOW_LIMIT)
                      ).map((p, i) => {
                        const sel = selectedProds.includes(p.id);
                        const ci = products.indexOf(p);
                        return (
                          <div key={p.id} style={{ ...s.prodRow, borderColor: sel ? '#2563eb' : '#dddbd2', background: sel ? '#eff4ff' : '#f0efe9' }} onClick={() => toggleProd(p.id)}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[ci % COLORS.length], flexShrink: 0 }} />
                            <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: p.hasNoVoices ? '#fef2f2' : '#e8e7e0', color: p.hasNoVoices ? '#dc2626' : '#6b6960', fontWeight: 700 }}>{p.totalVoices}v</span>
                            <span style={{ fontSize: 15 }}>{sel ? '✅' : '⬜'}</span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Show more / collapse — chỉ hiện khi không đang tìm kiếm */}
                    {!prodSearch && products.length > PROD_SHOW_LIMIT && (
                      <button onClick={() => setShowAllProds(v => !v)} style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #dddbd2', background: '#f0efe9', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#6b6960', fontFamily: 'inherit', marginTop: 6 }}>
                        {showAllProds ? '▲ Thu gọn' : `▼ Xem thêm ${products.length - PROD_SHOW_LIMIT} sản phẩm`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Sản phẩm lâu chưa phân */}
              <div style={s.card}>
                <div style={s.cardHead} onClick={() => toggleCollapse('unassigned')}>
                  <div style={s.cardTitle}>💡 Sản phẩm lâu chưa phân ({unassignedDisplayProducts.length})</div>
                  <span style={{ fontSize: 12, color: '#a8a69e', transform: collapsed.unassigned ? 'rotate(-90deg)' : 'none', display: 'inline-block', transition: 'transform .2s' }}>▼</span>
                </div>
                {!collapsed.unassigned && (
                  <div style={s.cardBody}>
                    {unassignedDisplayProducts.length === 0 ? (
                      <div style={{ fontSize: 13, color: '#a8a69e', padding: '16px 0', textAlign: 'center' }}>Không có sản phẩm lâu chưa phân</div>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, color: '#a8a69e', marginBottom: 8 }}>
                          {unassignedDisplayProducts.length} sản phẩm
                        </div>
                        <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
                          {unassignedDisplayProducts.map(p => {
                            const sel = selectedProds.includes(p.id);
                            const ci = products.indexOf(p);
                            return (
                              <div key={p.id} style={{ ...s.prodRow, borderColor: sel ? '#2563eb' : '#dddbd2', background: sel ? '#eff4ff' : '#f0efe9' }} onClick={() => toggleProd(p.id)}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[Math.max(ci, 0) % COLORS.length], flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                                  <div style={{ fontSize: 11, color: '#a8a69e', marginTop: 2 }}>
                                    {p.lastAssignedDate ? `Lần cuối: ${fmtDate(p.lastAssignedDate)}` : 'Chưa bao giờ'}
                                  </div>
                                </div>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: p.hasNoVoices ? '#fef2f2' : '#e8e7e0', color: p.hasNoVoices ? '#dc2626' : '#6b6960', fontWeight: 700 }}>{p.totalVoices}v</span>
                                <span style={{ fontSize: 15 }}>{sel ? '✅' : '⬜'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: PHÂN CÔNG */}
          <div>
            <div style={s.card}>
              <div style={s.cardHead} onClick={() => toggleCollapse('assign')}>
                <div style={s.cardTitle}>⚡ {assignDate ? `Phân công lại — ${fmtDate(assignDate)}` : `Phân công hôm nay — ${fmtDate(null)}`}</div>
                <span style={{ fontSize: 12, color: '#a8a69e', transform: collapsed.assign ? 'rotate(-90deg)' : 'none', display: 'inline-block', transition: 'transform .2s' }}>▼</span>
              </div>
              {!collapsed.assign && (
                <div style={s.cardBody}>
                  {/* Warn total */}
                  {totalPlan > 0 && totalPlan !== totalQuota && (
                    <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#ca8a04', fontWeight: 600, marginBottom: 12 }}>
                      ⚠️ Tổng voice ({totalPlan}) ≠ quota ({totalQuota}) — lệch {Math.abs(totalPlan - totalQuota)}!
                    </div>
                  )}
                  {totalPlan > 0 && totalPlan === totalQuota && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#16a34a', fontWeight: 600, marginBottom: 12 }}>
                      ✅ Tổng khớp: {totalPlan} voice = {totalQuota} quota
                    </div>
                  )}

                  {/* Plan list */}
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b6960', marginBottom: 8 }}>Sản phẩm & số voice hôm nay:</div>
                  {selectedProds.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#a8a69e', padding: '16px 0', textAlign: 'center' }}>Tick sản phẩm bên trái để thêm</div>
                  ) : selectedProds.map(id => {
                    const prod = products.find(p => p.id === id);
                    if (!prod) return null;
                    const ci = products.indexOf(prod);
                    return (
                      <div key={id} style={s.planRow}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[ci % COLORS.length], flexShrink: 0 }} />
                        <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{prod.name}</div>
                        <input type="number" min="1" max={prod.totalVoices} placeholder="Voice..."
                          value={plan[id] ?? ''}
                          onChange={e => setPlan(p => ({ ...p, [id]: e.target.value }))}
                          onBlur={e => {
                            const n = Number(e.target.value);
                            if (e.target.value === '') return;
                            setPlan(p => ({ ...p, [id]: Math.max(1, Math.min(prod.totalVoices, Number.isFinite(n) ? n : 1)) }));
                          }}
                          style={{ ...s.inp, width: 85, padding: '6px 10px', fontSize: 13, textAlign: 'center' }} />
                        <span style={{ fontSize: 11, color: '#a8a69e' }}>/{prod.totalVoices}</span>
                        <button style={{ ...s.btn, padding: '4px 8px', fontSize: 11, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }} onClick={() => removePlan(id)}>✕</button>
                      </div>
                    );
                  })}

                  <div style={{ height: 1, background: '#dddbd2', margin: '14px 0' }} />

                  {/* Quota list */}
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6b6960', marginBottom: 8 }}>Quota nhân viên:</div>
                  {activeEmps.map(emp => (
                    <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <Avatar emp={emp} size={28} />
                      <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{emp.name}</span>
                      <input type="number" min="1" value={quotas[emp.id] ?? emp.quota ?? 10}
                        onChange={e => setQuotas(q => ({ ...q, [emp.id]: e.target.value }))}
                        onBlur={e => updateQuota(emp.id, e.target.value)}
                        style={{ ...s.inp, width: 80, padding: '6px 10px', fontSize: 13, textAlign: 'center' }} />
                      <span style={{ fontSize: 11, color: '#a8a69e' }}>video</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: '#6b6960', textAlign: 'right', marginBottom: 14 }}>
                    Tổng voice: {totalPlan} · Tổng quota: {totalQuota}
                  </div>

                  <button onClick={doAssign} disabled={loading}
                    style={{ ...s.btn, background: '#2563eb', color: '#fff', width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15, borderRadius: 12, opacity: loading ? 0.5 : 1 }}>
                    {loading ? 'Đang xử lý...' : assignDate ? '⚡ Phân công lại' : '⚡ Phân công ngay'}
                  </button>

                  {assignMsg.text && (
                    <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: assignMsg.type === 'green' ? '#f0fdf4' : '#fef2f2', color: assignMsg.type === 'green' ? '#16a34a' : '#dc2626', border: `1px solid ${assignMsg.type === 'green' ? '#bbf7d0' : '#fecaca'}` }}>
                      {assignMsg.text}
                    </div>
                  )}

                  {/* Result preview */}
                  {assignResult && (
                    <>
                      <div style={{ height: 1, background: '#dddbd2', margin: '14px 0' }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b6960', marginBottom: 8 }}>Kết quả:</div>
                      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                        {activeEmps.filter(e => (assignResult.byEmployee[e.id] || []).length > 0).map(emp => (
                          <div key={emp.id} style={s.col}>
                            <div style={s.colHead}>
                              <Avatar emp={emp} size={30} />
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.name}</div>
                            </div>
                            <div>
                              {(assignResult.byEmployee[emp.id] || []).map((t, i, arr) => (
                                <div key={t.productId} style={{ ...s.taskRow, borderBottom: i < arr.length - 1 ? '1px solid #f0efe9' : 'none' }}>
                                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{t.productName}</div>
                                  <div style={{ fontSize: 12, color: '#6b6960', fontFamily: 'monospace' }}>Voice: <strong style={{ color: '#2563eb' }}>{t.voices.join(', ')}</strong></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LỊCH SỬ */}
        <div style={s.card}>
          <div style={s.cardHead} onClick={() => toggleCollapse('hist')}>
            <div style={s.cardTitle}>📅 Lịch sử phân công</div>
            <span style={{ fontSize: 12, color: '#a8a69e', transform: collapsed.hist ? 'rotate(-90deg)' : 'none', display: 'inline-block', transition: 'transform .2s' }}>▼</span>
          </div>
          {!collapsed.hist && (
            <div style={s.cardBody}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
                {dates.length === 0 ? <span style={{ fontSize: 12, color: '#a8a69e' }}>Chưa có lịch sử</span> : dates.map(d => (
                  <button key={d} onClick={() => showHist(d)}
                    style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #dddbd2', background: selectedHistDate === d ? '#1a1916' : '#fff', color: selectedHistDate === d ? '#fff' : '#6b6960', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                    {fmtDate(d)}
                  </button>
                ))}
              </div>
              {selectedHistDate && histData && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#6b6960' }}>{fmtDate(selectedHistDate)}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={reassignFromHistory}
                      style={{ ...s.btn, background: '#eff4ff', color: '#2563eb', border: '1px solid #bfcffd', padding: '6px 12px', fontSize: 12 }}>
                      Phân công lại
                    </button>
                    <button onClick={() => setHistEditMode(v => !v)}
                      style={{ ...s.btn, background: histEditMode ? '#1a1916' : '#fff', color: histEditMode ? '#fff' : '#6b6960', border: '1px solid #dddbd2', padding: '6px 12px', fontSize: 12 }}>
                      Chỉnh sửa
                    </button>
                  </div>
                </div>
              )}
              {selectedHistDate && histData && histEditMode && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center', marginBottom: 14, padding: 10, background: '#f5f4f0', border: '1px solid #dddbd2', borderRadius: 10 }}>
                  <select value={histAdd.empId} onChange={e => setHistAdd(h => ({ ...h, empId: e.target.value }))}
                    style={{ ...s.inp, padding: '7px 10px', fontSize: 13 }}>
                    <option value="">Nhân viên</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                  <select value={histAdd.prodId} onChange={e => setHistAdd(h => ({ ...h, prodId: e.target.value }))}
                    style={{ ...s.inp, padding: '7px 10px', fontSize: 13 }}>
                    <option value="">Sản phẩm</option>
                    {products.map(prod => <option key={prod.id} value={prod.id}>{prod.name}</option>)}
                  </select>
                  <input value={histAdd.voices} placeholder="Voice: 1,2,3..."
                    onChange={e => setHistAdd(h => ({ ...h, voices: e.target.value }))}
                    style={{ ...s.inp, padding: '7px 10px', fontSize: 13 }} />
                  <button onClick={addHistoryTaskFromForm}
                    style={{ ...s.btn, background: '#16a34a', color: '#fff', padding: '7px 12px', fontSize: 12 }}>
                    + Thêm
                  </button>
                </div>
              )}
              {histData && (
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                  {Object.keys(histData.byEmployee || {}).filter(id => (histData.byEmployee[id] || []).length > 0).map(eid => {
                    const emp = empMap[eid];
                    if (!emp) return null;
                    return (
                      <div key={eid} style={s.col}>
                        <div style={s.colHead}><Avatar emp={emp} size={30} /><div style={{ fontWeight: 700, fontSize: 13 }}>{emp.name}</div></div>
                        <div>
                          {(histData.byEmployee[eid] || []).map((t, i, arr) => (
                            <div key={t.productId} style={{ ...s.taskRow, borderBottom: i < arr.length - 1 ? '1px solid #f0efe9' : 'none' }}>
                              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{t.productName}</div>
                              <div style={{ fontSize: 12, color: '#6b6960', fontFamily: 'monospace' }}>Voice: <strong style={{ color: '#2563eb' }}>{t.voices.join(', ')}</strong></div>
                              {histEditMode && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                                  <button onClick={() => editHistoryTask(selectedHistDate, eid, t)}
                                    style={{ ...s.btn, padding: '4px 8px', fontSize: 11, background: '#eff4ff', color: '#2563eb', border: '1px solid #bfcffd' }}>
                                    Sửa
                                  </button>
                                  <button onClick={() => deleteHistoryTask(selectedHistDate, eid, t)}
                                    style={{ ...s.btn, padding: '4px 8px', fontSize: 11, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                                    Xoá
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
