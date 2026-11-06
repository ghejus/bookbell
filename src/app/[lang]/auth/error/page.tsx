import { LinkIcon } from "@/components/icons";
import Link from "next/link";
import { buttonClass, Card, EmptyState, Logo } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function AuthErrorPage() {
  const t = await getT();
  return (
    <div className="flex min-h-full flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Link href="/" className="mb-8">
        <Logo className="text-xl" />
      </Link>
      <main className="w-full max-w-sm">
        <Card>
          <EmptyState icon={LinkIcon} title={t.auth.linkBrokenTitle} as="h1">
            {t.auth.linkBrokenText}
          </EmptyState>
          <div className="px-6 pb-6">
            <Link href="/login" className={`${buttonClass("primary")} w-full`}>
              {t.auth.goToLogIn}
            </Link>
          </div>
        </Card>
        <p className="mt-6 text-center text-sm text-gray-600">
          No luck?{" "}
          <Link href="/signup" className="font-medium text-brand-700 hover:text-brand-800 hover:underline">
            {t.auth.signUpAgain}
          </Link>
        </p>
      </main>
    </div>
  );
}
