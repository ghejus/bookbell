import { TrashIcon, UsersIcon } from "@/components/icons";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { ConfirmDelete, Field, SubmitButton } from "@/components/form";
import { Badge, Card, CardSection, EmptyState, PageSkeleton } from "@/components/ui";
import { OwnerHeader } from "../account";
import { requireShop } from "@/lib/shop";
import { addStaff, deleteStaff, renameStaff, toggleStaff } from "../actions/team";

export const metadata: Metadata = { title: "Team" };

type Worker = { id: string; name: string; active: boolean };

async function TeamContent() {
  const { supabase, shop } = await requireShop();
  const { data } = await supabase
    .from("staff")
    .select("id, name, active")
    .eq("shop_id", shop.id)
    .order("created_at")
    .returns<Worker[]>();
  const team = data ?? [];
  const activeCount = team.filter((w) => w.active).length;

  return (
    <>
      <OwnerHeader back
        title="Team"
        description="Everyone who takes bookings. Each person has their own calendar, so two people can be booked at the same time."
      />

      <div className="space-y-6">
        {team.length === 0 ? (
          <Card>
            <EmptyState icon={UsersIcon} title="Nobody here yet">
              Add yourself below. Customers can only book when at least one person is taking bookings.
            </EmptyState>
          </Card>
        ) : (
          <ul className="space-y-2.5">
            {team.map((w) => {
              // The last person taking bookings stays on, or nobody could book.
              const isLast = w.active && activeCount <= 1;
              return (
                <li key={w.id}>
                  <Card className="flex flex-wrap items-center gap-x-2 gap-y-2 py-3 pr-2 pl-4 sm:flex-nowrap sm:pl-5">
                    {/* Rename in place: change the name and press Save. */}
                    <form action={renameStaff} className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto">
                      <input type="hidden" name="id" value={w.id} />
                      <label className="sr-only" htmlFor={`name-${w.id}`}>
                        Name
                      </label>
                      <input
                        id={`name-${w.id}`}
                        name="name"
                        defaultValue={w.name}
                        required
                        maxLength={60}
                        autoComplete="off"
                        className={`h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 font-medium hover:border-gray-300 focus:border-gray-300 focus:bg-surface ${
                          w.active ? "text-gray-900" : "text-gray-600"
                        }`}
                      />
                      <SubmitButton variant="ghost" size="sm" label={`Save the new name for ${w.name}`}>
                        Save
                      </SubmitButton>
                    </form>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      {w.active ? null : <Badge>Off</Badge>}
                      {isLast ? null : (
                        <form action={toggleStaff}>
                          <input type="hidden" name="id" value={w.id} />
                          <input type="hidden" name="active" value={String(w.active)} />
                          <SubmitButton
                            variant="ghost"
                            size="sm"
                            label={w.active ? `Stop bookings for ${w.name}` : `Start bookings for ${w.name}`}
                          >
                            {w.active ? "Turn off" : "Turn on"}
                          </SubmitButton>
                        </form>
                      )}
                      {isLast ? null : (
                        <form action={deleteStaff}>
                          <input type="hidden" name="id" value={w.id} />
                          <ConfirmDelete label={`Remove ${w.name}`}>
                            <TrashIcon aria-hidden className="size-4.5" />
                          </ConfirmDelete>
                        </form>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        {team.length > 0 ? (
          <p className="-mt-3 text-sm text-gray-600">
            Turned-off people get no new bookings; the ones they have stay. Someone with bookings can’t be removed, so
            removing them turns them off instead. The last person taking bookings always stays on.
          </p>
        ) : null}

        <CardSection
          title="Add a person"
          description="With two or more people, customers can pick who they want, or take whoever is free."
        >
          <ActionForm action={addStaff} submitLabel="Add person" pendingText="Adding…">
            <Field label="Name" name="name" placeholder="Alex" required maxLength={60} hint="Customers see this name." />
          </ActionForm>
        </CardSection>
      </div>
    </>
  );
}

// Its own loading boundary, so switching tabs shows a placeholder right away.
export default function TeamPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TeamContent />
    </Suspense>
  );
}
