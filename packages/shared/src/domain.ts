export const APPLICATIONS = {
  APP_A: "app-a",
  APP_B: "app-b",
} as const;
export type ApplicationId = (typeof APPLICATIONS)[keyof typeof APPLICATIONS];

export const COOKIE_NAMES = {
  authSession: "auth_sid",
  appA: "app_a_sid",
  appB: "app_b_sid",
} as const;

export const OAUTH_SCOPES = ["userid", "profile", "email"] as const;
export type Scope = (typeof OAUTH_SCOPES)[number];

// export const EVENT_TYPE_LABELS: Record<EventType, string> = {
//   SessionRevoked: "Session revoked",
//   PasswordChanged: "Password changed",
//   AccessPolicyChanged: "Access policy changed",
// };

/** Runtime identifiers for the databases (used in logs/metrics). */
// export const DATABASES = {
//   PRIMARY: "primary",
//   LOCAL: "local",
// } as const;