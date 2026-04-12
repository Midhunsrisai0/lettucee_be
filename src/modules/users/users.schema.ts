import { z } from "zod";

export const registerUserSchema = z.object({
  email: z.string().email(),
  countryCode: z.string().min(1).max(8),
  phoneNumber: z.string().min(4).max(20),
  username: z.string().min(2).max(60),
  password: z.string().min(8).max(128),
});

export const loginUserSchema = z
  .object({
    email: z.string().email().optional(),
    phoneNumber: z.string().min(4).max(20).optional(),
    password: z.string().min(8).max(128),
  })
  .refine((v) => Boolean(v.email || v.phoneNumber), {
    message: "Provide either email or phoneNumber",
    path: ["email"],
  });

export const approvePendingUserSchema = z.object({
  userId: z.string().min(1),
  superAccess: z.boolean(),
  superAccessReason: z.string().max(500).optional(),
  comments: z.string().max(2000).optional(),
});

export type RegisterUserSchema = z.infer<typeof registerUserSchema>;
export type LoginUserSchema = z.infer<typeof loginUserSchema>;
export type ApprovePendingUserSchema = z.infer<typeof approvePendingUserSchema>;
