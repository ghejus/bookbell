import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { safeNextPath } from "@/lib/validation";
import { signup } from "../actions";
import { AuthForm } from "../auth-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).auth.signUpTitle };
}

async function Form({ searchParams }: Pick<PageProps<"/[lang]/signup">, "searchParams">) {
  const query = await searchParams;
  const next = typeof query.next === "string" ? safeNextPath(query.next, "") || undefined : undefined;
  return <AuthForm mode="signup" action={signup} as={query.as === "customer" ? "customer" : "owner"} next={next} />;
}

// The form reads the web address (who it is for, and where to go next), so it waits for a real visit.
export default function Page(props: PageProps<"/[lang]/signup">) {
  return (
    <Suspense>
      <Form searchParams={props.searchParams} />
    </Suspense>
  );
}
