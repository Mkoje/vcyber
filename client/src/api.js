export async function api(url, options = {}) {
  const headers = { 'X-VCyber-Request': '1', ...options.headers };
  if (options.body && !(options.body instanceof FormData))
    headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers,
    body:
      options.body instanceof FormData
        ? options.body
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
  });
  const data = await response.json().catch(() => {
    throw new Error('The service returned an unreadable response. Please try again.');
  });
  if (!response.ok) throw new Error(data.error || 'The request failed.');
  return data;
}
export const money = (n) => `KSh ${Number(n).toLocaleString('en-KE')}`;
export const date = (n) =>
  new Date(Number(n)).toLocaleString('en-KE', {
    timeZone: 'Africa/Nairobi',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
