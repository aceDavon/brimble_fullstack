import { pgTable, uuid, text, integer, timestamp, serial } from "drizzle-orm/pg-core";

export const deploymentStatus = [
  "pending",
  "building",
  "deploying",
  "running",
  "failed",
] as const;

export type DeploymentStatus = (typeof deploymentStatus)[number];

export const deployments = pgTable("deployments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  sourceType: text("source_type", { enum: ["git", "upload"] }).notNull(),
  sourceUrl: text("source_url"),
  status: text("status", { enum: deploymentStatus }).notNull().default("pending"),
  imageTag: text("image_tag"),
  containerId: text("container_id"),
  containerPort: integer("container_port"),
  caddyRoutePath: text("caddy_route_path"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  deploymentId: uuid("deployment_id")
    .notNull()
    .references(() => deployments.id, { onDelete: "cascade" }),
  phase: text("phase", { enum: ["build", "deploy", "system"] }).notNull(),
  message: text("message").notNull(),
  ts: timestamp("ts").defaultNow().notNull(),
});

export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
export type Log = typeof logs.$inferSelect;
