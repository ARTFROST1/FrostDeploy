import { Eye, EyeOff, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
}

interface EnvVarEditorProps {
  vars: EnvVar[];
  onChange: (vars: EnvVar[]) => void;
}

export function EnvVarEditor({ vars, onChange }: EnvVarEditorProps) {
  const update = (index: number, patch: Partial<EnvVar>) => {
    const next = vars.map((v, i) => (i === index ? { ...v, ...patch } : v));
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(vars.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...vars, { key: '', value: '', isSecret: true }]);
  };

  return (
    <div className="space-y-3">
      {vars.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
          <span>Ключ</span>
          <span>Значение</span>
          <span className="w-9" />
          <span className="w-9" />
        </div>
      )}

      {vars.map((v, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
          <Input
            value={v.key}
            onChange={(e) => {
              const upper = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
              update(i, { key: upper });
            }}
            placeholder="KEY_NAME"
            className="font-mono text-sm"
          />
          <Input
            type={v.isSecret ? 'password' : 'text'}
            value={v.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder="Value"
            className="font-mono text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => update(i, { isSecret: !v.isSecret })}
            className={cn(
              'text-muted-foreground hover:text-foreground',
              !v.isSecret && 'text-foreground',
            )}
            title={v.isSecret ? 'Показать значение' : 'Скрыть значение'}
          >
            {v.isSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(i)}
            className="text-muted-foreground hover:text-destructive"
            title="Удалить переменную"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={add} className="mt-1">
        <Plus className="h-4 w-4" />
        Добавить
      </Button>
    </div>
  );
}
