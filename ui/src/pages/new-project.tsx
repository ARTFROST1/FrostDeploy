import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Rocket,
  Globe,
  Server,
  Zap,
  Box,
  Disc,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EnvVarEditor, type EnvVar } from '@/components/env-var-editor';
import { cn } from '@/lib/utils';
import { createProject, detectFramework } from '@/api/projects';
import { FRAMEWORK_ICONS } from '@/lib/constants';

/* ---------- types ---------- */

interface DetectResult {
  framework: string;
  buildCmd: string;
  startCmd: string;
}

interface FormData {
  repoUrl: string;
  branch: string;
  name: string;
  buildCmd: string;
  startCmd: string;
  port: number;
  framework: string | null;
  rootDir: string;
  envVars: EnvVar[];
}

const INITIAL_FORM: FormData = {
  repoUrl: '',
  branch: 'main',
  name: '',
  buildCmd: '',
  startCmd: '',
  port: 3000,
  framework: null,
  rootDir: '',
  envVars: [],
};

const STEPS = [
  { label: 'Репозиторий', number: 1 },
  { label: 'Настройки', number: 2 },
  { label: 'Переменные', number: 3 },
  { label: 'Обзор', number: 4 },
] as const;

/* ---------- icon map ---------- */

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Globe,
  Rocket,
  Server,
  Zap,
  Box,
  Disc,
  FileText,
  HelpCircle,
};

function FrameworkIcon({ framework }: { framework: string }) {
  const iconName = FRAMEWORK_ICONS[framework] ?? FRAMEWORK_ICONS['unknown'] ?? 'HelpCircle';
  const Icon = ICON_MAP[iconName] ?? HelpCircle;
  return <Icon className="h-4 w-4" />;
}

/* ---------- helpers ---------- */

function extractRepoName(url: string): string {
  try {
    const match = url.match(/github\.com\/[^/]+\/([^/.]+)/);
    return match ? (match[1] ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '') : '';
  } catch {
    return '';
  }
}

/* ---------- Step Indicator ---------- */

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center">
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

          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'mx-2 mb-6 h-0.5 w-12 rounded-full transition-colors duration-300 sm:w-20',
                i + 1 < current ? 'bg-status-success' : 'bg-secondary',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Step 1: Repo ---------- */

function StepRepo({
  form,
  setForm,
  detecting,
  detected,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  detecting: boolean;
  detected: DetectResult | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Репозиторий</h2>
        <p className="mt-1 text-sm text-muted-foreground">Укажите GitHub-репозиторий для деплоя</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="repoUrl">GitHub URL</Label>
        <Input
          id="repoUrl"
          value={form.repoUrl}
          onChange={(e) => setForm((p) => ({ ...p, repoUrl: e.target.value }))}
          placeholder="https://github.com/user/repo"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="branch">Ветка</Label>
        <Input
          id="branch"
          value={form.branch}
          onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))}
          placeholder="main"
        />
      </div>

      {detecting && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Определяем фреймворк…
        </div>
      )}

      {detected && !detecting && (
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <FrameworkIcon framework={detected.framework} />
            <Badge variant="secondary">{detected.framework}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Build:</span>{' '}
              <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                {detected.buildCmd || '—'}
              </code>
            </div>
            <div>
              <span className="text-muted-foreground">Start:</span>{' '}
              <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                {detected.startCmd || '—'}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Step 2: Config ---------- */

function StepConfig({
  form,
  setForm,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Настройки проекта</h2>
        <p className="mt-1 text-sm text-muted-foreground">Проверьте и скорректируйте параметры</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Имя проекта</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => {
            const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
            setForm((p) => ({ ...p, name: v }));
          }}
          placeholder="my-project"
        />
        <p className="text-xs text-muted-foreground">Строчные буквы, цифры и дефисы</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="buildCmd">Команда сборки</Label>
          <Input
            id="buildCmd"
            value={form.buildCmd}
            onChange={(e) => setForm((p) => ({ ...p, buildCmd: e.target.value }))}
            placeholder="npm run build"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startCmd">Команда запуска</Label>
          <Input
            id="startCmd"
            value={form.startCmd}
            onChange={(e) => setForm((p) => ({ ...p, startCmd: e.target.value }))}
            placeholder="npm start"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="port">Порт</Label>
          <Input id="port" value={form.port} disabled className="opacity-60" />
          <p className="text-xs text-muted-foreground">Назначается автоматически</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rootDir">Root Directory</Label>
        <Input
          id="rootDir"
          value={form.rootDir}
          onChange={(e) => setForm((p) => ({ ...p, rootDir: e.target.value }))}
          placeholder="Leave empty to use repository root"
        />
        <p className="text-xs text-muted-foreground">
          Set if your app is in a subdirectory (e.g.{' '}
          <code className="text-foreground">apps/frontend</code>). Useful for monorepos.
        </p>
      </div>
    </div>
  );
}

/* ---------- Step 3: Env ---------- */

function StepEnv({
  form,
  setForm,
}: {
  form: FormData;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Переменные окружения</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Добавьте переменные окружения для вашего приложения (опционально)
        </p>
      </div>

      <EnvVarEditor
        vars={form.envVars}
        onChange={(envVars) => setForm((p) => ({ ...p, envVars }))}
      />
    </div>
  );
}

/* ---------- Step 4: Review ---------- */

function StepReview({ form }: { form: FormData }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Обзор</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Проверьте параметры перед созданием проекта
        </p>
      </div>

      <div className="space-y-4 text-sm">
        <Row label="Репозиторий" value={form.repoUrl} />
        <Row label="Ветка" value={form.branch} />
        <Row label="Имя проекта" value={form.name} />
        {form.framework && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Фреймворк</span>
            <div className="flex items-center gap-2">
              <FrameworkIcon framework={form.framework} />
              <Badge variant="secondary">{form.framework}</Badge>
            </div>
          </div>
        )}
        <Row label="Команда сборки" value={form.buildCmd || '—'} mono />
        <Row label="Команда запуска" value={form.startCmd || '—'} mono />
        {form.rootDir && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Root Directory</span>
            <span className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">
              {form.rootDir}
            </span>
          </div>
        )}
        <Row label="Порт" value={String(form.port)} />
        <div className="flex justify-between items-start">
          <span className="text-muted-foreground">Переменные окружения</span>
          <span className="text-right">
            {form.envVars.length > 0 ? `${form.envVars.length} шт.` : '—'}
          </span>
        </div>
        {form.envVars.length > 0 && (
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-1">
            {form.envVars.map((v, i) => (
              <div key={i} className="flex justify-between font-mono text-xs">
                <span>{v.key || '(пусто)'}</span>
                <span className="text-muted-foreground">{v.isSecret ? '••••••' : v.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono text-xs bg-secondary px-1.5 py-0.5 rounded' : ''}>
        {value}
      </span>
    </div>
  );
}

/* ---------- Page ---------- */

export default function NewProjectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);

  /* --- detect framework (debounced) --- */
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runDetect = useCallback(async (url: string, branch: string) => {
    setDetecting(true);
    try {
      const result = await detectFramework(url, branch || undefined);
      setDetected(result);
      setForm((p) => ({
        ...p,
        framework: result.framework,
        buildCmd: result.buildCmd,
        startCmd: result.startCmd,
        name: p.name || extractRepoName(url),
      }));
    } catch {
      setDetected(null);
    } finally {
      setDetecting(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    if (!form.repoUrl || !form.repoUrl.includes('github.com')) {
      setDetected(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      runDetect(form.repoUrl, form.branch);
    }, 500);
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, [form.repoUrl, form.branch, runDetect]);

  /* --- create project mutation --- */
  const mutation = useMutation({
    mutationFn: () =>
      createProject({
        repoUrl: form.repoUrl,
        branch: form.branch,
        name: form.name,
        envVars: form.envVars.length > 0 ? form.envVars : undefined,
        ...(form.rootDir ? { rootDir: form.rootDir } : {}),
      }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Проект создан');
      navigate(`/projects/${project.id}`);
    },
    onError: () => {
      toast.error('Не удалось создать проект');
    },
  });

  /* --- validation --- */
  const canNext = (): boolean => {
    if (step === 1) {
      return form.repoUrl.length > 0 && /github\.com/.test(form.repoUrl);
    }
    if (step === 2) {
      return form.name.length > 0 && /^[a-z0-9][a-z0-9-]*$/.test(form.name);
    }
    return true;
  };

  const next = () => {
    if (step < 4 && canNext()) setStep((s) => s + 1);
  };
  const back = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* breadcrumb text */}
      <p className="text-sm text-muted-foreground">Dashboard / Новый проект</p>

      <h1 className="text-2xl font-bold">Новый проект</h1>

      <StepIndicator current={step} />

      <Card>
        <CardContent className="p-6">
          {step === 1 && (
            <StepRepo form={form} setForm={setForm} detecting={detecting} detected={detected} />
          )}
          {step === 2 && <StepConfig form={form} setForm={setForm} />}
          {step === 3 && <StepEnv form={form} setForm={setForm} />}
          {step === 4 && <StepReview form={form} />}

          {/* navigation */}
          <div className="flex justify-between pt-6 mt-6 border-t border-border">
            {step > 1 ? (
              <Button variant="outline" onClick={back}>
                <ArrowLeft className="h-4 w-4" />
                Назад
              </Button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <Button onClick={next} disabled={!canNext()}>
                Далее
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Создать проект
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
