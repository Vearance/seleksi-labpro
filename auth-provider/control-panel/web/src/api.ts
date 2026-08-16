import type { AdminUser, ApplicationSummary, GroupSummary, PolicySummary, UserStatus, UserSummary } from "@sso/shared";

export type { AdminUser, ApplicationSummary, GroupSummary, PolicySummary, UserStatus, UserSummary };
export type User = UserSummary;
export type Group = GroupSummary;
export type Application = ApplicationSummary;
export type Policy = PolicySummary;

export async function login(email: string, password: string): Promise<Response> {
  return fetch("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function me(): Promise<Response> {
  return fetch("/admin/me");
}

export async function getAdmin(): Promise<AdminUser | null> {
  const res = await me();
  if (!res.ok) return null;
  return (await res.json()) as AdminUser;
}

async function parseError(res: Response): Promise<Error> {
  let message = res.statusText;
  try {
    const body = await res.json();
    if (body?.error?.message) message = body.error.message;
  } catch {
    // ignore
  }
  return new Error(message);
}

export async function listUsers(): Promise<User[]> {
  const res = await fetch("/admin/users");
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
  status?: UserStatus;
}): Promise<User> {
  const res = await fetch("/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function updateUser(
  id: string,
  input: { name?: string; email?: string; status?: UserStatus; password?: string },
): Promise<User> {
  const res = await fetch(`/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function listGroups(): Promise<Group[]> {
  const res = await fetch("/admin/groups");
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function createGroup(input: { name: string; description?: string }): Promise<Group> {
  const res = await fetch("/admin/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function updateGroup(
  id: string,
  input: { name?: string; description?: string },
): Promise<Group> {
  const res = await fetch(`/admin/groups/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function listUserGroups(userId: string): Promise<Group[]> {
  const res = await fetch(`/admin/users/${userId}/groups`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function addUserToGroup(userId: string, groupId: string): Promise<void> {
  const res = await fetch(`/admin/users/${userId}/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId }),
  });
  if (!res.ok) throw await parseError(res);
}

export async function removeUserFromGroup(userId: string, groupId: string): Promise<void> {
  const res = await fetch(`/admin/users/${userId}/groups/${groupId}`, { method: "DELETE" });
  if (!res.ok) throw await parseError(res);
}

export interface CreatedApplication {
  application: Application;
  clientSecret: string;
}

export async function listApplications(): Promise<Application[]> {
  const res = await fetch("/admin/applications");
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function createApplication(input: {
  name: string;
  launchUrl?: string | null;
  logoutNotificationUrl: string;
  redirectUris: string[];
  status?: "ACTIVE" | "INACTIVE";
}): Promise<CreatedApplication> {
  const res = await fetch("/admin/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function updateApplication(
  id: string,
  input: {
    name?: string;
    launchUrl?: string | null;
    logoutNotificationUrl?: string;
    redirectUris?: string[];
    status?: "ACTIVE" | "INACTIVE";
  },
): Promise<Application> {
  const res = await fetch(`/admin/applications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function listPolicies(applicationId: string): Promise<Policy[]> {
  const res = await fetch(`/admin/applications/${applicationId}/policies`);
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function addPolicy(applicationId: string, groupId: string): Promise<Policy> {
  const res = await fetch(`/admin/applications/${applicationId}/policies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId }),
  });
  if (!res.ok) throw await parseError(res);
  return res.json();
}

export async function removePolicy(applicationId: string, groupId: string): Promise<void> {
  const res = await fetch(`/admin/applications/${applicationId}/policies/${groupId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw await parseError(res);
}
