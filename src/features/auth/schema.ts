import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Введіть коректний email")),
  password: z.string().min(1, "Введіть пароль").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
