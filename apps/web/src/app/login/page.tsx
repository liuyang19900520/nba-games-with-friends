import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Login | NBA Game",
  description: "Sign in to your NBA Game account",
};

import { Header } from "@/components/layout/Header";

/**
 * Login Page - Server Component
 * Renders client-side authentication form component
 */
export default function LoginPage() {
  return (
    <div className="flex flex-col h-full bg-brand-dark min-h-screen">
      <Header title="Login" showBack />
      <div className="flex-1 flex items-center justify-center px-4 pt-[60px]">
        <Suspense fallback={<div className="text-white">Loading...</div>}>
          <AuthForm />
        </Suspense>
      </div>
    </div>
  );
}
