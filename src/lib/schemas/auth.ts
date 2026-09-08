import * as z from "zod";

export const roleSchema = z.enum(["owner", "admin", "member", "viewer"]);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  role: roleSchema,
  org_id: z.string(),
  disabled: z.boolean(),
  created_at: z.string(),
  last_login_at: z.string().nullable().optional(),
});
export type SessionUser = z.infer<typeof userSchema>;

export const authMeSchema = z.object({
  user: userSchema,
  scopes: z.array(z.string()),
});
export type AuthMe = z.infer<typeof authMeSchema>;

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().default(false),
});
// Input type: `remember` is optional going in (default fills it).
export type LoginInput = z.input<typeof loginSchema>;

export const signupSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    // Optional: empty stays absent (the API rejects "" via min_length).
    name: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
export type SignupInput = z.infer<typeof signupSchema>;

export const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  name: z.string().optional(),
  role: roleSchema.default("member"),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const inviteEntrySchema = z.object({
  invite_id: z.string(),
  email: z.string(),
  name: z.string().nullable().optional(),
  role: roleSchema,
  expires_at: z.string(),
  accepted: z.boolean(),
  created_at: z.string(),
});
export const inviteListSchema = z.object({ invites: z.array(inviteEntrySchema) });
export type InviteEntry = z.infer<typeof inviteEntrySchema>;

export const acceptInviteSchema = z
  .object({
    token: z.string().min(1),
    name: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(8, "New password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((data) => data.new_password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const userListSchema = z.object({ users: z.array(userSchema) });

export const wsTicketSchema = z.object({ ticket: z.string(), expires_in: z.number() });

export const authEventSchema = z.object({
  event_id: z.string(),
  type: z.string(),
  user_id: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  detail: z.string().nullable().optional(),
  created_at: z.string(),
});
export const authEventListSchema = z.object({ events: z.array(authEventSchema) });
export type AuthEvent = z.infer<typeof authEventSchema>;
