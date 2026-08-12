import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "@sso/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma = new PrismaClient({ adapter });

const USERS = {
  admin: "00000000-1000-4000-8000-000000000001",
  alice: "00000000-1000-4000-8000-000000000002",
  bob: "00000000-1000-4000-8000-000000000003",
  charlie: "00000000-1000-4000-8000-000000000004",
} as const;

const GROUPS = {
  admin: "00000000-2000-4000-8000-000000000001",
  employees: "00000000-2000-4000-8000-000000000002",
  contractors: "00000000-2000-4000-8000-000000000003",
} as const;

const APPS = {
  appA: "00000000-3000-4000-8000-000000000001",
  appB: "00000000-3000-4000-8000-000000000002",
} as const;

function env(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

async function seed(): Promise<void> {
  const adminPassword = env("SEED_ADMIN_PASSWORD");
  const demoPassword = env("SEED_DEMO_PASSWORD");
  const appAClientId = env("APP_A_CLIENT_ID");
  const appASecret = env("APP_A_CLIENT_SECRET");
  const appBClientId = env("APP_B_CLIENT_ID");
  const appBSecret = env("APP_B_CLIENT_SECRET");

  console.log("[seed] Hashing secrets …");
  const [adminHash, demoHash, appAHash, appBHash] = await Promise.all([
    hashPassword(adminPassword),
    hashPassword(demoPassword),
    hashPassword(appASecret),
    hashPassword(appBSecret),
  ]);

  console.log("[seed] Seeding users …");
  const userArgs = [
    { id: USERS.admin, name: "Admin", email: env("SEED_ADMIN_EMAIL"), passwordHash: adminHash, status: "ACTIVE" as const },
    { id: USERS.alice, name: "Alice", email: "alice@example.com", passwordHash: demoHash, status: "ACTIVE" as const },
    { id: USERS.bob, name: "Bob", email: "bob@example.com", passwordHash: demoHash, status: "ACTIVE" as const },
    { id: USERS.charlie, name: "Charlie", email: "charlie@example.com", passwordHash: demoHash, status: "ACTIVE" as const },
  ];
  for (const args of userArgs) {
    await prisma.user.upsert({ where: { id: args.id }, create: args, update: {} });
  }

  console.log("[seed] Seeding groups …");
  const groupArgs = [
    { id: GROUPS.admin, name: "admin", description: "Administrator" },
    { id: GROUPS.employees, name: "employees", description: "Permanent employees" },
    { id: GROUPS.contractors, name: "contractors", description: "Contractors & interns" },
  ];
  for (const args of groupArgs) {
    await prisma.group.upsert({ where: { id: args.id }, create: args, update: {} });
  }

  console.log("[seed] Seeding memberships …");
  const memberships = [
    { userId: USERS.admin, groupId: GROUPS.admin },
    { userId: USERS.alice, groupId: GROUPS.employees },
    { userId: USERS.bob, groupId: GROUPS.employees },
    { userId: USERS.charlie, groupId: GROUPS.contractors },
  ];
  for (const m of memberships) {
    await prisma.userGroup.upsert({ where: { userId_groupId: m }, create: m, update: {} });
  }

  console.log("[seed] Seeding applications …");
  const appA = await prisma.application.upsert({
    where: { id: APPS.appA },
    create: { id: APPS.appA, clientId: appAClientId, name: "App A", clientSecretHash: appAHash, launchUrl: "http://localhost:4001/", logoutNotificationUrl: "http://app-a:4001/internal/logout", status: "ACTIVE" },
    update: {},
  });
  const appB = await prisma.application.upsert({
    where: { id: APPS.appB },
    create: { id: APPS.appB, clientId: appBClientId, name: "App B", clientSecretHash: appBHash, launchUrl: "http://localhost:4002/", logoutNotificationUrl: "http://app-b:4002/internal/logout", status: "ACTIVE" },
    update: {},
  });

  console.log("[seed] Seeding redirect URIs …");
  for (const [appId, uri] of [[appA.id, "http://localhost:4001/callback"], [appB.id, "http://localhost:4002/callback"]] as const) {
    await prisma.applicationRedirectUri.upsert({
      where: { applicationId_uri: { applicationId: appId, uri } },
      create: { applicationId: appId, uri },
      update: {},
    });
  }

  console.log("[seed] Seeding access policies …");
  const policies = [
    { applicationId: appA.id, groupId: GROUPS.employees, access: "ALLOW" as const },
    { applicationId: appA.id, groupId: GROUPS.contractors, access: "ALLOW" as const },
    { applicationId: appB.id, groupId: GROUPS.employees, access: "ALLOW" as const },
  ];
  await prisma.applicationGroupPolicy.createMany({ data: policies, skipDuplicates: true });

  console.log("[seed] Done.");
}

seed().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
