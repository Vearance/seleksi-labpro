import type { PrismaClient } from "@sso/db";
import { ApiError, type GroupSummary } from "@sso/shared";

const SAFE_GROUP = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
} as const;

type SafeGroupRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
};

function toSummary(group: SafeGroupRow): GroupSummary {
  return { ...group, createdAt: group.createdAt.toISOString() };
}

export async function listGroups(db: PrismaClient): Promise<GroupSummary[]> {
  const groups = await db.group.findMany({
    select: SAFE_GROUP,
    orderBy: { name: "asc" },
  });
  return groups.map((g) => toSummary(g as SafeGroupRow));
}

export interface CreateGroupInput {
  name: string;
  description?: string;
}

export async function createGroup(db: PrismaClient, input: CreateGroupInput): Promise<GroupSummary> {
  const existing = await db.group.findUnique({ where: { name: input.name } });
  if (existing) {
    throw new ApiError("Group name already exists", { statusCode: 409, code: "GROUP_EXISTS" });
  }

  const group = await db.group.create({
    data: { name: input.name, description: input.description ?? null },
    select: SAFE_GROUP,
  });
  return toSummary(group as SafeGroupRow);
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
}

export async function updateGroup(db: PrismaClient, id: string, input: UpdateGroupInput): Promise<GroupSummary> {
  const data: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const existing = await db.group.findUnique({ where: { name: input.name } });
    if (existing && existing.id !== id) {
      throw new ApiError("Group name already exists", { statusCode: 409, code: "GROUP_EXISTS" });
    }
    data.name = input.name;
  }
  if (input.description !== undefined) data.description = input.description;

  if (Object.keys(data).length === 0) {
    const current = await db.group.findUnique({ where: { id }, select: SAFE_GROUP });
    if (!current) throw new ApiError("Group not found", { statusCode: 404, code: "NOT_FOUND" });
    return toSummary(current as SafeGroupRow);
  }

  const group = await db.group.update({
    where: { id },
    data,
    select: SAFE_GROUP,
  });
  return toSummary(group as SafeGroupRow);
}

// --- Membership ---

export async function listUserGroups(db: PrismaClient, userId: string): Promise<GroupSummary[]> {
  const memberships = await db.userGroup.findMany({
    where: { userId },
    select: { group: { select: SAFE_GROUP } },
  });
  return memberships
    .map((m) => toSummary(m.group as SafeGroupRow))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function addUserToGroup(db: PrismaClient, userId: string, groupId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new ApiError("User not found", { statusCode: 404, code: "NOT_FOUND" });

  const group = await db.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) throw new ApiError("Group not found", { statusCode: 404, code: "NOT_FOUND" });

  const existing = await db.userGroup.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (existing) {
    throw new ApiError("User already in group", { statusCode: 409, code: "MEMBERSHIP_EXISTS" });
  }

  await db.userGroup.create({ data: { userId, groupId } });
}

export async function removeUserFromGroup(db: PrismaClient, userId: string, groupId: string): Promise<void> {
  const existing = await db.userGroup.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!existing) throw new ApiError("Membership not found", { statusCode: 404, code: "NOT_FOUND" });

  await db.userGroup.delete({ where: { userId_groupId: { userId, groupId } } });
}
