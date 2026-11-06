import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { safeNextPath } from "@/lib/validation";
import { login } from "../actions";
import { AuthForm } from "../auth-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).auth.logInTitle };
}

async function Form({ searchParams }: Pick<PageProps<"/[lang]/login">, "searchParams">) {
  const query = await searchParams;
  const next = typeof query.next === "string" ? safeNextPath(query.next, "") || undefined : undefined;
  return <AuthForm mode="login" action={login} as={query.as === "customer" ? "customer" : "owner"} next={next} />;
}

// The form reads the web address (who it is for, and where to go next), so it waits for a real visit.
export default function Page(props: PageProps<"/[lang]/login">) {
  return (
    <Suspense>
      <Form searchParams={props.searchParams} />
    </Suspense>
  );
}
