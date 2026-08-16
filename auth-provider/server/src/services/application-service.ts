import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@sso/db";
import {
  ApiError,
  hashPassword,
  randomToken,
  type AppStatus,
  type ApplicationSummary,
} from "@sso/shared";

interface ApplicationWithRedirectUris {
  id: string;
  clientId: string;
  name: string;
  launchUrl: string | null;
  logoutNotificationUrl: string;
  status: AppStatus;
  createdAt: Date;
  redirectUris: { uri: string }[];
}

function toSummary(app: ApplicationWithRedirectUris): ApplicationSummary {
  return {
    id: app.id,
    clientId: app.clientId,
    name: app.name,
    launchUrl: app.launchUrl,
    logoutNotificationUrl: app.logoutNotificationUrl,
    status: app.status,
    redirectUris: app.redirectUris.map((r) => r.uri),
    createdAt: app.createdAt.toISOString(),
  };
}

function normalizeUris(uris: string[]): string[] {
  const trimmed = uris.map((uri) => uri.trim()).filter(Boolean);
  if (new Set(trimmed).size !== trimmed.length) {
    throw new ApiError("Redirect URIs must be unique", { statusCode: 400, code: "DUPLICATE_REDIRECT_URI" });
  }
  return trimmed;
}

export async function listApplications(db: PrismaClient): Promise<ApplicationSummary[]> {
  const apps = await db.application.findMany({
    include: { redirectUris: true },
    orderBy: { createdAt: "desc" },
  });
  return apps.map((a) => toSummary(a as unknown as ApplicationWithRedirectUris));
}

export interface CreateApplicationInput {
  name: string;
  launchUrl?: string | null;
  logoutNotificationUrl: string;
  redirectUris: string[];
  status?: AppStatus;
}

export interface CreatedApplication {
  application: ApplicationSummary;
  clientSecret: string;
}

export async function createApplication(
  db: PrismaClient,
  input: CreateApplicationInput,
): Promise<CreatedApplication> {
  const redirectUris = normalizeUris(input.redirectUris);
  if (redirectUris.length === 0) {
    throw new ApiError("At least one redirect URI is required", {
      statusCode: 400,
      code: "REDIRECT_URI_REQUIRED",
    });
  }

  const clientId = randomUUID();
  const clientSecret = randomToken(32);
  const clientSecretHash = await hashPassword(clientSecret);

  const app = await db.$transaction(async (tx) => {
    return tx.application.create({
      data: {
        clientId,
        name: input.name,
        clientSecretHash,
        launchUrl: input.launchUrl ?? null,
        logoutNotificationUrl: input.logoutNotificationUrl,
        status: input.status ?? "ACTIVE",
        redirectUris: { create: redirectUris.map((uri) => ({ uri })) },
      },
      include: { redirectUris: true },
    });
  });

  return {
    application: toSummary(app as unknown as ApplicationWithRedirectUris),
    clientSecret,
  };
}

export interface UpdateApplicationInput {
  name?: string;
  launchUrl?: string | null;
  logoutNotificationUrl?: string;
  status?: AppStatus;
  redirectUris?: string[];
}

export async function updateApplication(
  db: PrismaClient,
  id: string,
  input: UpdateApplicationInput,
): Promise<ApplicationSummary> {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.launchUrl !== undefined) data.launchUrl = input.launchUrl;
  if (input.logoutNotificationUrl !== undefined) data.logoutNotificationUrl = input.logoutNotificationUrl;
  if (input.status !== undefined) data.status = input.status;

  const redirectUris = input.redirectUris !== undefined ? normalizeUris(input.redirectUris) : undefined;
  if (redirectUris !== undefined && redirectUris.length === 0) {
    throw new ApiError("At least one redirect URI is required", {
      statusCode: 400,
      code: "REDIRECT_URI_REQUIRED",
    });
  }

  const app = await db.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.application.update({ where: { id }, data });
    }

    if (redirectUris !== undefined) {
      await tx.applicationRedirectUri.deleteMany({ where: { applicationId: id } });
      await tx.applicationRedirectUri.createMany({
        data: redirectUris.map((uri) => ({ applicationId: id, uri })),
      });
    }

    return tx.application.findUniqueOrThrow({
      where: { id },
      include: { redirectUris: true },
    });
  });

  return toSummary(app as unknown as ApplicationWithRedirectUris);
}
