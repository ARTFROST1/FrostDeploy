import { createBrowserRouter } from 'react-router';

import AppLayout from './components/app-layout';
import ProjectLayout from './components/project-layout';
import LoginPage from './pages/login';
import SetupPage from './pages/setup';
import DashboardPage from './pages/dashboard';
import NewProjectPage from './pages/new-project';
import ProjectOverviewPage from './pages/project-overview';
import ProjectDeploysPage from './pages/project-deploys';
import DeployConsolePage from './pages/deploy-console';
import ProjectEnvPage from './pages/project-env';
import ProjectLogsPage from './pages/project-logs';
import ProjectSettingsPage from './pages/project-settings';
import PlatformSettingsPage from './pages/platform-settings';
import NotFoundPage from './pages/not-found';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/setup',
    element: <SetupPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'projects/new',
        element: <NewProjectPage />,
      },
      {
        path: 'projects/:id',
        element: <ProjectLayout />,
        children: [
          {
            index: true,
            element: <ProjectOverviewPage />,
          },
          {
            path: 'deploys',
            element: <ProjectDeploysPage />,
          },
          {
            path: 'deploys/:deployId',
            element: <DeployConsolePage />,
          },
          {
            path: 'env',
            element: <ProjectEnvPage />,
          },
          {
            path: 'logs',
            element: <ProjectLogsPage />,
          },
          {
            path: 'settings',
            element: <ProjectSettingsPage />,
          },
        ],
      },
      {
        path: 'settings',
        element: <PlatformSettingsPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
