"use client";
import { useState } from "react";

export default function RegisterPage() {
  // 1. Setting up the "memory" (state) for our form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isProvider, setIsProvider] = useState(false);

// 2. The function that runs when the user clicks "Sign Up"
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevents the page from refreshing
    
    // We package the state into the exact JSON format our server expects
    const payload = {
      name: name,
      email: email,
      password: password,
      is_provider: isProvider
    };
    
    try {
      // Here is our digital messenger!
      const response = await fetch("http://localhost:5000/api/users/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload), // Converts our object to a JSON string
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Success! Welcome to LogiMatch, ${data.name}`);
      } else {
        alert("Uh oh, something went wrong.");
      }
    } catch (error) {
      console.error("Connection error:", error);
      alert("Could not connect to the server.");
    }
  };

  // 3. The visual HTML that the user actually sees
  return (
    <div style={{ padding: "40px", maxWidth: "400px", margin: "auto" }}>
      <h2>Join LogiMatch</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        
        <input 
          type="text" 
          placeholder="Full Name" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required 
        />
        
        <input 
          type="email" 
          placeholder="Email Address" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
        />
        
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        
        <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input 
            type="checkbox" 
            checked={isProvider} 
            onChange={(e) => setIsProvider(e.target.checked)} 
          />
          I am a Truck Driver (Provider)
        </label>
        
        <button type="submit" style={{ padding: "10px", cursor: "pointer" }}>
          Sign Up
        </button>
        
      </form>
    </div>
  );
}