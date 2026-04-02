import type { ApiResult } from '@fd/shared';

class ApiClient {
  private baseUrl = '';

  async request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
    });

    if (res.status === 401) {
      if (
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/setup')
      ) {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    const json = (await res.json()) as ApiResult<T>;

    if (!json.success) {
      const error = new Error(json.error.message) as Error & {
        code: string;
        status: number;
      };
      error.code = json.error.code;
      error.status = res.status;
      throw error;
    }

    return json.data;
  }

  get<T>(url: string) {
    return this.request<T>(url);
  }

  post<T>(url: string, body?: unknown) {
    return this.request<T>(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(url: string, body?: unknown) {
    return this.request<T>(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(url: string) {
    return this.request<T>(url, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
