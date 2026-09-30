import { redirect } from "next/navigation";

/** The whole app lives behind the proxy, so `/` is only an entry point. */
export default function Home() {
  redirect("/dashboard");
}
