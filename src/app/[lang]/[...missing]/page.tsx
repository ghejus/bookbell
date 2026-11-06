import { notFound } from "next/navigation";

// Any address that matches no page lands here, so it shows our own
// "not found" page (in the visitor's language) instead of the plain default.
export default function Missing() {
  notFound();
}
