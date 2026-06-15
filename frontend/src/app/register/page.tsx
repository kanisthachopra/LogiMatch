"use client";
import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
  // UI State: 'register' | 'verify'
  const [step, setStep] = useState("register");

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isProvider, setIsProvider] = useState(false);
  const [otp, setOtp] = useState("");

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: name,
      email: email,
      password: password,
      role: isProvider ? "driver" : "seeker",
    };

    try {
      const response = await fetch("http://localhost:5000/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Registration successful! We've sent a code to your email.");
        setStep("verify"); // Move to OTP verification step
      } else {
        alert(data.error || "Uh oh, something went wrong.");
      }
    } catch (error) {
      console.error("Connection error:", error);
      alert("Could not connect to the server.");
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:5000/api/users/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("Email verified successfully! You can now log in.");
        window.location.href = "/login";
      } else {
        alert(data.error || "Verification failed.");
      }
    } catch (error) {
      console.error("Connection error:", error);
      alert("Could not connect to the server.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 text-gray-900">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-200">
        
        {step === "register" && (
          <>
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">Join LogiMatch</h2>
              <p className="mt-2 text-sm text-gray-600 font-medium">Create an account to connect with the logistics network</p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleRegisterSubmit}>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g., Falguni Chopra"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Email Address</label>
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
                <label className="block text-sm font-bold text-gray-800 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all"
                />
              </div>

              <div className="flex items-center bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2 select-none">
                <input
                  type="checkbox"
                  id="role-checkbox"
                  checked={isProvider}
                  onChange={(e) => setIsProvider(e.target.checked)}
                  className="h-5 w-5 accent-blue-600 cursor-pointer"
                />
                <label htmlFor="role-checkbox" className="ml-3 block text-sm font-bold text-gray-800 cursor-pointer">
                  I am a Truck Driver (Provider)
                </label>
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors mt-6 cursor-pointer"
              >
                Create Account
              </button>
            </form>

            <div className="text-center mt-6">
              <p className="text-sm text-gray-600 font-medium">
                Already have an account?{" "}
                <Link href="/login" className="font-bold text-blue-600 hover:text-blue-700 transition-colors">
                  Log in here
                </Link>
              </p>
            </div>
          </>
        )}

        {step === "verify" && (
          <div className="animate-fade-in">
            <div className="text-center">
              <span className="text-5xl mb-4 block">📬</span>
              <h2 className="text-3xl font-extrabold text-gray-900">Check Your Email</h2>
              <p className="mt-2 text-sm text-gray-600 font-medium">
                We've sent a 6-digit verification code to <span className="font-bold text-gray-900">{email}</span>.
              </p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleVerifySubmit}>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1 text-center">Enter 6-Digit Code</label>
                <input
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-center tracking-widest text-2xl transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-colors mt-6 cursor-pointer"
              >
                Verify & Complete Registration
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}