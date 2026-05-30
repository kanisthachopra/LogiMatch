"use client";
import { useState } from "react";

export default function DashboardPage() {
  // 1. Form memory (state)
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [weight, setWeight] = useState("");

// 2. The submit function
  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      seeker_id: 1, // Temporarily hardcoded for testing!
      origin: origin,
      destination: destination,
      weight_kg: Number(weight) // Converts the text input into a math number
    };

    try {
      // Sending the payload to our specific jobs route
      const response = await fetch("http://localhost:5000/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Success! Your cargo from ${data.origin} is now active on the market.`);
        
        // This clears the form boxes for the next job!
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

  // 3. The visual HTML layout
  return (
    <div style={{ padding: "40px", maxWidth: "500px", margin: "auto" }}>
      <h2>LogiMatch Dashboard</h2>
      
      <div style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px" }}>
        <h3>Post a New Shipment</h3>
        <form onSubmit={handlePostJob} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          
          <input 
            type="text" 
            placeholder="Origin (e.g., Mumbai)" 
            value={origin} 
            onChange={(e) => setOrigin(e.target.value)} 
            required 
          />
          
          <input 
            type="text" 
            placeholder="Destination (e.g., Delhi)" 
            value={destination} 
            onChange={(e) => setDestination(e.target.value)} 
            required 
          />
          
          <input 
            type="number" 
            placeholder="Weight in KG" 
            value={weight} 
            onChange={(e) => setWeight(e.target.value)} 
            required 
          />
          
          <button type="submit" style={{ padding: "10px", cursor: "pointer" }}>
            Post Job
          </button>
          
        </form>
      </div>
    </div>
  );
}