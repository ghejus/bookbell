import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CaretLeftIcon } from "@/components/icons";
import { PageSkeleton } from "@/components/ui";
import { mediaUrl } from "@/lib/media";
import { qrSvg } from "@/lib/qr";
import { requireShop } from "@/lib/shop";
import { siteUrl } from "@/lib/site";
import { PrintButton } from "./print-button";
import { getOwnerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerT())("QR poster") };
}

// A sheet to print and stick on the shop door: the shop's name, a big QR code
// and the address. Black on white, so it prints well; the app's menus hide
// when printing.
async function PosterContent() {
  const [{ supabase, shop }, o] = await Promise.all([requireShop(), getOwnerT()]);
  const [site, { data }] = await Promise.all([
    siteUrl(),
    supabase.from("shops").select("logo_path").eq("id", shop.id).single<{ logo_path: string | null }>(),
  ]);
  const url = `${site}/s/${shop.slug}`;
  const shortUrl = url.replace(/^https?:\/\//, "");

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/shop"
          className="-ml-2.5 inline-flex h-10 items-center gap-0.5 rounded-lg pr-2.5 pl-1 text-[15px] font-medium text-accent-400 transition-colors duration-150 hover:bg-accent/10"
        >
          <CaretLeftIcon aria-hidden className="size-5" />
          {o("Shop")}
        </Link>
        <PrintButton />
      </div>

      <article className="mx-auto flex aspect-[1/1.414] w-full max-w-[560px] flex-col items-center justify-between rounded-xl bg-white px-[8%] py-[9%] text-center text-black shadow-lg print:max-w-none print:rounded-none print:shadow-none">
        <header className="flex flex-col items-center gap-3">
          {data?.logo_path ? (
            <Image src={mediaUrl(data.logo_path)} alt="" width={96} height={96} unoptimized className="size-[clamp(56px,14vw,96px)] rounded-2xl" />
          ) : null}
          <h1 className="text-[clamp(22px,6vw,40px)] leading-tight font-semibold tracking-tight text-balance text-black wrap-anywhere">{shop.name}</h1>
          <p className="text-[clamp(15px,3.6vw,22px)] text-neutral-700">{o("Book your visit online")}</p>
        </header>

        <div
          role="img"
          aria-label={o("QR code for {url}", { url: shortUrl })}
          className="w-[62%] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qrSvg(url) }}
        />

        <footer className="space-y-1">
          <p className="text-[clamp(14px,3.4vw,20px)] font-medium text-black">{o("Point your phone camera here")}</p>
          <p className="text-[clamp(12px,2.8vw,16px)] break-all text-neutral-700">{shortUrl}</p>
        </footer>
      </article>
    </>
  );
}

export default function PosterPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PosterContent />
    </Suspense>
  );
}
