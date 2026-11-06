"use client";

import { FormMessage, SubmitButton, TextArea } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { REVIEW_MAX } from "@/lib/reviews";
import { replyToReview } from "../actions/reviews";

/** The owner's one public reply under a review. Empty it to remove the reply. */
export function ReplyForm({ reviewId, reply }: { reviewId: string; reply: string }) {
  const { state, pending, formProps } = useActionForm(replyToReview);
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="id" value={reviewId} />
      <TextArea
        label="Your reply"
        name="reply"
        defaultValue={state?.values?.reply ?? reply}
        maxLength={REVIEW_MAX}
        rows={4}
        placeholder="Thank you for coming! …"
        hint="Everyone can see it under the review. Leave it empty to remove your reply."
      />
      <FormMessage state={state} />
      <div className="[&>button]:w-full">
        <SubmitButton pending={pending} pendingText="Saving…">
          {reply ? "Save reply" : "Post reply"}
        </SubmitButton>
      </div>
    </form>
  );
}
