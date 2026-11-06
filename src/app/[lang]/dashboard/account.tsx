import Link from "next/link";
import { AccountButton } from "@/components/account-sheet";
import { CaretLeftIcon, InfoIcon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { accountInfo } from "@/lib/account";
import { requireUser } from "@/lib/shop";
import { getOwnerT } from "@/lib/i18n/server";

/**
 * The title row of an owner screen: a small grey line, the big title, and the
 * round account button (on phones; computers have it in the sidebar).
 */
export async function OwnerHeader({
  title,
  eyebrow,
  description,
  back,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  /** Shop sub-pages get a "‹ Shop" link back. */
  back?: boolean;
}) {
  const [account, o] = await Promise.all([accountInfo(), getOwnerT()]);
  return (
    <>
      {back ? (
        <Link
          href="/dashboard/shop"
          className="-mt-2 mb-2 -ml-2.5 inline-flex h-10 items-center gap-0.5 rounded-lg pr-2.5 pl-1 text-[15px] font-medium text-accent-400 transition-colors duration-150 hover:bg-accent/10"
        >
          <CaretLeftIcon aria-hidden className="size-5" />
          {o("Shop")}
        </Link>
      ) : null}
      <PageHeader
        title={title}
        eyebrow={eyebrow}
        description={description}
        action={back ? undefined : <AccountButton account={account} mode="owner" className="lg:hidden" />}
      />
    </>
  );
}

/** The account row at the bottom of the computer sidebar. */
export async function SidebarAccount() {
  const account = await accountInfo();
  return <AccountButton account={account} mode="owner" variant="row" />;
}

/** A short note for "Try a demo shop" visitors. */
export async function DemoNotice() {
  const [{ isDemo }, o] = await Promise.all([requireUser(), getOwnerT()]);
  if (!isDemo) return null;
  return (
    <p className="mb-6 flex items-start gap-2 rounded-lg bg-surface px-3 py-2.5 text-sm text-neutral-300 shadow-card">
      <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-neutral-500" />
      <span>
        {o("This is your own demo shop. Try anything: nobody else sees your changes.")}{" "}
        <Link href="/signup" className="font-medium whitespace-nowrap text-accent-400 hover:text-accent-300 hover:underline">
          {o("Set up a real shop")}
        </Link>
      </span>
    </p>
  );
}
