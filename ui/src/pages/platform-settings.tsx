import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Github,
  Shield,
  Server,
  Eye,
  EyeOff,
  Loader2,
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  fetchSettings,
  updateSettings,
  fetchDnsRecords,
  verifyDns,
  fetchAdminDomainSuggestion,
} from '@/api/settings';
import type { DnsRecordsResponse, DnsVerifyResponse } from '@/api/settings';
import { fetchSystemMetrics } from '@/api/system';
import { changePassword } from '@/api/auth';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

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
// Admin domain section
// ---------------------------------------------------------------------------

function AdminDomainSection() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const { data: suggestionData } = useQuery({
    queryKey: ['admin-domain-suggestion'],
    queryFn: fetchAdminDomainSuggestion,
    enabled: !!settings?.platform_domain,
  });

  const currentAdminDomain = settings?.admin_domain || '';
  const [inputValue, setInputValue] = useState('');
  const [savedDomain, setSavedDomain] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (admin_domain: string) => updateSettings({ admin_domain }),
    onSuccess: (_data, admin_domain) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Домен панели управления сохранён');
      setSavedDomain(admin_domain);
    },
    onError: () => toast.error('Не удалось сохранить домен'),
  });

  const handleSave = () => {
    const val = inputValue.trim();
    if (!val) return;
    mutation.mutate(val);
  };

  if (isLoading) return <CardSkeleton />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          <CardTitle>Домен панели управления</CardTitle>
        </div>
        <CardDescription>Откройте доступ к FrostDeploy через HTTPS-субдомен</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!currentAdminDomain && (
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Нет защиты через домен</AlertTitle>
            <AlertDescription>
              Панель управления открыта по прямому порту. Добавьте домен для защиты через HTTPS.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="admin-domain-input">Домен</Label>
          {suggestionData?.suggestion && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">Предлагаемое значение:</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-mono bg-muted px-2 py-0.5 rounded border hover:bg-muted/80 transition-colors"
                onClick={() => setInputValue(suggestionData.suggestion!)}
              >
                {suggestionData.suggestion}
                <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Suggested
                </span>
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              id="admin-domain-input"
              type="text"
              placeholder={suggestionData?.suggestion ?? 'frostdeploy.example.com'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <Button
              size="sm"
              disabled={!inputValue.trim() || mutation.isPending}
              onClick={handleSave}
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Сохранить
            </Button>
          </div>
          {currentAdminDomain && (
            <p className="text-xs text-muted-foreground">
              Текущий домен: <code className="font-mono">{currentAdminDomain}</code>
            </p>
          )}
        </div>

        {savedDomain && (
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Закройте прямой доступ к порту</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                Теперь панель управления доступна по адресу{' '}
                <a
                  href={`https://${savedDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono underline"
                >
                  https://{savedDomain}
                </a>
                . Закройте прямой доступ к порту командой:
              </p>
              <code className="block rounded bg-background/60 px-3 py-2 text-xs font-mono">
                sudo ufw delete allow 9002/tcp
              </code>
            </AlertDescription>
          </Alert>
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
// Domain section
// ---------------------------------------------------------------------------

const IP_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

function DomainSection() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const domain = settings?.platform_domain || '';
  const isIp = IP_PATTERN.test(domain);

  const [editing, setEditing] = useState(false);
  const [newDomain, setNewDomain] = useState('');

  const { data: dnsData, isLoading: dnsLoading } = useQuery({
    queryKey: ['dns-records'],
    queryFn: fetchDnsRecords,
    enabled: !!domain && !isIp,
  });

  const updateDomainMutation = useMutation({
    mutationFn: (platform_domain: string) => updateSettings({ platform_domain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['dns-records'] });
      toast.success('Домен обновлён');
      setEditing(false);
      setNewDomain('');
    },
    onError: () => toast.error('Не удалось обновить домен'),
  });

  const [verifyResult, setVerifyResult] = useState<DnsVerifyResponse | null>(null);

  const verifyMutation = useMutation({
    mutationFn: () => verifyDns(domain),
    onSuccess: (data) => setVerifyResult(data),
    onError: () => toast.error('Ошибка проверки DNS'),
  });

  const handleSaveDomain = () => {
    const val = newDomain.trim();
    if (!val) return;
    setVerifyResult(null);
    updateDomainMutation.mutate(val);
  };

  if (isLoading) return <CardSkeleton />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          <CardTitle>Домен</CardTitle>
        </div>
        <CardDescription>Настройка домена платформы</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Current domain display */}
        {isIp && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Сейчас используется IP-адрес:{' '}
              <code className="font-mono font-medium text-foreground">{domain}</code>
            </span>
          </div>
        )}

        {!isIp && domain && !editing && (
          <div className="flex items-center gap-3">
            <code className="flex-1 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm font-mono">
              {domain}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(true);
                setNewDomain(domain);
              }}
            >
              Изменить
            </Button>
          </div>
        )}

        {/* Domain edit / add form */}
        {(editing || isIp) && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="domain-input">{isIp ? 'Добавить домен' : 'Домен платформы'}</Label>
              <div className="flex gap-2">
                <Input
                  id="domain-input"
                  type="text"
                  placeholder="deploy.example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  autoFocus
                />
                <Button
                  size="sm"
                  disabled={!newDomain.trim() || updateDomainMutation.isPending}
                  onClick={handleSaveDomain}
                >
                  {updateDomainMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isIp ? 'Добавить домен' : 'Обновить'}
                </Button>
                {!isIp && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setNewDomain('');
                    }}
                  >
                    Отмена
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DNS records */}
        {!isIp && domain && (
          <DnsRecordsCard
            dnsData={dnsData ?? null}
            dnsLoading={dnsLoading}
            verifyResult={verifyResult}
            verifyMutation={verifyMutation}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DNS records card
// ---------------------------------------------------------------------------

function DnsRecordsCard({
  dnsData,
  dnsLoading,
  verifyResult,
  verifyMutation,
}: {
  dnsData: DnsRecordsResponse | null;
  dnsLoading: boolean;
  verifyResult: DnsVerifyResponse | null;
  verifyMutation: ReturnType<typeof useMutation<DnsVerifyResponse, Error, void>>;
}) {
  const copyValue = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success('Скопировано');
  };

  if (dnsLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Загрузка DNS-записей…</span>
      </div>
    );
  }

  if (!dnsData) return null;

  if (dnsData.isDirect) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ExternalLink className="h-4 w-4 shrink-0" />
        <span>DNS-записи не требуются для прямого IP-доступа</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Separator />
      <div>
        <h4 className="text-sm font-medium mb-3">DNS-записи</h4>
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Тип</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Имя</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Значение</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Описание</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {dnsData.records.map((rec, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{rec.type}</td>
                  <td className="px-3 py-2 font-mono text-xs">{rec.name}</td>
                  <td className="px-3 py-2 font-mono text-xs break-all">{rec.value}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{rec.description}</td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => copyValue(rec.value)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DNS verification */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={verifyMutation.isPending}
          onClick={() => verifyMutation.mutate()}
        >
          {verifyMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Проверить DNS
        </Button>

        {verifyResult && (
          <div className="flex items-center gap-2 text-sm">
            {verifyResult.verified ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-status-success" />
                <span className="text-status-success">DNS настроен верно</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-destructive">
                  DNS не настроен
                  {verifyResult.actualIp
                    ? ` (указывает на ${verifyResult.actualIp}, ожидается ${verifyResult.serverIp})`
                    : ''}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Server info section
// ---------------------------------------------------------------------------

function ServerSection() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: fetchSystemMetrics,
  });

  if (metricsLoading) {
    return <CardSkeleton />;
  }

  const rows: { label: string; value: string }[] = [
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
      <DomainSection />
      <AdminDomainSection />
      <PasswordSection />
      <ServerSection />
    </div>
  );
}
