"use server";

import { createClient } from "@/lib/auth/supabase";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { logger } from "@/config/env";

/**
 * Server Actions for Authentication
 */

/**
 * Google OAuth Login
 * Returns redirect URL, client is responsible for navigation
 * @param next - Page to redirect to after successful login (optional, defaults to /lineup)
 */
export async function signInWithGoogle(
  next?: string
): Promise<{ url: string }> {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") || "http://localhost:3000";
  const redirectTo = next
    ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    : `${origin}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error) {
    throw new Error(`Google OAuth failed: ${error.message}`);
  }

  if (!data.url) {
    throw new Error("OAuth URL not generated");
  }

  return { url: data.url };
}

/**
 * 发送 SMS OTP
 * 返回成功状态和下一步提示
 */
export async function sendSMS(formData: FormData): Promise<{
  success: boolean;
  step?: string;
  phone?: string;
  error?: string;
}> {
  const phone = formData.get("phone")?.toString().trim();

  if (!phone) {
    return { success: false, error: "Phone number is required" };
  }

  // Basic phone number format validation (can be adjusted as needed)
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phone)) {
    return {
      success: false,
      error: "Please enter a valid phone number (e.g., +1234567890)",
    };
  }

  const supabase = await createClient();

  // Log phone number for debugging
  logger.info("[sendSMS] Attempting to send OTP:", { phone });

  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      channel: "sms",
    },
  });

  if (error) {
    // Log detailed error for debugging
    logger.error("[sendSMS] Supabase signInWithOtp error:", {
      message: error.message,
      status: error.status,
      name: error.name,
      phone: phone,
      fullError: JSON.stringify(error, null, 2),
    });

    // Provide more user-friendly error messages
    let errorMessage = error.message;

    // Handle Twilio-specific errors
    if (
      error.message.includes("Twilio") ||
      error.message.includes("20404") ||
      error.message.includes("resource was not found")
    ) {
      if (process.env.NODE_ENV === "development") {
        errorMessage = `SMS sending failed (Twilio 20404): This usually means:\n1. Twilio account not configured in Supabase\n2. Invalid Twilio credentials\n3. Phone number format issue\n4. Twilio service not enabled\n\nCheck: Supabase Dashboard → Authentication → Providers → Phone → Twilio settings\n\nOriginal: ${error.message}`;
      } else {
        errorMessage =
          "Failed to send SMS. Please check your phone number format or contact support.";
      }
    }

    return { success: false, error: errorMessage };
  }

  // Log success
  logger.info("[sendSMS] OTP sent successfully:", { phone });

  return { success: true, step: "verify", phone };
}

/**
 * Verify SMS OTP
 * Redirects to lineup page after success
 */
export async function verifySMS(
  formData: FormData
): Promise<
  { success: true; redirect: string } | { success: false; error: string }
> {
  const phone = formData.get("phone")?.toString().trim();
  const token = formData.get("token")?.toString().trim();
  const redirectTo = formData.get("redirectTo")?.toString() || "/lineup";

  if (!phone || !token) {
    return { success: false, error: "Phone and code are required" };
  }

  const supabase = await createClient();

  logger.info("[verifySMS] Attempting to verify OTP:", { phone, token: "***" });

  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) {
    logger.error("[verifySMS] OTP verification failed:", {
      message: error.message,
      status: error.status,
      phone: phone,
    });
    return { success: false, error: error.message };
  }

  logger.info("[verifySMS] OTP verified successfully, redirecting to:", {
    redirectTo,
    userId: data.user?.id,
  });

  // After successful verification, redirect to specified page
  // Note: redirect() in Server Actions throws a NEXT_REDIRECT error internally
  // This is expected behavior in Next.js - the framework catches it and performs redirect
  // We return success with redirect info so client can handle fallback navigation if needed
  redirect(redirectTo);

  // This line should never be reached, but TypeScript needs it for return type
  return { success: true as const, redirect: redirectTo };
}

/**
 * Verify SMS OTP (without redirect)
 * Used for login within /profile page, refreshes current page after login
 */
export async function verifySMSWithoutRedirect(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const phone = formData.get("phone")?.toString().trim();
  const token = formData.get("token")?.toString().trim();

  if (!phone || !token) {
    return { success: false, error: "Phone and code are required" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 登出
 * 清除会话并重定向到登录页
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/login");
}

/**
 * 登出（不重定向）
 * 用于在 /profile 页面内登出，登出后刷新当前页面显示登录面板
 */
export async function signOutWithoutRedirect(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to sign out",
    };
  }
}

/**
 * Email/Password Login
 * @param formData - Contains email and password
 * @param next - Page to redirect to after successful login (optional)
 */
export async function emailLogin(
  formData: FormData,
  next?: string
): Promise<{ success: boolean; error?: string }> {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Please enter a valid email address" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // Login successful, redirect
  redirect(next || "/lineup");
}

/**
 * Email/Password Registration
 * @param formData - Contains email and password
 * @param next - Page to redirect to after successful registration (optional)
 */
export async function emailSignup(
  formData: FormData,
  next?: string
): Promise<
  | { success: true; needsEmailConfirmation: boolean }
  | {
      success: false;
      error: string;
      details?: {
        status?: number | string;
        name?: string;
        originalMessage?: string;
      };
    }
> {
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Please enter a valid email address" };
  }

  // Password strength validation (at least 6 characters)
  if (password.length < 6) {
    return {
      success: false,
      error: "Password must be at least 6 characters long",
    };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    // Log detailed error information for debugging
    logger.error("[emailSignup] Supabase signUp error:", {
      message: error.message,
      status: error.status,
      name: error.name,
      email: email, // Log email for debugging (be careful in production)
      fullError: JSON.stringify(error, null, 2),
    });

    // Provide more user-friendly error messages
    let errorMessage = error.message;
    let showDetailedError = false;

    // Handle specific email sending errors
    if (
      error.message.includes("confirmation email") ||
      error.message.includes("email") ||
      error.message.includes("smtp") ||
      error.message.includes("mail") ||
      error.status === 500
    ) {
      // Check for specific error codes
      const errorCode = (error as { code?: string }).code;

      // In development, show detailed error; in production, show generic message
      if (process.env.NODE_ENV === "development") {
        if (error.status === 500 && errorCode === "unexpected_failure") {
          errorMessage = `Email sending failed (500): This usually means:\n1. SMTP not configured or invalid credentials\n2. Supabase built-in email service issue\n3. Email provider blocking\n\nCheck Supabase Dashboard → Authentication → Email Templates → SMTP Settings\n\nOriginal: ${error.message}`;
        } else {
          errorMessage = `Email sending failed: ${error.message} (Status: ${
            error.status || "unknown"
          }, Code: ${errorCode || "unknown"})`;
        }
        showDetailedError = true;
      } else {
        if (error.status === 500) {
          errorMessage =
            "Email service temporarily unavailable. Please try again later or contact support.";
        } else {
          errorMessage =
            "Failed to send confirmation email. Please check your Supabase email configuration or try again later.";
        }
      }
    }

    // Return error with additional details for debugging
    return {
      success: false,
      error: errorMessage,
      // Include detailed error in development
      ...(showDetailedError && {
        details: {
          status: error.status,
          name: error.name,
          originalMessage: error.message,
        },
      }),
    };
  }

  // Check if email confirmation is needed
  // If Supabase returns a session, auto-confirm is enabled
  // If no session, email confirmation is required
  const needsEmailConfirmation = !data.session;

  if (needsEmailConfirmation) {
    // Email confirmation needed, return prompt message
    return { success: true, needsEmailConfirmation: true };
  } else {
    // Auto-login, redirect
    redirect(next || "/lineup");
  }
}

/**
 * Link Phone Number to Existing Account
 * Sends OTP to the new phone number for verification
 * @param formData - Contains phone number
 */
export async function linkPhone(formData: FormData): Promise<{
  success: boolean;
  phone?: string;
  error?: string;
}> {
  const phone = formData.get("phone")?.toString().trim();

  if (!phone) {
    return { success: false, error: "Phone number is required" };
  }

  // Basic phone number format validation
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phone)) {
    return {
      success: false,
      error: "Please enter a valid phone number (e.g., +1234567890)",
    };
  }

  const supabase = await createClient();

  logger.info("[linkPhone] Attempting to link phone:", { phone });

  // Update user with new phone number - this will send an OTP
  const { error } = await supabase.auth.updateUser({
    phone,
  });

  if (error) {
    logger.error("[linkPhone] Failed to link phone:", {
      message: error.message,
      status: error.status,
      phone: phone,
    });

    // Check for identity already exists error
    if (
      error.message.includes("already exists") ||
      error.message.includes("already registered") ||
      error.message.includes("Identity") ||
      error.status === 422
    ) {
      return {
        success: false,
        error:
          "This phone number is already registered to another account. Please sign in with that number instead.",
      };
    }

    return { success: false, error: error.message };
  }

  logger.info("[linkPhone] OTP sent successfully:", { phone });

  return { success: true, phone };
}

/**
 * Verify Phone Change OTP
 * Verifies the OTP sent to the new phone number
 * @param formData - Contains phone and token (OTP)
 */
export async function verifyPhoneChange(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const phone = formData.get("phone")?.toString().trim();
  const token = formData.get("token")?.toString().trim();

  if (!phone || !token) {
    return { success: false, error: "Phone and code are required" };
  }

  const supabase = await createClient();

  logger.info("[verifyPhoneChange] Attempting to verify OTP:", {
    phone,
    token: "***",
  });

  // IMPORTANT: type must be 'phone_change' for linking phone to existing account
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "phone_change",
  });

  if (error) {
    logger.error("[verifyPhoneChange] OTP verification failed:", {
      message: error.message,
      status: error.status,
      phone: phone,
    });

    // Check for identity already exists error
    if (
      error.message.includes("already exists") ||
      error.message.includes("already registered") ||
      error.message.includes("Identity")
    ) {
      return {
        success: false,
        error:
          "This phone number is already registered to another account. Please sign in with that number instead.",
      };
    }

    return { success: false, error: error.message };
  }

  logger.info("[verifyPhoneChange] Phone linked successfully:", { phone });

  return { success: true };
}

/**
 * Link Email to Existing Account
 * Sends confirmation email to the new email address
 * @param formData - Contains email
 */
export async function linkEmail(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  const email = formData.get("email")?.toString().trim();

  if (!email) {
    return { success: false, error: "Email address is required" };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "Please enter a valid email address" };
  }

  const supabase = await createClient();

  logger.info("[linkEmail] Attempting to link email:", { email });

  // Update user with new email - this will send a confirmation email
  const { error } = await supabase.auth.updateUser({
    email,
  });

  if (error) {
    logger.error("[linkEmail] Failed to link email:", {
      message: error.message,
      status: error.status,
      email: email,
    });

    // Check for identity already exists error
    if (
      error.message.includes("already exists") ||
      error.message.includes("already registered") ||
      error.message.includes("Identity") ||
      error.status === 422
    ) {
      return {
        success: false,
        error:
          "This email address is already registered to another account. Please sign in with that email instead.",
      };
    }

    // Handle email sending errors
    if (
      error.message.includes("confirmation email") ||
      error.message.includes("email") ||
      error.message.includes("smtp") ||
      error.message.includes("mail") ||
      error.status === 500
    ) {
      if (process.env.NODE_ENV === "development") {
        return {
          success: false,
          error: `Email sending failed: ${error.message} (Status: ${
            error.status || "unknown"
          })`,
        };
      } else {
        return {
          success: false,
          error:
            "Failed to send confirmation email. Please check your Supabase email configuration or try again later.",
        };
      }
    }

    return { success: false, error: error.message };
  }

  logger.info("[linkEmail] Confirmation email sent successfully:", { email });

  return { success: true };
}
