import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Github, Shield, Server, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { fetchSettings, updateSettings } from '@/api/settings';
import { fetchSystemMetrics } from '@/api/system';
import { changePassword } from '@/api/auth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function maskPat(pat: string | undefined): string {
  if (!pat) return '—';
  if (pat.length <= 8) return '••••••••';
  return `${pat.slice(0, 4)}${'••••••••'}${pat.slice(-4)}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days} дней ${hours} часов`;
}

// ---------------------------------------------------------------------------
// GitHub section
// ---------------------------------------------------------------------------

function GitHubSection() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const [editing, setEditing] = useState(false);
  const [showPat, setShowPat] = useState(false);
  const [patValue, setPatValue] = useState('');

  const mutation = useMutation({
    mutationFn: (github_pat: string) => updateSettings({ github_pat }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('GitHub PAT обновлён');
      setEditing(false);
      setPatValue('');
      setShowPat(false);
    },
    onError: () => toast.error('Не удалось обновить PAT'),
  });

  const handleSave = () => {
    if (!patValue.trim()) return;
    mutation.mutate(patValue.trim());
  };

  if (isLoading) {
    return <CardSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          <CardTitle>GitHub</CardTitle>
        </div>
        <CardDescription>Personal Access Token для доступа к репозиториям</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editing ? (
          <div className="flex items-center gap-3">
            <code className="flex-1 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm font-mono">
              {showPat ? settings?.github_pat || '—' : maskPat(settings?.github_pat)}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPat((v) => !v)}
              aria-label={showPat ? 'Скрыть токен' : 'Показать токен'}
            >
              {showPat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Изменить
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pat">Новый Personal Access Token</Label>
              <Input
                id="pat"
                type="text"
                placeholder="ghp_..."
                value={patValue}
                onChange={(e) => setPatValue(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!patValue.trim() || mutation.isPending}
                onClick={handleSave}
              >
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Обновить PAT
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setPatValue('');
                }}
              >
                Отмена
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Password section
// ---------------------------------------------------------------------------

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success('Пароль изменён');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: () => toast.error('Не удалось изменить пароль'),
  });

  const newTooShort = newPassword.length > 0 && newPassword.length < 8;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    confirmPassword === newPassword &&
    !mutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <CardTitle>Безопасность</CardTitle>
        </div>
        <CardDescription>Изменение пароля администратора</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="current-password">Текущий пароль</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">Новый пароль</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            {newTooShort && <p className="text-xs text-destructive">Минимум 8 символов</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Подтвердите пароль</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            {mismatch && <p className="text-xs text-destructive">Пароли не совпадают</p>}
          </div>

          <Button type="submit" disabled={!canSubmit}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Изменить пароль
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Server info section
// ---------------------------------------------------------------------------

function ServerSection() {
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: fetchSystemMetrics,
  });

  if (settingsLoading || metricsLoading) {
    return <CardSkeleton />;
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Домен платформы', value: settings?.platform_domain || '—' },
    { label: 'Node.js', value: metrics?.nodeVersion || '—' },
    { label: 'ОС / Платформа', value: metrics?.platform || '—' },
    { label: 'Аптайм', value: metrics ? formatUptime(metrics.uptime) : '—' },
    { label: 'Диапазон портов', value: '4321–4399' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          <CardTitle>Сервер</CardTitle>
        </div>
        <CardDescription>Информация о системе</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-medium font-mono">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeleton placeholder
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlatformSettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">Настройки платформы</h1>
      <Separator />
      <GitHubSection />
      <PasswordSection />
      <ServerSection />
    </div>
  );
}
