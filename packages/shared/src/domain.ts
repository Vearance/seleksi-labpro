/** Stable identifiers for the relying applications. */
export const APPLICATIONS = {
  APP_A: "app-a",
  APP_B: "app-b",
} as const;
export type ApplicationId = (typeof APPLICATIONS)[keyof typeof APPLICATIONS];

/**
 * Cookie names are distinct per service on purpose: browsers share cookies
 * across ports on localhost, so each service must scope/validate its own.
 */
export const COOKIE_NAMES = {
  authSession: "auth_sid",
  adminSession: "cp_sid",
  appA: "app_a_sid",
  appB: "app_b_sid",
} as const;

/** OAuth2 scopes the provider understands. */
export const OAUTH_SCOPES = ["userid", "profile", "email"] as const;
export type Scope = (typeof OAUTH_SCOPES)[number];

export const USER_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Admin identity returned by `/admin/login` and `/admin/me`. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Public (safe) view of a user. Never contains `passwordHash`.
 * `createdAt` is an ISO-8601 string on the wire.
 */
export interface UserSummary {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  createdAt: string;
}
