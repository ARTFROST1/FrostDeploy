import type { ApiResult } from '@fd/shared';
import { toast } from 'sonner';

class ApiClient {
  private baseUrl = '';

  async request<T>(url: string, options?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        credentials: 'include',
      });
    } catch (err) {
      if (err instanceof TypeError) {
        const networkError = new Error('Ошибка сети. Проверьте подключение к серверу.') as Error & {
          isNetworkError: boolean;
        };
        networkError.isNetworkError = true;
        throw networkError;
      }
      throw err;
    }

    if (res.status === 401) {
      if (
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/setup')
      ) {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    const json = (await res.json()) as ApiResult<T> & { setupRequired?: boolean };

    // Redirect to setup wizard when server signals setup is required
    if (json.setupRequired && !window.location.pathname.startsWith('/setup')) {
      window.location.href = '/setup';
      throw new Error('Setup required');
    }

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

  private async requestWithRetry<T>(
    url: string,
    options?: RequestInit,
    maxRetries = 3,
  ): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.request<T>(url, options);
      } catch (err) {
        lastError = err as Error;
        const isRetryable = this.isRetryable(err);
        if (!isRetryable || attempt === maxRetries) throw lastError;
        if (attempt === 0) toast.error('Нет связи с сервером, повторяем...');
        await this.delay(1000 * Math.pow(2, attempt));
      }
    }
    throw lastError!;
  }

  private isRetryable(err: unknown): boolean {
    if (err instanceof Error && 'isNetworkError' in err) return true;
    if (
      err instanceof Error &&
      'status' in err &&
      typeof (err as { status: unknown }).status === 'number' &&
      (err as { status: number }).status >= 500
    )
      return true;
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  get<T>(url: string) {
    return this.requestWithRetry<T>(url);
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
