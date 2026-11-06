import { MagnifyingGlassIcon } from "@/components/icons";
import Link from "next/link";
import { buttonClass, Card, EmptyState, Logo } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

// Shown for any address that doesn't exist, including a shop link with a typo.
export default async function NotFound() {
  const t = await getT();
  return (
    <div className="flex min-h-full flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Link href="/" className="mb-8">
        <Logo className="text-xl" />
      </Link>
      <main className="w-full max-w-sm">
        <Card>
          <EmptyState icon={MagnifyingGlassIcon} title={t.notFound.title} as="h1">
            {t.notFound.text}
          </EmptyState>
          <div className="px-6 pb-6">
            <Link href="/" className={`${buttonClass("secondary")} w-full`}>
              {t.notFound.home}
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
