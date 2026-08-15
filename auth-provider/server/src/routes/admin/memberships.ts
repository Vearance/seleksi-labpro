import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-auth.js";
import * as groupService from "../../services/group-service.js";

const addMembershipSchema = {
  body: {
    type: "object",
    required: ["groupId"],
    properties: {
      groupId: { type: "string", format: "uuid" },
    },
  },
} as const;

export async function adminMembershipRoutes(server: FastifyInstance): Promise<void> {
  server.get("/users/:id/groups", { preHandler: requireAdmin }, async (request) => {
    const { id } = request.params as { id: string };
    return groupService.listUserGroups(server.db, id);
  });

  server.post(
    "/users/:id/groups",
    { preHandler: requireAdmin, schema: addMembershipSchema },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { groupId } = request.body as { groupId: string };
      await groupService.addUserToGroup(server.db, id, groupId);
      reply.status(204);
    },
  );

  server.delete("/users/:id/groups/:groupId", { preHandler: requireAdmin }, async (request, reply) => {
    const { id, groupId } = request.params as { id: string; groupId: string };
    await groupService.removeUserFromGroup(server.db, id, groupId);
    reply.status(204);
  });
}
