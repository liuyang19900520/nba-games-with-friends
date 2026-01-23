"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithGoogle,
  sendSMS,
  verifySMS,
  emailLogin,
  emailSignup,
} from "@/app/login/actions";
import { useSearchParams } from "next/navigation";
import { Phone } from "lucide-react";

type EmailView = "login" | "register";
type PhoneStep = "idle" | "PHONE_INPUT" | "OTP_VERIFY";

/**
 * Unified Authentication Form Component
 *
 * New Structure:
 * 1. Top Level: Google OAuth + Phone Login (parallel, same priority)
 * 2. Bottom Level: Email Login/Register (with Sign In/Sign Up toggle)
 */
export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get("redirect") || "/lineup";

  // Email view state: login vs register
  const [emailView, setEmailView] = useState<EmailView>("login");
  // Phone verification step
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("idle");
  // Show email form (expanded section)
  const [showEmailForm, setShowEmailForm] = useState(false);

  // Email form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Phone form state
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Google OAuth login
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { url } = await signInWithGoogle(redirectTo);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setIsGoogleLoading(false);
    }
  };

  // Email login/registration
  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);

      if (emailView === "login") {
        // Login
        const result = await emailLogin(formData, redirectTo);
        if (!result.success) {
          setError(result.error || "Login failed");
        }
        // Success will redirect, no additional handling needed here
      } else {
        // Registration
        const result = await emailSignup(formData, redirectTo);
        if (result.success) {
          if (result.needsEmailConfirmation) {
            setSuccessMessage(
              "Registration successful! Please check your email to confirm your account."
            );
            setEmail("");
            setPassword("");
          }
          // If confirmation not needed, will auto-login and redirect
        } else {
          // Show error message, and in development show additional details
          const errorMsg = result.error || "Registration failed";
          if (result.details) {
            // Show detailed error in development (check via window.location for client-side)
            const isDev =
              typeof window !== "undefined" &&
              (window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1");
            if (isDev) {
              setError(
                `${errorMsg}\n\nDebug Info:\nStatus: ${result.details.status || "N/A"}\nType: ${result.details.name || "N/A"}\nOriginal: ${result.details.originalMessage || "N/A"}`
              );
            } else {
              setError(errorMsg);
            }
          } else {
            setError(errorMsg);
          }
        }
      }
    });
  };

  // Start phone login (show phone input)
  const handleStartPhoneLogin = () => {
    setPhoneStep("PHONE_INPUT");
    setError(null);
    setSuccessMessage(null);
    setPhone("");
    setOtp("");
  };

  // Phone: Send OTP (Passwordless flow - handles both sign in and sign up)
  const handleSendSMS = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("phone", phone);

      const result = await sendSMS(formData);

      if (result.success && result.step === "verify") {
        setPhoneStep("OTP_VERIFY");
        setError(null);
      } else {
        setError(result.error || "Failed to send verification code");
      }
    });
  };

  // Phone: Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("phone", phone);
      formData.append("token", otp);
      formData.append("redirectTo", redirectTo);

      try {
        const result = await verifySMS(formData);

        if (!result.success) {
          setError(result.error || "Invalid verification code");
        } else {
          // Success - Server Action's redirect() should handle navigation
          // But we add a fallback client-side navigation in case redirect() doesn't work
          if (result.success && result.redirect) {
            // Small delay to ensure cookies are set
            setTimeout(() => {
              router.push(result.redirect);
              router.refresh(); // Refresh to update auth state
            }, 100);
          }
        }
      } catch (err) {
        // redirect() in Server Action throws NEXT_REDIRECT error (expected behavior)
        // Next.js framework catches this and performs the redirect
        // If it's not a redirect error, handle it
        if (
          err instanceof Error &&
          !err.message.includes("NEXT_REDIRECT") &&
          !err.message.includes("redirect")
        ) {
          setError(err.message || "Verification failed");
        } else {
          // It's a redirect error, which means redirect is happening
          // Use client-side navigation as fallback
          setTimeout(() => {
            router.push(redirectTo);
            router.refresh();
          }, 100);
        }
      }
    });
  };

  // Reset form when switching email views
  const handleEmailViewChange = (newView: EmailView) => {
    setEmailView(newView);
    setError(null);
    setSuccessMessage(null);
    setEmail("");
    setPassword("");
  };

  // Toggle email form visibility
  const handleToggleEmailForm = () => {
    setShowEmailForm(!showEmailForm);
    setError(null);
    setSuccessMessage(null);
    if (!showEmailForm) {
      // Reset email form when opening
      setEmail("");
      setPassword("");
      setEmailView("login");
    }
  };

  // Reset phone form
  const handleResetPhone = () => {
    setPhoneStep("idle");
    setPhone("");
    setOtp("");
    setError(null);
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-brand-card border border-brand-card-border rounded-xl p-8 shadow-lg">
        {/* Header */}
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          Sign in to NBA Game
        </h1>
        <p className="text-sm text-brand-text-dim text-center mb-6">
          Choose your preferred sign-in method
        </p>

        {/* Success Message (Email Confirmation) */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-md">
            <p className="text-sm text-green-400">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
            <p className="text-sm text-red-400 whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* Top Level: Google + Phone (Parallel) */}
        <div className="space-y-3 mb-6">
          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isPending || phoneStep !== "idle"}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Phone Login Button / Form */}
          {phoneStep === "idle" ? (
            <button
              type="button"
              onClick={handleStartPhoneLogin}
              disabled={isPending || isGoogleLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-brand-blue text-brand-dark rounded-lg font-medium hover:bg-brand-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Phone className="w-5 h-5" />
              <span>Continue with Phone</span>
            </button>
          ) : phoneStep === "PHONE_INPUT" ? (
            <form onSubmit={handleSendSMS} className="space-y-3">
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-brand-text-light mb-2"
                >
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1234567890"
                  required
                  disabled={isPending}
                  className="w-full px-4 py-3 bg-brand-dark border border-brand-card-border rounded-lg text-white placeholder-brand-text-dim focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-brand-text-dim">
                  Include country code (e.g., +1 for US)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending || !phone.trim()}
                  className="flex-1 px-4 py-3 bg-brand-blue text-brand-dark font-medium rounded-lg hover:bg-brand-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    "Send Code"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleResetPhone}
                  disabled={isPending}
                  className="px-4 py-3 text-brand-text-dim bg-brand-dark border border-brand-card-border rounded-lg hover:bg-brand-dark/80 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : phoneStep === "OTP_VERIFY" ? (
            <form onSubmit={handleVerifyOTP} className="space-y-3">
              <div className="text-center">
                <p className="text-sm text-brand-text-dim">
                  Code sent to{" "}
                  <span className="text-white font-medium">{phone}</span>
                </p>
              </div>
              <div>
                <label
                  htmlFor="otp"
                  className="block text-sm font-medium text-brand-text-light mb-2"
                >
                  Verification Code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  required
                  maxLength={6}
                  disabled={isPending}
                  className="w-full px-4 py-3 bg-brand-dark border border-brand-card-border rounded-lg text-white placeholder-brand-text-dim text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent disabled:opacity-50"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending || otp.length !== 6}
                  className="flex-1 px-4 py-3 bg-brand-blue text-brand-dark font-medium rounded-lg hover:bg-brand-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" />
                      Verifying...
                    </span>
                  ) : (
                    "Verify & Continue"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleResetPhone}
                  disabled={isPending}
                  className="px-4 py-3 text-brand-text-dim bg-brand-dark border border-brand-card-border rounded-lg hover:bg-brand-dark/80 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {/* Divider */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-card-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-brand-card text-brand-text-dim">
              Or use email
            </span>
          </div>
        </div>

        {/* Bottom Level: Email Login/Register */}
        {!showEmailForm ? (
          <button
            type="button"
            onClick={handleToggleEmailForm}
            className="w-full px-4 py-3 text-brand-text-dim bg-brand-dark border border-brand-card-border rounded-lg font-medium hover:text-white hover:bg-brand-dark/80 transition-colors"
          >
            Sign in with Email
          </button>
        ) : (
          <div className="space-y-4">
            {/* Email View Tabs: Sign In / Sign Up */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleEmailViewChange("login")}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${emailView === "login"
                  ? "bg-brand-blue text-brand-dark"
                  : "bg-brand-dark text-brand-text-dim hover:text-brand-text-light"
                  }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleEmailViewChange("register")}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${emailView === "register"
                  ? "bg-brand-blue text-brand-dark"
                  : "bg-brand-dark text-brand-text-dim hover:text-brand-text-light"
                  }`}
              >
                Sign Up
              </button>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-brand-text-light mb-2"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={isPending}
                  className="w-full px-4 py-3 bg-brand-dark border border-brand-card-border rounded-lg text-white placeholder-brand-text-dim focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent disabled:opacity-50"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-brand-text-light mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={emailView === "register" ? "At least 6 characters" : "••••••"}
                  required
                  minLength={emailView === "register" ? 6 : undefined}
                  disabled={isPending}
                  className="w-full px-4 py-3 bg-brand-dark border border-brand-card-border rounded-lg text-white placeholder-brand-text-dim focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent disabled:opacity-50"
                />
                {emailView === "register" && (
                  <p className="mt-1 text-xs text-brand-text-dim">
                    Password must be at least 6 characters
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending || !email.trim() || !password.trim()}
                  className="flex-1 px-4 py-3 bg-brand-blue text-brand-dark font-medium rounded-lg hover:bg-brand-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" />
                      {emailView === "login" ? "Signing in..." : "Signing up..."}
                    </span>
                  ) : (
                    emailView === "login" ? "Sign In" : "Sign Up"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleToggleEmailForm}
                  disabled={isPending}
                  className="px-4 py-3 text-brand-text-dim bg-brand-dark border border-brand-card-border rounded-lg hover:bg-brand-dark/80 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
