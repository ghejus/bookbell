import { LinkIcon } from "lucide-react";
import Link from "next/link";
import { buttonClass, Card, EmptyState, Logo } from "@/components/ui";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Link href="/" className="mb-8">
        <Logo className="text-xl" />
      </Link>
      <main className="w-full max-w-sm">
        <Card>
          <EmptyState icon={LinkIcon} title="That link didn’t work" as="h1">
            It may be old or already used. Try logging in. If that fails, sign up again to get a new link.
          </EmptyState>
          <div className="px-6 pb-6">
            <Link href="/login" className={`${buttonClass("primary")} w-full`}>
              Go to log in
            </Link>
          </div>
        </Card>
        <p className="mt-6 text-center text-sm text-gray-600">
          No luck?{" "}
          <Link href="/signup" className="font-semibold text-brand-700 hover:text-brand-800 hover:underline">
            Sign up again
          </Link>
        </p>
      </main>
    </div>
  );
}
