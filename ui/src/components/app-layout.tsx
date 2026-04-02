import { Outlet } from 'react-router';
import { Menu } from 'lucide-react';
import AuthGuard from './auth-guard';
import Sidebar from './sidebar';
import { useSidebar } from '@/hooks/use-sidebar';
import { Button } from '@/components/ui/button';

export default function AppLayout() {
  const sidebar = useSidebar();

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop / Tablet: inline sidebar */}
        {sidebar.mode !== 'mobile' && (
          <Sidebar
            mode={sidebar.mode}
            isCollapsed={sidebar.isCollapsed}
            isOpen={false}
            onToggle={sidebar.toggle}
            onClose={sidebar.close}
          />
        )}

        {/* Mobile: overlay sidebar */}
        {sidebar.mode === 'mobile' && sidebar.isOpen && (
          <div className="fixed inset-0 z-40 flex">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 transition-opacity duration-200"
              onClick={sidebar.close}
              aria-hidden="true"
            />
            {/* Sidebar panel */}
            <div className="relative z-50 animate-in slide-in-from-left duration-200">
              <Sidebar
                mode="mobile"
                isCollapsed={false}
                isOpen={true}
                onToggle={sidebar.toggle}
                onClose={sidebar.close}
              />
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile top bar */}
          {sidebar.mode === 'mobile' && (
            <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={sidebar.toggle}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label="Открыть меню"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>
          )}

          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1280px] px-4 py-6 lg:px-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
