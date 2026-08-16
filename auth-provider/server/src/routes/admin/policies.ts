import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-auth.js";
import * as policyService from "../../services/policy-service.js";

const addPolicySchema = {
  body: {
    type: "object",
    required: ["groupId"],
    properties: {
      groupId: { type: "string", format: "uuid" },
    },
  },
} as const;

export async function adminPoliciesRoutes(server: FastifyInstance): Promise<void> {
  server.get("/applications/:id/policies", { preHandler: requireAdmin }, async (request) => {
    const { id } = request.params as { id: string };
    return policyService.listPolicies(server.db, id);
  });

  server.post(
    "/applications/:id/policies",
    { preHandler: requireAdmin, schema: addPolicySchema },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { groupId } = request.body as { groupId: string };
      const result = await policyService.addPolicy(server.db, { applicationId: id, groupId });
      reply.status(201);
      return result;
    },
  );

  server.delete(
    "/applications/:id/policies/:groupId",
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id, groupId } = request.params as { id: string; groupId: string };
      await policyService.removePolicy(server.db, id, groupId);
      reply.status(204);
    },
  );
}
