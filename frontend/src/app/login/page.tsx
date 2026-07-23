"use client";
import { useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/api";

export default function LoginPage() {
  // UI State: 'login' | 'forgot' | 'reset'
  const [step, setStep] = useState("login");

  // Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(apiUrl("/api/users/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.user.id);
        localStorage.setItem("userRole", data.user.role);
        window.location.href = "/dashboard";
      } else if (response.status === 403 && data.needsVerification) {
        alert(
          "Your email is not verified yet. Please check your inbox for the verification email.",
        );
      } else {
        alert(data.error || "Login failed");
      }
    } catch (error) {
      console.error("Connection error:", error);
      alert("Could not connect to the backend server.");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(
        apiUrl("/api/users/forgot-password"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );

      // We always move to the reset step to prevent email enumeration hacking
      alert(
        "If an account exists, a recovery code has been sent to that email.",
      );
      setStep("reset");
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        apiUrl("/api/users/reset-password"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp, newPassword }),
        },
      );

      const data = await response.json();

      if (response.ok) {
        alert("Password reset successfully! You can now log in.");
        setStep("login");
        setPassword("");
        setOtp("");
        setNewPassword("");
      } else {
        alert(data.error || "Failed to reset password.");
      }
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 text-gray-900">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-200">
        {/* --- STEP 1: LOGIN --- */}
        {step === "login" && (
          <div className="animate-fade-in">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">
                Welcome back
              </h2>
              <p className="mt-2 text-sm text-gray-600 font-medium">
                Securely log in to your LogiMatch account
              </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-bold text-gray-800">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setStep("forgot")}
                      className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Log In
              </button>
            </form>

            <div className="text-center mt-6">
              <p className="text-sm text-gray-600 font-medium">
                Don't have an account?{" "}
                <Link
                  href="/register"
                  className="font-bold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Sign up here
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* --- STEP 2: FORGOT PASSWORD REQUEST --- */}
        {step === "forgot" && (
          <div className="animate-fade-in">
            <div className="text-center">
              <h2 className="text-2xl font-extrabold text-gray-900">
                Reset Password
              </h2>
              <p className="mt-2 text-sm text-gray-600 font-medium">
                Enter your email and we'll send you a recovery code.
              </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">
                  Account Email
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 rounded-lg shadow-sm text-sm font-bold text-white bg-gray-900 hover:bg-black transition-colors cursor-pointer"
              >
                Send Recovery Code
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setStep("login")}
                  className="text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors"
                >
                  ⬅ Back to Login
                </button>
              </div>
            </form>
          </div>
        )}

        {/* --- STEP 3: RESET PASSWORD EXECUTION --- */}
        {step === "reset" && (
          <div className="animate-fade-in">
            <div className="text-center">
              <span className="text-4xl mb-3 block">🔐</span>
              <h2 className="text-2xl font-extrabold text-gray-900">
                Create New Password
              </h2>
              <p className="mt-2 text-sm text-gray-600 font-medium">
                Enter the 6-digit code sent to{" "}
                <span className="font-bold text-gray-900">{email}</span>.
              </p>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleResetPassword}>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">
                  6-Digit Recovery Code
                </label>
                <input
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-bold tracking-widest text-center text-xl transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 rounded-lg shadow-sm text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-colors mt-6 cursor-pointer"
              >
                Secure Account & Reset
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => setStep("login")}
                  className="text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors"
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
