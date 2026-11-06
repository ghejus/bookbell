"use client";

import { FormMessage, SubmitButton, TextArea } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { REVIEW_MAX } from "@/lib/reviews";
import { replyToReview } from "../actions/reviews";
import { useOwnerT } from "@/lib/i18n/client";

/** The owner's one public reply under a review. Empty it to remove the reply. */
export function ReplyForm({ reviewId, reply }: { reviewId: string; reply: string }) {
  const { state, pending, formProps } = useActionForm(replyToReview);
  const o = useOwnerT();
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="id" value={reviewId} />
      <TextArea
        label={o("Your reply")}
        name="reply"
        defaultValue={state?.values?.reply ?? reply}
        maxLength={REVIEW_MAX}
        rows={4}
        placeholder={o("Thank you for coming! …")}
        hint={o("Everyone can see it under the review. Leave it empty to remove your reply.")}
      />
      <FormMessage state={state} />
      <div className="[&>button]:w-full">
        <SubmitButton pending={pending} pendingText={o("Saving…")}>
          {reply ? o("Save reply") : o("Post reply")}
        </SubmitButton>
      </div>
    </form>
  );
}
