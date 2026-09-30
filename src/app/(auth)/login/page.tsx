import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/lib/permissions";

export const metadata = { title: "Вхід" };

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

/**
 * Auth.js passes an absolute URL in `callbackUrl`; only its path is kept so the
 * post-login redirect can never leave this origin.
 */
function toLocalPath(callbackUrl: string | undefined): string {
  if (!callbackUrl || callbackUrl.startsWith("//")) return "/dashboard";
  if (callbackUrl.startsWith("/")) return callbackUrl;

  try {
    const url = new URL(callbackUrl);
    return `${url.pathname}${url.search}`;
  } catch {
    return "/dashboard";
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { callbackUrl } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <LoginForm callbackUrl={toLocalPath(callbackUrl)} />
    </main>
  );
}
