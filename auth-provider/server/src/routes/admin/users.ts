import type { FastifyInstance } from "fastify";
import type { UserStatus } from "@sso/shared";
import { requireAdmin } from "../../plugins/admin-auth.js";
import * as userService from "../../services/user-service.js";
import * as revocationTriggerService from "../../services/revocation-trigger-service.js";

const createUserSchema = {
  body: {
    type: "object",
    required: ["name", "email", "password"],
    properties: {
      name: { type: "string", minLength: 1 },
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 8 },
      status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
    },
  },
} as const;

export async function adminUsersRoutes(server: FastifyInstance): Promise<void> {
  server.get("/users", { preHandler: requireAdmin }, async () => {
    return userService.listUsers(server.db);
  });

  server.post("/users", { preHandler: requireAdmin, schema: createUserSchema }, async (request) => {
    const body = request.body as {
      name: string;
      email: string;
      password: string;
      status?: UserStatus;
    };
    return userService.createUser(server.db, body);
  });

  server.patch("/users/:id", { preHandler: requireAdmin }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as userService.UpdateUserInput;

    const result = await userService.updateUser(server.db, id, body);

    // Revocation triggers: revoke all sessions + emit the matching event.
    if (body.password) {
      await revocationTriggerService.handlePasswordChange(server.db, id);
    }
    if (body.status === "INACTIVE") {
      await revocationTriggerService.handleUserDeactivation(server.db, id);
    }

    return result;
  });
}
