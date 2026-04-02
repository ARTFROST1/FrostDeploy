import { relations } from 'drizzle-orm';
import { projects } from './projects';
import { deployments } from './deployments';
import { envVariables } from './env-variables';
import { domains } from './domains';
import { deployLocks } from './deploy-locks';

export const projectsRelations = relations(projects, ({ many, one }) => ({
  deployments: many(deployments),
  envVariables: many(envVariables),
  domains: many(domains),
  deployLock: one(deployLocks),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  project: one(projects, {
    fields: [deployments.projectId],
    references: [projects.id],
  }),
}));

export const envVariablesRelations = relations(envVariables, ({ one }) => ({
  project: one(projects, {
    fields: [envVariables.projectId],
    references: [projects.id],
  }),
}));

export const domainsRelations = relations(domains, ({ one }) => ({
  project: one(projects, {
    fields: [domains.projectId],
    references: [projects.id],
  }),
}));

export const deployLocksRelations = relations(deployLocks, ({ one }) => ({
  project: one(projects, {
    fields: [deployLocks.projectId],
    references: [projects.id],
  }),
  deployment: one(deployments, {
    fields: [deployLocks.deploymentId],
    references: [deployments.id],
  }),
}));
