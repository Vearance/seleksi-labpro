import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/admin-auth.js";
import * as applicationService from "../../services/application-service.js";

const createApplicationSchema = {
  body: {
    type: "object",
    required: ["name", "logoutNotificationUrl", "redirectUris"],
    properties: {
      name: { type: "string", minLength: 1 },
      launchUrl: { type: ["string", "null"] },
      logoutNotificationUrl: { type: "string", format: "uri" },
      redirectUris: {
        type: "array",
        minItems: 1,
        items: { type: "string", format: "uri" },
      },
      status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
    },
  },
} as const;

const updateApplicationSchema = {
  body: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1 },
      launchUrl: { type: ["string", "null"] },
      logoutNotificationUrl: { type: "string", format: "uri" },
      redirectUris: {
        type: "array",
        minItems: 1,
        items: { type: "string", format: "uri" },
      },
      status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
    },
  },
} as const;

export async function adminApplicationsRoutes(server: FastifyInstance): Promise<void> {
  server.get("/applications", { preHandler: requireAdmin }, async () => {
    return applicationService.listApplications(server.db);
  });

  server.post(
    "/applications",
    { preHandler: requireAdmin, schema: createApplicationSchema },
    async (request, reply) => {
      const body = request.body as applicationService.CreateApplicationInput;
      const result = await applicationService.createApplication(server.db, body);
      reply.status(201);
      return result;
    },
  );

  server.patch(
    "/applications/:id",
    { preHandler: requireAdmin, schema: updateApplicationSchema },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as applicationService.UpdateApplicationInput;
      return applicationService.updateApplication(server.db, id, body);
    },
  );
}
