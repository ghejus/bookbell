import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonClass, Card, EmptyState, Logo } from "@/components/ui";

// Shown for any address that doesn't exist, including a shop link with a typo.
export default function NotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Link href="/" className="mb-8">
        <Logo className="text-xl" />
      </Link>
      <main className="w-full max-w-sm">
        <Card>
          <EmptyState icon={SearchX} title="We couldn’t find that page" as="h1">
            If you followed a shop’s booking link, check it for typos or ask the shop for the right one.
          </EmptyState>
          <div className="px-6 pb-6">
            <Link href="/" className={`${buttonClass("secondary")} w-full`}>
              Go to the home page
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
