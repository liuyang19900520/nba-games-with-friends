"use client";

import { useState, useTransition } from "react";
import { signInWithGoogle, sendSMS, verifySMSWithoutRedirect } from "@/app/login/actions";
import { useRouter } from "next/navigation";

type AuthStep = "PHONE_INPUT" | "OTP_VERIFY";

/**
 * Profile Page Login Panel
 * Displayed within /profile page, does not obscure bottom menu
 */
export function ProfileLoginPanel() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>("PHONE_INPUT");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);

    try {
      // After successful login, return to /profile page
      const { url } = await signInWithGoogle("/profile");
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setIsGoogleLoading(false);
    }
  };

  const handleSendSMS = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("phone", phone);

      const result = await sendSMS(formData);

      if (result.success && result.step === "verify") {
        setStep("OTP_VERIFY");
        setError(null);
      } else {
        setError(result.error || "Failed to send verification code");
      }
    });
  };

  const handleVerifyOTP = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("phone", phone);
      formData.append("token", otp);

      const result = await verifySMSWithoutRedirect(formData);

      if (!result.success) {
        setError(result.error || "Invalid verification code");
      } else {
        // After successful verification, refresh page to show logged-in state
        router.refresh();
      }
    });
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6">
      <div className="bg-brand-card border border-brand-card-border rounded-xl p-6 shadow-lg">
        {/* Header */}
        <h2 className="text-xl font-bold text-white mb-2 text-center">
          Sign In
        </h2>
        <p className="text-sm text-brand-text-dim text-center mb-6">
          Sign in to sync your favorites, predictions, and stats
        </p>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading || isPending}
          className="w-full mb-4 flex items-center justify-center gap-3 px-4 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Divider */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-card-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-brand-card text-brand-text-dim">
              Or continue with phone
            </span>
          </div>
        </div>

        {/* Phone Input Step */}
        {step === "PHONE_INPUT" && (
          <form onSubmit={handleSendSMS} className="space-y-4">
            <div>
              <label
                htmlFor="profile-phone"
                className="block text-sm font-medium text-brand-text-light mb-2"
              >
                Phone Number
              </label>
              <input
                id="profile-phone"
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
            <button
              type="submit"
              disabled={isPending || !phone.trim()}
              className="w-full px-4 py-3 bg-brand-blue text-brand-dark font-medium rounded-lg hover:bg-brand-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          </form>
        )}

        {/* OTP Verify Step */}
        {step === "OTP_VERIFY" && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-sm text-brand-text-dim">
                Code sent to{" "}
                <span className="text-white font-medium">{phone}</span>
              </p>
            </div>
            <div>
              <label
                htmlFor="profile-otp"
                className="block text-sm font-medium text-brand-text-light mb-2"
              >
                Verification Code
              </label>
              <input
                id="profile-otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                required
                maxLength={6}
                disabled={isPending}
                className="w-full px-4 py-3 bg-brand-dark border border-brand-card-border rounded-lg text-white placeholder-brand-text-dim text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={isPending || otp.length !== 6}
              className="w-full px-4 py-3 bg-brand-blue text-brand-dark font-medium rounded-lg hover:bg-brand-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </span>
              ) : (
                "Verify & Login"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("PHONE_INPUT");
                setOtp("");
                setError(null);
              }}
              disabled={isPending}
              className="w-full px-4 py-2 text-sm text-brand-text-dim hover:text-brand-text-light transition-colors disabled:opacity-50"
            >
              Change Phone
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
