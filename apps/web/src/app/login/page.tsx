import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Login | NBA Game",
  description: "Sign in to your NBA Game account",
};

/**
 * Login Page - Server Component
 * Renders client-side authentication form component
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
