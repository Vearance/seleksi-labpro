import { describe, expect, it, vi } from "vitest";
import { verifyPassword } from "@sso/shared";
import {
  createApplication,
  listApplications,
} from "../src/services/application-service.js";

function mockDb(overrides: Record<string, unknown> = {}) {
  const tx = {
    application: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "00000000-3000-4000-8000-000000000099",
        clientId: data.clientId,
        name: data.name,
        launchUrl: data.launchUrl ?? null,
        logoutNotificationUrl: data.logoutNotificationUrl,
        status: data.status ?? "ACTIVE",
        createdAt: new Date(),
        redirectUris: ((data.redirectUris as { create?: { uri: string }[] }).create ?? []).map(
          (r) => ({ uri: r.uri }),
        ),
      })),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    applicationRedirectUri: {
      deleteMany: vi.fn(async () => ({})),
      createMany: vi.fn(async () => ({})),
    },
  };

  const db = {
    application: {
      findMany: vi.fn(async () => []),
    },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    ...overrides,
  } as never;

  return { db, tx };
}

describe("application-service", () => {
  it("hashes the generated client secret and never exposes the hash", async () => {
    const { db, tx } = mockDb();
    const result = await createApplication(db, {
      name: "App A",
      logoutNotificationUrl: "http://app-a:4001/internal/logout",
      redirectUris: ["http://localhost:4001/callback"],
    });

    expect(result.clientSecret).toBeTruthy();
    expect(result.application).not.toHaveProperty("clientSecretHash");

    const createCall = tx.application.create.mock.calls[0]![0] as {
      data: { clientSecretHash: string };
    };
    const hash = createCall.data.clientSecretHash;

    expect(hash).not.toBe(result.clientSecret);
    expect(await verifyPassword(hash, result.clientSecret)).toBe(true);
  });

  it("rejects an empty redirect URI list", async () => {
    const { db } = mockDb();
    await expect(
      createApplication(db, {
        name: "App A",
        logoutNotificationUrl: "http://app-a:4001/internal/logout",
        redirectUris: [],
      }),
    ).rejects.toMatchObject({ code: "REDIRECT_URI_REQUIRED" });
  });

  it("rejects duplicate redirect URIs", async () => {
    const { db } = mockDb();
    await expect(
      createApplication(db, {
        name: "App A",
        logoutNotificationUrl: "http://app-a:4001/internal/logout",
        redirectUris: ["http://localhost/callback", "http://localhost/callback"],
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_REDIRECT_URI" });
  });

  it("maps redirect URIs and never exposes clientSecretHash in listApplications", async () => {
    const { db } = mockDb({
      application: {
        findMany: vi.fn(async () => [
          {
            id: "a1",
            clientId: "c1",
            name: "App A",
            launchUrl: null,
            logoutNotificationUrl: "http://x/internal/logout",
            status: "ACTIVE",
            createdAt: new Date(),
            redirectUris: [{ uri: "http://localhost/callback" }],
          },
        ]),
      },
    });

    const apps = await listApplications(db);
    expect(apps[0]!.redirectUris).toEqual(["http://localhost/callback"]);
    expect(apps[0]).not.toHaveProperty("clientSecretHash");
  });
});
