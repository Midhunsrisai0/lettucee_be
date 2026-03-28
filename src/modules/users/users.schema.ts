import { z } from "zod";

export const registerUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
});

export type RegisterUserSchema = z.infer<typeof registerUserSchema>;
