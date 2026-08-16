import type { PrismaClient } from "@sso/db";
import {
  ApiError,
  type AccessDecision,
  type AppStatus,
  type PolicySummary,
  type UserStatus,
} from "@sso/shared";

export interface UserForPolicy {
  status: UserStatus;
  groups: { groupId: string }[];
}

export interface ApplicationForPolicy {
  status: AppStatus;
  redirectUris: string[];
  policies: { groupId: string; access: AccessDecision }[];
}

export type AccessDenyReason =
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_INACTIVE"
  | "REDIRECT_URI_NOT_REGISTERED"
  | "USER_NOT_FOUND"
  | "USER_INACTIVE"
  | "NO_ALLOW_POLICY";

export interface AccessEvaluation {
  allowed: boolean;
  reason: "ALLOWED" | AccessDenyReason;
}

/**
 * Pure policy evaluation over already-resolved data. Implements spec steps 2-7:
 *  2. application active
 *  3. redirect_uri exact-match (no prefix matching)
 *  4. user active
 *  5-6. user has a group with an ALLOW policy for this application
 *
 * Central-session validity is intentionally NOT checked here: it is checked by the authorization flow.
 */
export function evaluateAccess(
  user: UserForPolicy,
  application: ApplicationForPolicy,
  redirectUri: string,
): AccessEvaluation {
  // Step 2
  if (application.status !== "ACTIVE") {
    return { allowed: false, reason: "APPLICATION_INACTIVE" };
  }

  // Step 3
  if (!application.redirectUris.includes(redirectUri)) {
    return { allowed: false, reason: "REDIRECT_URI_NOT_REGISTERED" };
  }

  // Step 4
  if (user.status !== "ACTIVE") {
    return { allowed: false, reason: "USER_INACTIVE" };
  }

  // Steps 5-6
  const userGroupIds = new Set(user.groups.map((g) => g.groupId));
  const hasAllow = application.policies.some(
    (p) => p.access === "ALLOW" && userGroupIds.has(p.groupId),
  );
  if (!hasAllow) {
    return { allowed: false, reason: "NO_ALLOW_POLICY" };
  }

  // Step 7
  return { allowed: true, reason: "ALLOWED" };
}

/**
 * DB-backed evaluation: resolves the application by client_id (step 1), the user and their groups
 */
export async function evaluateAccessForRequest(
  db: PrismaClient,
  params: { clientId: string; userId: string; redirectUri: string },
): Promise<AccessEvaluation> {
  const application = await db.application.findUnique({
    where: { clientId: params.clientId },
    include: {
      redirectUris: { select: { uri: true } },
      policies: { select: { groupId: true, access: true } },
    },
  });
  if (!application) {
    return { allowed: false, reason: "APPLICATION_NOT_FOUND" };
  }

  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { status: true, groups: { select: { groupId: true } } },
  });
  if (!user) {
    return { allowed: false, reason: "USER_NOT_FOUND" };
  }

  return evaluateAccess(
    { status: user.status, groups: user.groups },
    {
      status: application.status,
      redirectUris: application.redirectUris.map((r) => r.uri),
      policies: application.policies,
    },
    params.redirectUri,
  );
}

// Policy management (control panel)

function toSummary(p: {
  id: string;
  applicationId: string;
  groupId: string;
  access: AccessDecision;
  createdAt: Date;
  group: { name: string };
}): PolicySummary {
  return {
    id: p.id,
    applicationId: p.applicationId,
    groupId: p.groupId,
    groupName: p.group.name,
    access: p.access,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function listPolicies(db: PrismaClient, applicationId: string): Promise<PolicySummary[]> {
  const rows = await db.applicationGroupPolicy.findMany({
    where: { applicationId, access: "ALLOW" },
    include: { group: { select: { name: true } } },
  });

  return rows
    .map((p) => toSummary(p as unknown as Parameters<typeof toSummary>[0]))
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
}

export interface AddPolicyInput {
  applicationId: string;
  groupId: string;
  access?: AccessDecision;
}

export async function addPolicy(db: PrismaClient, input: AddPolicyInput): Promise<PolicySummary> {
  const access = input.access ?? "ALLOW";

  const application = await db.application.findUnique({
    where: { id: input.applicationId },
    select: { id: true },
  });
  if (!application) throw new ApiError("Application not found", { statusCode: 404, code: "NOT_FOUND" });

  const group = await db.group.findUnique({
    where: { id: input.groupId },
    select: { id: true, name: true },
  });
  if (!group) throw new ApiError("Group not found", { statusCode: 404, code: "NOT_FOUND" });

  const existing = await db.applicationGroupPolicy.findUnique({
    where: { applicationId_groupId_access: { applicationId: input.applicationId, groupId: input.groupId, access } },
  });
  if (existing) throw new ApiError("Policy already exists", { statusCode: 409, code: "POLICY_EXISTS" });

  const policy = await db.applicationGroupPolicy.create({
    data: { applicationId: input.applicationId, groupId: input.groupId, access },
    include: { group: { select: { name: true } } },
  });

  return toSummary(policy as unknown as Parameters<typeof toSummary>[0]);
}

export async function removePolicy(
  db: PrismaClient,
  applicationId: string,
  groupId: string,
  access: AccessDecision = "ALLOW",
): Promise<void> {
  const existing = await db.applicationGroupPolicy.findUnique({
    where: { applicationId_groupId_access: { applicationId, groupId, access } },
  });
  if (!existing) throw new ApiError("Policy not found", { statusCode: 404, code: "NOT_FOUND" });

  await db.applicationGroupPolicy.delete({
    where: { applicationId_groupId_access: { applicationId, groupId, access } },
  });
}
