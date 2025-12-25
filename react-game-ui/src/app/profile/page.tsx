import type { Metadata } from "next";
import { createClient } from "@/lib/auth/supabase";
import { Header } from "@/components/layout/Header";
import { ProfilePageClient } from "@/components/features/profile/ProfilePageClient";
import { ProfileLoginPanel } from "@/components/features/profile/ProfileLoginPanel";

export const metadata: Metadata = {
  title: "My Profile - NBA Fantasy Manager",
  description: "View and manage your NBA fantasy profile.",
};

/**
 * Profile Page - Server Component
 * Displays different UI based on login status:
 * - Not logged in: Show login panel (does not obscure bottom menu)
 * - Logged in: Show "My Profile" page (user info + feature list + sign out)
 */
export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // When not logged in, show login panel (no redirect, stay on /profile)
  if (error || !user) {
    return (
      <div className="flex flex-col h-full">
        <Header title="My Profile" showSettings />
        <div className="flex-1 overflow-y-auto pt-[60px] pb-4">
          {/* Login panel - Ensure bottom menu is visible (layout.tsx already has pb-[90px], no additional handling needed here) */}
          <ProfileLoginPanel />
        </div>
      </div>
    );
  }

  // When logged in, show "My Profile" page
  return <ProfilePageClient user={user} />;
}
