import { ScissorsIcon, TrashIcon } from "@/components/icons";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { ConfirmDelete, Field, SubmitButton } from "@/components/form";
import { Badge, Card, CardSection, EmptyState, PageSkeleton } from "@/components/ui";
import { OwnerHeader } from "../account";
import { CURRENCY_UNIT, formatDuration, formatPrice } from "@/lib/format";
import { requireShop } from "@/lib/shop";
import { addService, deleteService, toggleService } from "../actions/services";
import { getOwnerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerT())("Services") };
}

type Service = { id: string; name: string; duration_minutes: number; price_cents: number | null; active: boolean };

async function ServicesContent() {
  const [{ supabase, shop }, o] = await Promise.all([requireShop(), getOwnerT()]);
  const { data } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price_cents, active")
    .eq("shop_id", shop.id)
    .order("created_at")
    .returns<Service[]>();
  const services = data ?? [];

  return (
    <>
      <OwnerHeader back title={o("Services")} description={o("What customers can book, how long each one takes, and what it costs.")} />

      <div className="space-y-6">
        {services.length === 0 ? (
          <Card>
            <EmptyState icon={ScissorsIcon} title={o("No services yet")}>
              {o("Add your first one below, for example “Haircut, 30 minutes”. Customers can only book what you list here.")}
            </EmptyState>
          </Card>
        ) : (
          <ul className="space-y-2.5">
            {services.map((s) => (
              <li key={s.id}>
                <Card className="flex items-center gap-3 py-3 pr-2 pl-4 sm:pl-5">
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium break-words ${s.active ? "text-gray-900" : "text-gray-600"}`}>{s.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                      <span className="tabular">{formatDuration(s.duration_minutes)}</span>
                      {/* On phones the price sits here, so a long name keeps the room it needs. */}
                      {s.price_cents !== null ? (
                        <span className="tabular whitespace-nowrap sm:hidden">· {formatPrice(s.price_cents, shop.currency, o.lang)}</span>
                      ) : null}
                      {s.active ? null : <Badge>{o("Hidden")}</Badge>}
                    </p>
                  </div>
                  {s.price_cents !== null ? (
                    <span className={`hidden font-medium tabular whitespace-nowrap sm:inline ${s.active ? "text-gray-900" : "text-gray-600"}`}>
                      {formatPrice(s.price_cents, shop.currency, o.lang)}
                    </span>
                  ) : null}
                  <div className="flex shrink-0 items-center">
                    <form action={toggleService}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="active" value={String(s.active)} />
                      <SubmitButton
                        variant="ghost"
                        size="sm"
                        label={s.active ? o("Hide {name} from customers", { name: s.name }) : o("Show {name} to customers", { name: s.name })}
                      >
                        {s.active ? o("Hide") : o("Show")}
                      </SubmitButton>
                    </form>
                    <form action={deleteService}>
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmDelete label={o("Delete {name}", { name: s.name })}>
                        <TrashIcon aria-hidden className="size-4.5" />
                      </ConfirmDelete>
                    </form>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {services.length > 0 ? (
          <p className="-mt-3 text-sm text-gray-600">
            {o("A service that already has bookings can’t be deleted. Deleting it hides it instead.")}
          </p>
        ) : null}

        <CardSection title={o("Add a service")} description={o("Customers see the name, length and price.")}>
          <ActionForm action={addService} submitLabel={o("Add service")} pendingText={o("Adding…")}>
            <Field label={o("Name")} name="name" placeholder={o("Standard appointment")} required maxLength={80} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={o("Length")}
                name="duration_minutes"
                type="number"
                inputMode="numeric"
                min={5}
                max={480}
                step={5}
                defaultValue={30}
                suffix="min"
                required
              />
              <Field
                label={o("Price")}
                name="price_cents"
                inputMode="decimal"
                placeholder="25"
                suffix={CURRENCY_UNIT[shop.currency]}
                hint={o("Leave empty to hide the price.")}
              />
            </div>
          </ActionForm>
        </CardSection>
      </div>
    </>
  );
}

// Its own loading boundary, so switching tabs shows a placeholder right away.
export default function ServicesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ServicesContent />
    </Suspense>
  );
}
