import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Globe,
  ExternalLink,
  ShieldCheck,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Copy,
  AlertCircle,
} from 'lucide-react';
import {
  fetchProject,
  setProjectDomain,
  removeProjectDomain,
  fetchProjectDnsRecords,
  verifyProjectDns,
  fetchProjectSslStatus,
} from '@/api/projects';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/confirm-dialog';

function isValidDomain(value: string): boolean {
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(
    value,
  );
}

function copyToClipboard(value: string) {
  navigator.clipboard.writeText(value);
  toast.success('Скопировано');
}

export default function ProjectDomainPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [domainInput, setDomainInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [verifyError, setVerifyError] = useState<{
    actualIp?: string;
    expectedIp?: string;
  } | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });

  // Domain info from project.domains array
   
  const projectDomains = (
    project as unknown as {
      domains?: Array<{ domain: string; sslStatus: string; verifiedAt: string | null }>;
    }
  )?.domains;
  const domainInfo = projectDomains?.[0];

  const hasDomain = !!project?.domain;
  const sslStatus = domainInfo?.sslStatus ?? null;
  const isVerified = !!domainInfo?.verifiedAt;
  const isSslPending = sslStatus === 'pending' || sslStatus === 'provisioning';
  const isSslActive = sslStatus === 'active';

  // DNS records query — only when domain exists and not fully active
  const { data: dnsData, isLoading: dnsLoading } = useQuery({
    queryKey: ['project-dns', id],
    queryFn: () => fetchProjectDnsRecords(id!),
    enabled: !!id && hasDomain && !isSslActive,
  });

  // SSL status polling — only when SSL is pending
  useQuery({
    queryKey: ['project-ssl', id],
    queryFn: () => fetchProjectSslStatus(id!),
    enabled: !!id && hasDomain && isSslPending,
    refetchInterval: 5000,
    select: (data) => {
      // When SSL becomes active, invalidate project to refresh all data
      if (data.sslStatus === 'active') {
        queryClient.invalidateQueries({ queryKey: ['project', id] });
      }
      return data;
    },
  });

  // Mutations
  const setDomainMutation = useMutation({
    mutationFn: (domain: string) => setProjectDomain(id!, domain),
    onSuccess: () => {
      toast.success('Домен добавлен');
      setDomainInput('');
      setIsEditing(false);
      setVerifyError(null);
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['project-dns', id] });
    },
    onError: () => toast.error('Не удалось добавить домен'),
  });

  const removeDomainMutation = useMutation({
    mutationFn: () => removeProjectDomain(id!),
    onSuccess: () => {
      toast.success('Домен удалён');
      setConfirmRemoveOpen(false);
      setVerifyError(null);
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
    onError: () => toast.error('Не удалось удалить домен'),
  });

  const verifyDnsMutation = useMutation({
    mutationFn: () => verifyProjectDns(id!),
    onSuccess: (data) => {
      if (data.verified) {
        toast.success('DNS подтверждён');
        setVerifyError(null);
        queryClient.invalidateQueries({ queryKey: ['project', id] });
      } else {
        setVerifyError({
          actualIp: data.actualIp,
          expectedIp: data.expectedIp,
        });
      }
    },
    onError: () => toast.error('Ошибка проверки DNS'),
  });

  const handleAddDomain = () => {
    const value = domainInput.trim();
    if (!value || !isValidDomain(value)) {
      toast.error('Введите корректный домен');
      return;
    }
    setDomainMutation.mutate(value);
  };

  const handleStartEdit = () => {
    if (hasDomain) {
      setConfirmRemoveOpen(true);
    } else {
      setIsEditing(true);
    }
  };

  const handleConfirmRemoveAndEdit = () => {
    removeDomainMutation.mutate();
    setIsEditing(true);
  };

  // Loading skeleton
  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </div>
    );
  }

  if (!project) return null;

  // ── State A: No domain ──────────────────────────────────────────
  if (!hasDomain || isEditing) {
    return (
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <CardTitle>Домен</CardTitle>
            </div>
            <CardDescription>Привяжите домен к вашему проекту для доступа по HTTPS</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="example.com"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddDomain();
                }}
              />
              <Button
                onClick={handleAddDomain}
                disabled={!domainInput.trim() || setDomainMutation.isPending}
              >
                {setDomainMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Добавить домен
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Проект доступен по IP:{' '}
              <code className="font-mono">
                http://{dnsData?.serverIp ?? '…'}:{project.port}
              </code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── State D: SSL active ─────────────────────────────────────────
  if (isSslActive) {
    return (
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                <CardTitle>{project.domain}</CardTitle>
              </div>
              <Badge
                variant="default"
                className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              >
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                SSL ✅
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <a
                href={`https://${project.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:underline"
              >
                https://{project.domain}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            {domainInfo?.verifiedAt && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                DNS подтверждён: {new Date(domainInfo.verifiedAt).toLocaleDateString('ru-RU')}
              </p>
            )}
            <Separator />
            <Button variant="outline" size="sm" onClick={handleStartEdit} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Изменить
            </Button>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={confirmRemoveOpen}
          onOpenChange={setConfirmRemoveOpen}
          title="Удалить текущий домен?"
          description={`Домен «${project.domain}» будет отвязан от проекта. SSL-сертификат будет удалён. Вы сможете привязать новый домен.`}
          confirmText="Удалить"
          onConfirm={handleConfirmRemoveAndEdit}
          loading={removeDomainMutation.isPending}
        />
      </div>
    );
  }

  // ── State C: SSL pending/provisioning ───────────────────────────
  if (isVerified && isSslPending) {
    return (
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                <CardTitle>{project.domain}</CardTitle>
              </div>
              <Badge variant="secondary" className="text-blue-500 border-blue-500/20">
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                SSL выпускается…
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              DNS настроен ✓. Ожидается выпуск SSL-сертификата…
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['project-ssl', id] })}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Проверить статус
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── State B: Domain added, DNS not verified ─────────────────────
  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              <CardTitle>{project.domain}</CardTitle>
            </div>
            <Badge variant="secondary" className="text-amber-500 border-amber-500/20">
              DNS не настроен
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* DNS records table */}
          {dnsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : dnsData?.records && dnsData.records.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Тип</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Имя</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Значение
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Описание
                    </th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {dnsData.records.map((record, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{record.type}</td>
                      <td className="px-3 py-2 font-mono text-xs">{record.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{record.value}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {record.description}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyToClipboard(record.value)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Добавьте эти записи в DNS вашего домена и нажмите «Проверить DNS»
          </p>

          {/* Verify error */}
          {verifyError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                DNS не настроен. Текущий IP: {verifyError.actualIp ?? '—'}, ожидается:{' '}
                {verifyError.expectedIp ?? '—'}
              </AlertDescription>
            </Alert>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => verifyDnsMutation.mutate()}
              disabled={verifyDnsMutation.isPending}
              className="gap-1.5"
            >
              {verifyDnsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <RefreshCw className="h-3.5 w-3.5" />
              Проверить DNS
            </Button>
            <Button variant="outline" size="default" onClick={handleStartEdit} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Изменить
            </Button>
            <Button
              variant="outline"
              size="default"
              onClick={() => setConfirmRemoveOpen(true)}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Удалить
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        title="Удалить домен?"
        description={`Домен «${project.domain}» будет отвязан от проекта. Это действие необратимо.`}
        confirmText="Удалить"
        onConfirm={() => removeDomainMutation.mutate()}
        loading={removeDomainMutation.isPending}
      />
    </div>
  );
}
