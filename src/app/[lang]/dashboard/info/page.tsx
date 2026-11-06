import { ChatCircleTextIcon, TrashIcon } from "@/components/icons";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { ConfirmDelete, Field, TextArea } from "@/components/form";
import { Card, CardSection, EmptyState, PageSkeleton } from "@/components/ui";
import { OwnerHeader } from "../account";
import { requireShop } from "@/lib/shop";
import { addShopInfo, deleteShopInfo } from "../actions/info";
import { getOwnerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerT())("AI notes") };
}

type Note = { id: string; question: string; answer: string };

async function InfoContent() {
  const o = await getOwnerT();
  const { supabase, shop } = await requireShop();
  const { data } = await supabase
    .from("shop_info")
    .select("id, question, answer")
    .eq("shop_id", shop.id)
    .order("created_at")
    .returns<Note[]>();
  const notes = data ?? [];

  return (
    <>
      <OwnerHeader back
        title={o("Notes for the AI helper")}
        description={o("The helper on your booking page answers customers using only these notes and your shop details. If something isn’t here, it says it doesn’t know. Customers can read these, so don’t write anything private.")}
      />

      <div className="space-y-6">
        {notes.length === 0 ? (
          <Card>
            <EmptyState icon={ChatCircleTextIcon} title={o("No notes yet")}>
              {o("Think of what customers often ask you: parking, how to pay, kids, being late, cancelling.")}
            </EmptyState>
          </Card>
        ) : (
          <ul className="space-y-2.5">
            {notes.map((n) => (
              <li key={n.id}>
                <Card className="flex items-start gap-3 py-4 pr-2 pl-4 sm:pl-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words text-gray-900">{n.question}</p>
                    <p className="mt-1 text-sm break-words whitespace-pre-line text-gray-700">{n.answer}</p>
                  </div>
                  <form action={deleteShopInfo}>
                    <input type="hidden" name="id" value={n.id} />
                    <ConfirmDelete label={o("Delete note: {question}", { question: n.question })}>
                      <TrashIcon aria-hidden className="size-4.5" />
                    </ConfirmDelete>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <CardSection title={o("Add a note")}>
          <ActionForm action={addShopInfo} submitLabel={o("Save note")} pendingText={o("Saving…")}>
            <Field label={o("Question")} name="question" placeholder={o("Is there parking?")} required maxLength={200} />
            <TextArea
              label={o("Answer")}
              name="answer"
              placeholder={o("Yes, free parking behind the shop for 30 minutes.")}
              required
              maxLength={1000}
            />
          </ActionForm>
        </CardSection>
      </div>
    </>
  );
}

// Its own loading boundary, so switching tabs shows a placeholder right away.
export default function InfoPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InfoContent />
    </Suspense>
  );
}
