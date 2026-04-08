import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, AlertCircle } from 'lucide-react';

import { fetchProject, updateProject, deleteProject } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: project,
    isLoading,
    error: projectError,
  } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });

  const [branch, setBranch] = useState('');
  const [buildCmd, setBuildCmd] = useState('');
  const [startCmd, setStartCmd] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [rootDir, setRootDir] = useState('');

  useEffect(() => {
    if (!project) return;
    setBranch(project.branch ?? '');
    setBuildCmd(project.buildCmd ?? '');
    setStartCmd(project.startCmd ?? '');
    setOutputDir(project.outputDir ?? '');
    setRootDir(project.rootDir ?? '');
  }, [project]);

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateProject>[1]) => updateProject(id!, data),
    onSuccess: () => {
      toast.success('Сохранено');
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: () => toast.error('Ошибка сохранения'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(id!),
    onSuccess: () => {
      toast.success('Проект удалён');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate('/');
    },
    onError: () => toast.error('Ошибка удаления'),
  });

  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSave = () => {
    updateMutation.mutate({
      branch,
      buildCmd,
      startCmd,
      outputDir,
      rootDir: rootDir || null,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[360px] w-full rounded-xl" />
        <Skeleton className="h-[140px] w-full rounded-xl" />
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ошибка загрузки</AlertTitle>
          <AlertDescription>{projectError.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="space-y-6">
      {/* Build configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Конфигурация сборки</CardTitle>
          <CardDescription>Параметры сборки и запуска проекта</CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          {/* Editable fields */}
          <div className="space-y-2">
            <Label htmlFor="branch">Branch</Label>
            <Input id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="buildCmd">Build command</Label>
            <Input
              id="buildCmd"
              value={buildCmd}
              onChange={(e) => setBuildCmd(e.target.value)}
              placeholder="npm run build"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="startCmd">Start command</Label>
            <Input
              id="startCmd"
              value={startCmd}
              onChange={(e) => setStartCmd(e.target.value)}
              placeholder="npm start"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="outputDir">Output directory</Label>
            <Input
              id="outputDir"
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder="dist"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rootDir">Root Directory</Label>
            <Input
              id="rootDir"
              value={rootDir}
              onChange={(e) => setRootDir(e.target.value)}
              placeholder="Leave empty to use repository root"
            />
            <p className="text-xs text-muted-foreground">
              Subdirectory to use as the build root. Useful for monorepos (e.g.{' '}
              <code className="text-foreground">apps/frontend</code>).
            </p>
          </div>

          {/* Read-only fields */}
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input id="port" value={project.port} disabled />
          </div>

          <div className="space-y-2">
            <Label>Framework</Label>
            <p className="text-sm text-muted-foreground pt-2">{project.framework ?? '—'}</p>
          </div>

          <div className="space-y-2">
            <Label>Repository</Label>
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:underline pt-2"
            >
              {project.repoUrl}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </CardContent>

        <CardFooter>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </CardFooter>
      </Card>

      <Separator />

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Удаление проекта удалит systemd-сервис, конфиг Caddy, директории. Это необратимо.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Удалить проект
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Удалить проект?"
        description={`Введите имя проекта «${project.name}», чтобы подтвердить удаление. Это действие необратимо.`}
        confirmText={project.name}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
