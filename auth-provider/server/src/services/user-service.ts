import type { PrismaClient } from "@sso/db";
import { ApiError, hashPassword, type UserStatus, type UserSummary } from "@sso/shared";

// Don't expose passwordHash
const SAFE_USER = {
  id: true,
  name: true,
  email: true,
  status: true,
  createdAt: true,
} as const;

type SafeUserRow = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  createdAt: Date;
};

function toSummary(user: SafeUserRow): UserSummary {
  return { ...user, createdAt: user.createdAt.toISOString() };
}

export async function listUsers(db: PrismaClient): Promise<UserSummary[]> {
  const users = await db.user.findMany({
    select: SAFE_USER,
    orderBy: { createdAt: "desc" },
  });
  return users.map(toSummary);
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  status?: UserStatus;
}

export async function createUser(db: PrismaClient, input: CreateUserInput): Promise<UserSummary> {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ApiError("Email already exists", { statusCode: 409, code: "EMAIL_EXISTS" });
  }

  const passwordHash = await hashPassword(input.password);

  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      status: input.status ?? "ACTIVE",
    },
    select: SAFE_USER,
  });
  return toSummary(user as SafeUserRow);
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  status?: UserStatus;
  password?: string;
}

export async function updateUser(db: PrismaClient, id: string, input: UpdateUserInput): Promise<UserSummary> {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.email !== undefined) data.email = input.email;
  if (input.status !== undefined) data.status = input.status;
  if (input.password) data.passwordHash = await hashPassword(input.password);

  const user = await db.user.update({
    where: { id },
    data,
    select: SAFE_USER,
  });
  return toSummary(user as SafeUserRow);
}
