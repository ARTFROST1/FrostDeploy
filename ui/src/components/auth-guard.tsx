import { useState, useEffect, type ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [state, setState] = useState<
    'loading' | 'authenticated' | 'unauthenticated' | 'needs-setup'
  >('loading');

  useEffect(() => {
    async function check() {
      try {
        // First check if setup is completed
        const setupRes = await fetch('/api/settings/setup-status', { credentials: 'include' });
        if (setupRes.ok) {
          const setupData = await setupRes.json();
          if (setupData.success && !setupData.data.completed) {
            setState('needs-setup');
            return;
          }
        }

        // Then check auth
        const authRes = await fetch('/api/auth/check', { credentials: 'include' });
        if (authRes.ok) {
          setState('authenticated');
        } else {
          setState('unauthenticated');
        }
      } catch {
        setState('unauthenticated');
      }
    }
    check();
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (state === 'needs-setup') {
    window.location.href = '/setup';
    return null;
  }

  if (state === 'unauthenticated') {
    const returnUrl = window.location.pathname + window.location.search;
    window.location.href =
      returnUrl !== '/' ? `/login?returnTo=${encodeURIComponent(returnUrl)}` : '/login';
    return null;
  }

  return <>{children}</>;
}
