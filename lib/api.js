const API = process.env.NEXT_PUBLIC_API_URL;

export async function apiGet(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch(`${API}?${qs}`);
  return res.json();
}

export async function apiPost(action, body = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  return res.json();
}
