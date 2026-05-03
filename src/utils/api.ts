export async function apiCall<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null;
  
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, { ...options, headers });
  
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = data as { error?: string };
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  if (typeof window !== 'undefined' && typeof (data as { token?: unknown }).token === 'string') {
    localStorage.setItem('auth-token', (data as { token: string }).token);
  }

  return data as T;
}
