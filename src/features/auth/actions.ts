"use server";

import { AuthError } from "next-auth";

import { loginSchema, type LoginInput } from "@/features/auth/schema";
import { signIn, signOut } from "@/lib/auth";

export type LoginFieldErrors = Partial<Record<keyof LoginInput, string>>;

export type LoginState = {
  error?: string;
  fieldErrors?: LoginFieldErrors;
};

/** Only same-site paths are accepted so `callbackUrl` cannot be used as an open redirect. */
function safeRedirectTarget(value: FormDataEntryValue | null): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: LoginFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field !== "email" && field !== "password") continue;
      fieldErrors[field] ??= issue.message;
    }

    return { fieldErrors };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeRedirectTarget(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Невірний email або пароль" };
    }

    // A successful sign-in finishes with a thrown redirect — let it bubble up.
    throw error;
  }

  return {};
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
