import { describe, expect, it, vi } from "vitest";
import {
  addUserToGroup,
  createGroup,
  listUserGroups,
  removeUserFromGroup,
} from "../src/services/group-service.js";

function mockDb(overrides: Record<string, unknown> = {}) {
  return {
    group: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "00000000-2000-4000-8000-000000000099",
        name: data.name,
        description: data.description ?? null,
        createdAt: new Date(),
      })),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(async () => null),
    },
    userGroup: {
      findUnique: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
    ...overrides,
  } as never;
}

describe("group-service", () => {
  it("creates a group and returns a safe summary", async () => {
    const db = mockDb();
    const group = await createGroup(db, { name: "contractors", description: "Interns" });

    expect(group).toHaveProperty("name", "contractors");
    expect(group).toHaveProperty("description", "Interns");
    expect(group.createdAt).toMatch(/Z$/);
  });

  it("rejects a duplicate group name", async () => {
    const db = mockDb({
      group: {
        findUnique: vi.fn(async () => ({ id: "existing" })),
        create: vi.fn(),
      },
    });

    await expect(createGroup(db, { name: "employees" })).rejects.toMatchObject({ code: "GROUP_EXISTS" });
  });

  it("adds a user to a group when both exist", async () => {
    const db = mockDb({
      user: { findUnique: vi.fn(async () => ({ id: "u1" })) },
      group: { findUnique: vi.fn(async () => ({ id: "g1" })) },
    });
    const create = (db as { userGroup: { create: ReturnType<typeof vi.fn> } }).userGroup.create;

    await addUserToGroup(db, "u1", "g1");
    expect(create).toHaveBeenCalledWith({ data: { userId: "u1", groupId: "g1" } });
  });

  it("rejects a duplicate membership", async () => {
    const db = mockDb({
      user: { findUnique: vi.fn(async () => ({ id: "u1" })) },
      group: { findUnique: vi.fn(async () => ({ id: "g1" })) },
      userGroup: { findUnique: vi.fn(async () => ({ id: "m1" })) },
    });

    await expect(addUserToGroup(db, "u1", "g1")).rejects.toMatchObject({ code: "MEMBERSHIP_EXISTS" });
  });

  it("rejects a missing group", async () => {
    const db = mockDb({
      user: { findUnique: vi.fn(async () => ({ id: "u1" })) },
      group: { findUnique: vi.fn(async () => null) },
    });

    await expect(addUserToGroup(db, "u1", "missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists only the group summaries for a user", async () => {
    const db = mockDb({
      userGroup: {
        findMany: vi.fn(async () => [
          { group: { id: "g1", name: "employees", description: "Staff", createdAt: new Date() } },
        ]),
      },
    });

    const groups = await listUserGroups(db, "u1");
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveProperty("name", "employees");
    expect(groups[0]).not.toHaveProperty("passwordHash");
  });

  it("removes a membership", async () => {
    const db = mockDb({
      userGroup: {
        findUnique: vi.fn(async () => ({ id: "m1" })),
        delete: vi.fn(async () => ({})),
      },
    });

    await removeUserFromGroup(db, "u1", "g1");
    const del = (db as { userGroup: { delete: ReturnType<typeof vi.fn> } }).userGroup.delete;
    expect(del).toHaveBeenCalledWith({ where: { userId_groupId: { userId: "u1", groupId: "g1" } } });
  });
});
