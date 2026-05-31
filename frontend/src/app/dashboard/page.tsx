"use client";
import { useState } from "react";

export default function DashboardPage() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [weight, setWeight] = useState("");

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      origin: origin,
      destination: destination,
      weight_kg: Number(weight) 
    };

    try {
      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:5000/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        alert("Your session has expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        window.location.href = "/login";
        return; 
      }

      if (response.ok) {
        const data = await response.json();
        alert(`Success! Your cargo from ${data.origin} is now active on the market.`);
        
        setOrigin("");
        setDestination("");
        setWeight("");
      } else {
        alert("Failed to post the shipment.");
      }
    } catch (error) {
      console.error("Connection error:", error);
      alert("Could not connect to the backend server.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center">
      
      {/* Header Section */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900">
          Seeker Dashboard
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Post your cargo to the open market and receive bids instantly.
        </p>
      </div>
      
      {/* The Main Card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="px-8 py-6">
          <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">
            Post a New Shipment
          </h3>
          
          <form onSubmit={handlePostJob} className="space-y-5">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
              <input 
                type="text" 
                placeholder="e.g., Mumbai" 
                value={origin} 
                onChange={(e) => setOrigin(e.target.value)} 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination City</label>
              <input 
                type="text" 
                placeholder="e.g., Delhi" 
                value={destination} 
                onChange={(e) => setDestination(e.target.value)} 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (KG)</label>
              <input 
                type="number" 
                placeholder="e.g., 500" 
                value={weight} 
                onChange={(e) => setWeight(e.target.value)} 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full mt-4 bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
            >
              Post Job to Market
            </button>
            
          </form>
        </div>
      </div>
      
    </div>
  );
}