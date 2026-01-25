"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOutWithoutRedirect } from "@/app/login/actions";
import { Header } from "@/components/layout/Header";
import { MessageSquare, Info, LogOut, ChevronRight } from "lucide-react";
import { AccountConnections } from "./AccountConnections";

import type { User } from "@supabase/supabase-js";

interface ProfilePageClientProps {
  user: User;
}

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
}

/**
 * Profile Page Client Component
 * Displays the "My Profile" page: user info card + feature list + sign out button
 */
export function ProfilePageClient({ user }: ProfilePageClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);


  const handleSignOut = () => {
    setError(null);
    startTransition(async () => {
      const result = await signOutWithoutRedirect();
      if (result.success) {
        // Sign out successful, refresh page to show login panel
        router.refresh();
      } else {
        setError(result.error || "Failed to sign out");
      }
    });
  };

  const menuItems: MenuItem[] = [

    {
      icon: MessageSquare,
      label: "Feedback",
      onClick: () => {
        // TODO: Open feedback form
      },
    },
    {
      icon: Info,
      label: "About",
      onClick: () => {
        // TODO: Show about information
      },
    },
  ];

  // Get user display name
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";

  // Get user avatar URL
  const avatarUrl =
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    null;

  return (
    <div className="flex flex-col h-full">
      <Header title="My Profile" />
      <div className="flex-1 overflow-y-auto pt-[60px] px-4 pb-4">
        <div className="max-w-md mx-auto space-y-4">
          {/* User Info Card */}
          <div className="bg-brand-card border border-brand-card-border rounded-xl p-6">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-brand-card-border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-blue to-brand-orange flex items-center justify-center border-2 border-brand-card-border">
                    <span className="text-2xl font-bold text-white">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              {/* User Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-white mb-1 truncate">
                  {displayName}
                </h2>
                {user.email && (
                  <p className="text-sm text-brand-text-dim truncate">
                    {user.email}
                  </p>
                )}
                {user.phone && (
                  <p className="text-xs text-brand-text-dim mt-1">
                    {user.phone}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Account Connections */}
          <AccountConnections user={user} />

          {/* Menu List */}
          <div className="bg-brand-card border border-brand-card-border rounded-xl overflow-hidden">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-brand-dark/50 transition-colors ${index !== menuItems.length - 1
                    ? "border-b border-brand-card-border"
                    : ""
                    }`}
                >
                  <Icon className="w-5 h-5 text-brand-text-dim flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium text-white">
                    {item.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-brand-text-dim flex-shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Logout Button */}
          <div className="space-y-2">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            <button
              onClick={handleSignOut}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 border border-red-500/30 text-red-400 font-medium rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut className="w-4 h-4" />
              {isPending ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  Signing out...
                </span>
              ) : (
                "Sign Out"
              )}
            </button>
          </div>
        </div>
      </div>


    </div>
  );
}

