import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Snowflake, Eye, EyeOff, Check, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { setup } from '@/api/auth';
import { checkSetupStatus } from '@/api/settings';

const STEPS = [
  { label: 'Пароль', number: 1 },
  { label: 'GitHub', number: 2 },
  { label: 'Домен', number: 3 },
] as const;

/* ---------- Step Indicator ---------- */

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center">
          {/* circle */}
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300',
                i + 1 < current && 'bg-status-success text-white',
                i + 1 === current && 'bg-primary text-primary-foreground ring-4 ring-primary/25',
                i + 1 > current && 'bg-secondary text-muted-foreground',
              )}
            >
              {i + 1 < current ? <Check className="h-5 w-5" /> : step.number}
            </div>
            <span
              className={cn(
                'text-xs font-medium transition-colors duration-300',
                i + 1 === current ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
          </div>

          {/* connector line */}
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'mx-2 mb-6 h-0.5 w-16 rounded-full transition-colors duration-300 sm:w-24',
                i + 1 < current ? 'bg-status-success' : 'bg-secondary',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Password Input with toggle ---------- */

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((p) => !p)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/* ---------- Step 1: Password ---------- */

function StepPassword({
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  onNext,
}: {
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  onNext: () => void;
}) {
  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const valid = password.length >= 8 && password === confirmPassword;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Создайте пароль администратора</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Этот пароль будет использоваться для входа в панель управления
        </p>
      </div>

      <PasswordField
        id="password"
        label="Пароль"
        value={password}
        onChange={setPassword}
        placeholder="Минимум 8 символов"
        error={tooShort ? 'Пароль должен содержать минимум 8 символов' : undefined}
      />

      <PasswordField
        id="confirmPassword"
        label="Подтвердите пароль"
        value={confirmPassword}
        onChange={setConfirmPassword}
        placeholder="Повторите пароль"
        error={mismatch ? 'Пароли не совпадают' : undefined}
      />

      <div className="flex justify-end pt-2">
        <Button onClick={onNext} disabled={!valid}>
          Далее
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Step 2: GitHub PAT ---------- */

function StepGitHub({
  githubPat,
  setGithubPat,
  onNext,
  onBack,
}: {
  githubPat: string;
  setGithubPat: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const patRegex = /^(gh[ps]_|github_pat_)/;
  const hasInput = githubPat.length > 0;
  const formatValid = patRegex.test(githubPat);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Подключите GitHub</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Токен нужен для доступа к вашим репозиториям и вебхукам
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="githubPat">Personal Access Token</Label>
        <Input
          id="githubPat"
          type="password"
          value={githubPat}
          onChange={(e) => setGithubPat(e.target.value)}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        />
        {hasInput && (
          <p className={cn('text-sm', formatValid ? 'text-status-success' : 'text-destructive')}>
            {formatValid
              ? '✓ Формат токена корректен'
              : 'Токен должен начинаться с ghp_, ghs_ или github_pat_'}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Создайте токен на{' '}
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            github.com/settings/tokens
          </a>{' '}
          с доступом к репозиториям
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Назад
        </Button>
        <Button onClick={onNext} disabled={!formatValid}>
          Далее
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ---------- Step 3: Domain ---------- */

function StepDomain({
  platformDomain,
  setPlatformDomain,
  onSubmit,
  onBack,
  loading,
}: {
  platformDomain: string;
  setPlatformDomain: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const valid = platformDomain.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Домен платформы</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Укажите домен, по которому будет доступен FrostDeploy
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="platformDomain">Домен (FQDN)</Label>
        <Input
          id="platformDomain"
          type="text"
          value={platformDomain}
          onChange={(e) => setPlatformDomain(e.target.value)}
          placeholder="deploy.example.com"
        />
        <p className="text-xs text-muted-foreground">
          Убедитесь, что DNS-запись указывает на IP-адрес вашего сервера
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Назад
        </Button>
        <Button onClick={onSubmit} disabled={!valid || loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Настройка...' : 'Завершить настройку'}
        </Button>
      </div>
    </div>
  );
}

/* ---------- Main Setup Page ---------- */

export default function SetupPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [platformDomain, setPlatformDomain] = useState('');

  // Redirect if setup already completed
  useEffect(() => {
    checkSetupStatus()
      .then((data) => {
        if (data.completed) navigate('/', { replace: true });
      })
      .catch(() => {
        // Setup status endpoint failed — allow setup to proceed
      });
  }, [navigate]);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      await setup({ password, githubPat, platformDomain });
      toast.success('Настройка завершена!');
      navigate('/', { replace: true });
    } catch (err) {
      const error = err as Error & { status?: number };
      if (error.status === 409) {
        navigate('/', { replace: true });
        return;
      }
      toast.error(error.message || 'Ошибка при настройке');
    } finally {
      setLoading(false);
    }
  }, [password, githubPat, platformDomain, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Branding */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2.5">
          <Snowflake className="h-8 w-8 text-blue-400" />
          <span className="text-2xl font-bold tracking-tight">FrostDeploy</span>
        </div>
        <p className="text-sm text-muted-foreground">Первоначальная настройка</p>
      </div>

      {/* Step indicator */}
      <div className="mb-8">
        <StepIndicator current={step} />
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg sm:p-8">
        {step === 1 && (
          <StepPassword
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StepGitHub
            githubPat={githubPat}
            setGithubPat={setGithubPat}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <StepDomain
            platformDomain={platformDomain}
            setPlatformDomain={setPlatformDomain}
            onSubmit={handleSubmit}
            onBack={() => setStep(2)}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
