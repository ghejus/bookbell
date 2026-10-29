"use client";

import { useState } from "react";
import { Field, FormMessage, Select, SubmitButton, TextArea } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { CURRENCIES, CURRENCY_LABELS } from "@/lib/format";
import type { Shop } from "@/lib/shop";
import { slugify } from "@/lib/validation";
import { saveShop } from "./actions";

type Props = { shop: Shop | null; timezones: string[] };

export function ShopForm({ shop, timezones }: Props) {
  const { state, pending, formProps } = useActionForm(saveShop);
  const v = (key: keyof Shop, fallback = "") => state?.values?.[key] ?? shop?.[key] ?? fallback;

  // While making a new shop, suggest a web address from the name until the owner edits it.
  const [slug, setSlug] = useState(v("slug"));
  const [slugTouched, setSlugTouched] = useState(Boolean(shop));

  return (
    <form {...formProps} className="space-y-5">
      <Field
        label="Shop name"
        name="name"
        defaultValue={v("name")}
        placeholder="Studio Ana"
        autoComplete="organization"
        required
        minLength={2}
        maxLength={80}
        onChange={(e) => {
          if (!slugTouched) setSlug(slugify(e.target.value));
        }}
      />
      <Field
        label="Web address"
        name="slug"
        value={slug}
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(e.target.value.toLowerCase());
        }}
        required
        minLength={3}
        maxLength={40}
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        autoCapitalize="none"
        spellCheck={false}
        hint={
          <>
            Your booking page: <span className="font-medium text-gray-900">/s/{slug || "your-shop"}</span>. Small letters,
            numbers and dashes.
          </>
        }
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Select label="Prices in" name="currency" defaultValue={v("currency", "EUR")}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {CURRENCY_LABELS[c]}
            </option>
          ))}
        </Select>
        <Select label="Time zone" name="timezone" defaultValue={v("timezone", "Europe/Bucharest")}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      <TextArea
        label="About your shop"
        name="about"
        defaultValue={v("about")}
        maxLength={1000}
        placeholder="A small family shop in the old town. Walk-ins welcome when we have a free spot."
        hint="A few friendly sentences for customers."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Address" name="address" defaultValue={v("address")} maxLength={200} autoComplete="street-address" />
        <Field label="Phone" name="phone" type="tel" defaultValue={v("phone")} maxLength={40} autoComplete="tel" />
      </div>
      <FormMessage state={state} />
      <div className="sm:flex sm:justify-end">
        <SubmitButton full pending={pending}>
          {shop ? "Save changes" : "Create my shop"}
        </SubmitButton>
      </div>
    </form>
  );
}
