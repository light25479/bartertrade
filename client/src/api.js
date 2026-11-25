export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: options.body && !isForm ? { 'Content-Type': 'application/json' } : {},
    credentials: 'include',
    body: options.body ? (isForm ? options.body : JSON.stringify(options.body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}