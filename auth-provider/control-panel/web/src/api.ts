export interface AdminUser {
  id: string;
  name: string;
  email: string;
}

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
