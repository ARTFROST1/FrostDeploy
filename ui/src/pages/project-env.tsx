import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, ShieldCheck, AlertTriangle, AlertCircle } from 'lucide-react';

import { fetchEnvVars, updateEnvVars } from '@/api/projects';
import { EnvVarEditor, type EnvVar } from '@/components/env-var-editor';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const KEY_RE = /^[A-Z_][A-Z0-9_]*$/;

export default function ProjectEnvPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const {
    data: envVars,
    isLoading,
    error: envError,
  } = useQuery({
    queryKey: ['project', id, 'env'],
    queryFn: () => fetchEnvVars(id!),
    enabled: !!id,
  });

  const [vars, setVars] = useState<EnvVar[]>([]);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!envVars) return;
    setVars(
      envVars.map((v) => ({
        key: v.key,
        value: v.value ?? '',
        isSecret: v.isSecret,
      })),
    );
    setSynced(true);
  }, [envVars]);

  const hasChanges = useMemo(() => {
    if (!synced || !envVars) return false;
    if (vars.length !== envVars.length) return true;
    return vars.some((v, i) => {
      const orig = envVars[i];
      if (!orig) return true;
      return v.key !== orig.key || v.value !== (orig.value ?? '') || v.isSecret !== orig.isSecret;
    });
  }, [vars, envVars, synced]);

  const saveMutation = useMutation({
    mutationFn: (payload: Array<{ key: string; value: string; isSecret: boolean }>) =>
      updateEnvVars(id!, payload),
    onSuccess: () => {
      toast.success('Сохранено');
      queryClient.invalidateQueries({ queryKey: ['project', id, 'env'] });
    },
    onError: () => toast.error('Ошибка сохранения'),
  });

  const handleSave = useCallback(() => {
    // validation: no empty keys
    const emptyKey = vars.find((v) => !v.key.trim());
    if (emptyKey !== undefined) {
      toast.error('Ключ не может быть пустым');
      return;
    }

    // validation: key format
    const badKey = vars.find((v) => !KEY_RE.test(v.key));
    if (badKey) {
      toast.error(
        `Недопустимый ключ: "${badKey.key}". Используйте A-Z, 0-9, _ (начало с буквы или _)`,
      );
      return;
    }

    // validation: duplicates
    const seen = new Set<string>();
    for (const v of vars) {
      if (seen.has(v.key)) {
        toast.error(`Дублирующийся ключ: "${v.key}"`);
        return;
      }
      seen.add(v.key);
    }

    saveMutation.mutate(vars.map((v) => ({ key: v.key, value: v.value, isSecret: v.isSecret })));
  }, [vars, saveMutation]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[420px] w-full rounded-xl" />
      </div>
    );
  }

  if (envError) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>{envError.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        {/* Subtle gradient accent line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Переменные окружения
              </CardTitle>
              <CardDescription>
                {vars.length === 0
                  ? 'Нет переменных — добавьте первую'
                  : `${vars.length} ${vars.length === 1 ? 'переменная' : vars.length < 5 ? 'переменные' : 'переменных'}`}
              </CardDescription>
            </div>

            {hasChanges && (
              <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Несохранённые изменения
              </div>
            )}
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          <EnvVarEditor vars={vars} onChange={setVars} />
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            Изменения применяются при следующем деплое.
          </p>
        </CardContent>

        <Separator />

        <CardFooter className="flex justify-end py-4">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || !hasChanges}
            className="gap-2"
          >
            {saveMutation.isPending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Сохранить изменения
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
