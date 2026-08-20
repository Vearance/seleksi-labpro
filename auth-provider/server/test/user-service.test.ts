import { describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@sso/shared";
import { createUser, listUsers } from "../src/services/user-service.js";

function mockDb(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "00000000-0000-4000-8000-000000000099",
        name: data.name,
        email: data.email,
        status: data.status ?? "ACTIVE",
        createdAt: new Date(),
      })),
    },
    ...overrides,
  } as never;
}

describe("user-service", () => {
  it("hashes the password before storing (never plaintext)", async () => {
    const db = mockDb();
    await createUser(db, { name: "Aloi", email: "aloi@example.com", password: "secret123" });

    const createCall = (db as { user: { create: ReturnType<typeof vi.fn> } }).user.create.mock
      .calls[0]![0] as { data: { passwordHash: string } };
    const hash = createCall.data.passwordHash;

    expect(hash).not.toBe("secret123");
    expect(await verifyPassword(hash, "secret123")).toBe(true);
  });

  it("rejects a duplicate email", async () => {
    const db = mockDb({
      user: {
        findUnique: vi.fn(async () => ({ id: "existing" })),
        create: vi.fn(),
      },
    });

    await expect(
      createUser(db, { name: "Bob", email: "dup@example.com", password: "secret123" }),
    ).rejects.toMatchObject({ code: "EMAIL_EXISTS" });
  });

  it("never exposes passwordHash in listUsers", async () => {
    const db = mockDb({
      user: {
        findMany: vi.fn(async () => [
          { id: "u1", name: "Aloi", email: "aloi@example.com", status: "ACTIVE", createdAt: new Date() },
        ]),
      },
    });

    const users = await listUsers(db);
    expect(users[0]).not.toHaveProperty("passwordHash");
    expect(users[0]).toHaveProperty("email", "aloi@example.com");
  });
});
