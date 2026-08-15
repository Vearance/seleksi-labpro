import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-auth.js";
import * as groupService from "../../services/group-service.js";

const createGroupSchema = {
  body: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1 },
      description: { type: "string" },
    },
  },
} as const;

export async function adminGroupsRoutes(server: FastifyInstance): Promise<void> {
  server.get("/groups", { preHandler: requireAdmin }, async () => {
    return groupService.listGroups(server.db);
  });

  server.post("/groups", { preHandler: requireAdmin, schema: createGroupSchema }, async (request) => {
    const body = request.body as groupService.CreateGroupInput;
    return groupService.createGroup(server.db, body);
  });

  server.patch("/groups/:id", { preHandler: requireAdmin }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as groupService.UpdateGroupInput;
    return groupService.updateGroup(server.db, id, body);
  });
}
