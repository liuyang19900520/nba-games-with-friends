"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, CheckCircle2, X } from "lucide-react";
import { linkPhone, verifyPhoneChange, linkEmail } from "@/app/login/actions";
import type { User } from "@supabase/supabase-js";

interface AccountConnectionsProps {
  user: User;
}

type PhoneLinkStep = "idle" | "phone_input" | "otp_verify";
type EmailLinkStep = "idle" | "email_input" | "confirmation_sent";

/**
 * Account Connections Component
 * Displays user's connected accounts (Email, Phone, Google)
 * Shows connection status and provides linking options
 */
export function AccountConnections({ user }: AccountConnectionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Phone linking state
  const [phoneStep, setPhoneStep] = useState<PhoneLinkStep>("idle");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Email linking state
  const [emailStep, setEmailStep] = useState<EmailLinkStep>("idle");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // Check if Google is connected
  const hasGoogle = user.identities?.some(
    (identity) => identity.provider === "google"
  ) ?? false;

  // Check if email exists
  const hasEmail = !!user.email;

  // Check if phone exists
  const hasPhone = !!user.phone;

  // Phone linking handlers
  const handleStartLinkPhone = () => {
    setPhoneStep("phone_input");
    setPhoneError(null);
    setPhone("");
  };

  const handleCancelLinkPhone = () => {
    setPhoneStep("idle");
    setPhone("");
    setOtp("");
    setPhoneError(null);
  };

  const handleSendPhoneOTP = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPhoneError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("phone", phone);

      const result = await linkPhone(formData);

      if (result.success && result.phone) {
        setPhoneStep("otp_verify");
        setPhoneError(null);
      } else {
        setPhoneError(result.error || "Failed to send verification code");
      }
    });
  };

  const handleVerifyPhoneOTP = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPhoneError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("phone", phone);
      formData.append("token", otp);

      const result = await verifyPhoneChange(formData);

      if (result.success) {
        // Phone linked successfully, refresh page to show updated user data
        router.refresh();
        setPhoneStep("idle");
        setPhone("");
        setOtp("");
      } else {
        setPhoneError(result.error || "Invalid verification code");
      }
    });
  };

  // Email linking handlers
  const handleStartLinkEmail = () => {
    setEmailStep("email_input");
    setEmailError(null);
    setEmailSuccess(null);
    setEmail("");
  };

  const handleCancelLinkEmail = () => {
    setEmailStep("idle");
    setEmail("");
    setEmailError(null);
    setEmailSuccess(null);
  };

  const handleLinkEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", email);

      const result = await linkEmail(formData);

      if (result.success) {
        setEmailStep("confirmation_sent");
        setEmailSuccess(
          "Confirmation link sent to your email. Please click the link to finish binding."
        );
      } else {
        setEmailError(result.error || "Failed to send confirmation email");
      }
    });
  };

  return (
    <div className="bg-brand-card border border-brand-card-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-brand-card-border">
        <h3 className="text-sm font-semibold text-white">Account Connections</h3>
      </div>

      {/* Email Row */}
      <div className="px-4 py-3 border-b border-brand-card-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Mail className="w-5 h-5 text-brand-text-dim flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {hasEmail ? user.email : "Email"}
              </p>
              {!hasEmail && (
                <p className="text-xs text-brand-text-dim mt-0.5">
                  Not connected
                </p>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 ml-3">
            {hasEmail ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-medium text-green-400">
                  Connected
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium text-brand-blue bg-brand-blue/10 border border-brand-blue/30 rounded-md hover:bg-brand-blue/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleStartLinkEmail}
                disabled={isPending || emailStep !== "idle"}
              >
                Link Email
              </button>
            )}
          </div>
        </div>

        {/* Email Linking Form */}
        {emailStep !== "idle" && !hasEmail && (
          <div className="mt-3 pt-3 border-t border-brand-card-border">
            {emailError && (
              <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-md">
                <p className="text-xs text-red-400 whitespace-pre-line">
                  {emailError}
                </p>
              </div>
            )}
            {emailSuccess && (
              <div className="mb-3 p-2 bg-green-500/10 border border-green-500/30 rounded-md">
                <p className="text-xs text-green-400">{emailSuccess}</p>
              </div>
            )}

            {emailStep === "email_input" && (
              <form onSubmit={handleLinkEmail} className="space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-brand-dark border border-brand-card-border rounded-md text-sm text-white placeholder-brand-text-dim focus:outline-none focus:ring-2 focus:ring-brand-blue/50 disabled:opacity-50"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isPending || !email}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-brand-blue rounded-md hover:bg-brand-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? "Sending..." : "Send Confirmation"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelLinkEmail}
                    disabled={isPending}
                    className="px-3 py-1.5 text-xs font-medium text-brand-text-dim bg-brand-dark border border-brand-card-border rounded-md hover:bg-brand-dark/80 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {emailStep === "confirmation_sent" && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-brand-text-dim">
                  Check your email for the confirmation link
                </p>
                <button
                  type="button"
                  onClick={handleCancelLinkEmail}
                  className="p-1 text-brand-text-dim hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phone Row */}
      <div className="px-4 py-3 border-b border-brand-card-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Phone className="w-5 h-5 text-brand-text-dim flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {hasPhone ? user.phone : "Phone"}
              </p>
              {!hasPhone && (
                <p className="text-xs text-brand-text-dim mt-0.5">
                  Not connected
                </p>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 ml-3">
            {hasPhone ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-medium text-green-400">
                  Connected
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium text-brand-blue bg-brand-blue/10 border border-brand-blue/30 rounded-md hover:bg-brand-blue/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleStartLinkPhone}
                disabled={isPending || phoneStep !== "idle"}
              >
                Link Phone
              </button>
            )}
          </div>
        </div>

        {/* Phone Linking Form */}
        {phoneStep !== "idle" && !hasPhone && (
          <div className="mt-3 pt-3 border-t border-brand-card-border">
            {phoneError && (
              <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-md">
                <p className="text-xs text-red-400 whitespace-pre-line">
                  {phoneError}
                </p>
              </div>
            )}

            {phoneStep === "phone_input" && (
              <form onSubmit={handleSendPhoneOTP} className="space-y-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number (e.g., +1234567890)"
                  required
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-brand-dark border border-brand-card-border rounded-md text-sm text-white placeholder-brand-text-dim focus:outline-none focus:ring-2 focus:ring-brand-blue/50 disabled:opacity-50"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isPending || !phone}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-brand-blue rounded-md hover:bg-brand-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? "Sending..." : "Send Code"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelLinkPhone}
                    disabled={isPending}
                    className="px-3 py-1.5 text-xs font-medium text-brand-text-dim bg-brand-dark border border-brand-card-border rounded-md hover:bg-brand-dark/80 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {phoneStep === "otp_verify" && (
              <form onSubmit={handleVerifyPhoneOTP} className="space-y-2">
                <p className="text-xs text-brand-text-dim mb-2">
                  Code sent to {phone}
                </p>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  required
                  maxLength={6}
                  disabled={isPending}
                  className="w-full px-3 py-2 bg-brand-dark border border-brand-card-border rounded-md text-sm text-white placeholder-brand-text-dim focus:outline-none focus:ring-2 focus:ring-brand-blue/50 disabled:opacity-50 text-center tracking-widest"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isPending || otp.length !== 6}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-brand-blue rounded-md hover:bg-brand-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? "Verifying..." : "Verify & Link"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelLinkPhone}
                    disabled={isPending}
                    className="px-3 py-1.5 text-xs font-medium text-brand-text-dim bg-brand-dark border border-brand-card-border rounded-md hover:bg-brand-dark/80 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Google Row */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <svg
              className="w-5 h-5 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Google</p>
              {hasGoogle && user.user_metadata?.email && (
                <p className="text-xs text-brand-text-dim mt-0.5 truncate">
                  {user.user_metadata.email}
                </p>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 ml-3">
            {hasGoogle ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-md">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-medium text-green-400">
                  Connected
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-brand-dark/50 border border-brand-card-border rounded-md">
                <span className="text-xs font-medium text-brand-text-dim">
                  Not connected
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
