import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/shop";
import { logout } from "../(auth)/actions";

/** Round avatar with the owner's first letter; opens a small menu with their email and Log out. */
export async function AccountMenu() {
  const { email } = await requireUser();
  const initial = (email[0] ?? "?").toUpperCase();
  return (
    <details className="group relative">
      <summary
        aria-label="Account"
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800 transition-colors duration-150 hover:bg-brand-200 [&::-webkit-details-marker]:hidden"
      >
        {initial}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg">
        <p className="truncate px-3 py-2 text-sm text-gray-600" title={email}>
          {email}
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100"
          >
            <LogOut aria-hidden className="size-4 text-gray-500" />
            Log out
          </button>
        </form>
      </div>
    </details>
  );
}

/** Email and Log out at the bottom of the desktop sidebar. */
export async function SidebarAccount() {
  const { email } = await requireUser();
  return (
    <div className="border-t border-gray-200 pt-4">
      <p className="truncate px-3 text-sm text-gray-600" title={email}>
        {email}
      </p>
      <form action={logout} className="mt-1">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
        >
          <LogOut aria-hidden className="size-4.5 text-gray-500" />
          Log out
        </button>
      </form>
    </div>
  );
}
