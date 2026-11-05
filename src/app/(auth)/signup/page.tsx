import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/validation";
import { signup } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign up" };

async function Form({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const query = await searchParams;
  const next = typeof query.next === "string" ? safeNextPath(query.next, "") || undefined : undefined;
  return <AuthForm mode="signup" action={signup} as={query.as === "customer" ? "customer" : "owner"} next={next} />;
}

// The form reads the web address (who it is for, and where to go next), so it waits for a real visit.
export default function Page(props: PageProps<"/signup">) {
  return (
    <Suspense>
      <Form searchParams={props.searchParams} />
    </Suspense>
  );
}
