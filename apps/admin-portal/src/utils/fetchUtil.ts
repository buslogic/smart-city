export async function fetchPostData(url: string, data = {}, accept = 'json', headers = {}, signal = null) {
  try {
    const isFormData = data instanceof FormData;

    const defaultHeaders = isFormData
      ? {
          'X-Requested-With': 'XMLHttpRequest',
          ...headers,
        }
      : {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          ...headers,
        };

    const body = isFormData ? data : toUrlEncoded(data);

    const response = await fetch(url, {
      method: 'POST',
      headers: defaultHeaders,
      body,
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    switch (accept) {
      case 'json':
        return await response.json();
      case 'blob':
        return await response.blob();
      default:
        return await response.text();
    }
  } catch (e) {
    console.error('Fetch error:', e);
    return null;
  }
}

function toUrlEncoded(obj: Record<string, any>) {
  const params = new URLSearchParams();
  Object.entries(obj).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(`${key}[]`, v));
    } else {
      params.append(key, value);
    }
  });
  return params.toString();
}

/**
 * Generic API fetch function for NestJS backend
 * Supports GET, POST, PATCH, DELETE with JSON payload
 */
export async function fetchAPI<T = any>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    data?: Record<string, any> | null;
    headers?: Record<string, string>;
    signal?: AbortSignal | null;
  } = {}
): Promise<T> {
  const { method = 'GET', data = null, headers = {}, signal = null } = options;

  try {
    // Preuzmi accessToken iz localStorage (koristi se za JWT autentifikaciju)
    const token = localStorage.getItem('accessToken');

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: defaultHeaders,
      signal: signal || undefined,
    };

    if (data && (method === 'POST' || method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(data);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
    }

    // Za DELETE metodu možda nema JSON response
    if (method === 'DELETE') {
      const text = await response.text();
      return (text ? JSON.parse(text) : {}) as T;
    }

    return await response.json();
  } catch (e) {
    console.error('API Fetch error:', e);
    throw e;
  }
}
