import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Snowflake, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { login } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password || isLoading) return;

    setIsLoading(true);
    try {
      await login({ password });
      const returnTo = searchParams.get('returnTo') || '/';
      navigate(returnTo, { replace: true });
    } catch (err) {
      const error = err as Error & { code?: string };
      if (error.code === 'TOO_MANY_REQUESTS') {
        toast.error('Слишком много попыток. Попробуйте позже.');
      } else {
        toast.error('Неверный пароль');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/20 via-transparent to-transparent p-4">
      <Card className="w-full max-w-sm border-border/50 shadow-2xl shadow-black/40">
        <CardHeader className="items-center space-y-3 pb-2">
          <div className="flex items-center justify-center rounded-lg bg-blue-500/10 p-3">
            <Snowflake className="size-8 text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </div>
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-bold tracking-tight">FrostDeploy</h1>
            <p className="text-sm text-muted-foreground">Вход в панель управления</p>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={isLoading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={!password || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Вход…
                </>
              ) : (
                'Войти'
              )}
            </Button>
          </CardContent>
        </form>

        <CardFooter className="justify-center pb-6">
          <p className="text-center text-xs text-muted-foreground">
            Забыли пароль? Сбросьте через CLI:{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              frostdeploy reset-password
            </code>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
