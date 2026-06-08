import { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';

const DAYS = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
const COLORS = ['#2563eb','#16a34a','#dc2626','#ea580c','#9333ea','#0891b2','#ca8a04','#be185d'];

function fmtDate(d) {
  const dt = d ? new Date(d + 'T00:00:00') : new Date();
  return `${DAYS[dt.getDay()]}, ${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
}

function Avatar({ emp, size = 40 }) {
  const initials = emp.name.trim().split(' ').slice(-2).map(w => w[0]).join('').toUpperCase();
  const color = COLORS[emp.name.charCodeAt(0) % COLORS.length];
  if (emp.avatar) return <img src={emp.avatar} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 800, fontSize: size * 0.35, flexShrink: 0,
    }}>{initials}</div>
  );
}

export default function TodayPage() {
  const [assignment, setAssignment] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState([]);
  const [selDate, setSelDate] = useState('');

  useEffect(() => {
    Promise.all([
      apiGet('getEmployees'),
      apiGet('getHistory'),
      apiGet('getToday'),
    ]).then(([emps, dts, today]) => {
      setEmployees(Array.isArray(emps) ? emps : []);
      setDates(Array.isArray(dts) ? dts : []);
      setAssignment(today);
      setLoading(false);
    });
  }, []);

  async function loadDate(date) {
    setSelDate(date);
    setLoading(true);
    const data = await apiGet('getToday', date ? { date } : {});
    setAssignment(data);
    setLoading(false);
  }

  const empMap = {};
  employees.forEach(e => empMap[e.id] = e);
  const showIds = Object.keys(assignment?.byEmployee || {}).filter(id => (assignment.byEmployee[id] || []).length > 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f0', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #dddbd2', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>📋 Công việc hôm nay</div>
          <div style={{ fontSize: 12, color: '#6b6960', marginTop: 2 }}>{fmtDate(selDate || null)}</div>
        </div>
        <select value={selDate} onChange={e => loadDate(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #dddbd2', fontSize: 13, background: '#fff' }}>
          <option value="">— Hôm nay —</option>
          {dates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
        </select>
      </div>

      <div style={{ padding: '20px', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#a8a69e' }}>Đang tải...</div>
        ) : !assignment || showIds.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#a8a69e' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
            Chưa có phân công hôm nay
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 14, minWidth: 'fit-content' }}>
            {showIds.map(eid => {
              const emp = empMap[eid];
              if (!emp) return null;
              const tasks = assignment.byEmployee[eid] || [];
              return (
                <div key={eid} style={{ width: 240, flexShrink: 0, background: '#fff', border: '1px solid #dddbd2', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #dddbd2', background: '#f5f4f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar emp={emp} size={36} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{emp.name}</div>
                      <div style={{ fontSize: 11, color: '#6b6960', marginTop: 1 }}>{tasks.reduce((s, t) => s + t.voices.length, 0)} voice · {tasks.length} sp</div>
                    </div>
                  </div>
                  <div>
                    {tasks.map((t, i) => (
                      <div key={t.productId} style={{ padding: '12px 16px', borderBottom: i < tasks.length - 1 ? '1px solid #f0efe9' : 'none' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{t.productName}</div>
                        <div style={{ fontSize: 12, color: '#6b6960', marginBottom: 7, fontFamily: 'monospace' }}>
                          Voice: <strong style={{ color: '#2563eb' }}>{t.voices.join(', ')}</strong>
                        </div>
                        <a href={t.driveUrl} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#2563eb', background: '#eff4ff', border: '1px solid #bfcffd', padding: '4px 10px', borderRadius: 6, textDecoration: 'none' }}>
                          📁 Mở thư mục Drive →
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
