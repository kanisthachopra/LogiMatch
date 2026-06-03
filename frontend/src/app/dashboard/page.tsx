"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

// --- 1. THE JOB CARD COMPONENT  ---
function JobCard({ job, currentUserId }: { job: any, currentUserId: string | null }) {
  const [bidAmount, setBidAmount] = useState("");

  const handleBidSubmit = async () => {
    try {
      const token = localStorage.getItem("token"); 
      const response = await fetch("http://localhost:5000/api/bids", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ job_id: job.id, amount: bidAmount })
      });

      if (response.status === 401) {
        alert("Session expired. Please log in again.");
        window.location.href = "/login";
        return; 
      }

      if (response.ok) {
        alert(`Success! Bid of ₹${bidAmount} placed on Job #${job.id}`);
        setBidAmount(""); 
        window.location.reload(); 
      } else {
        alert("Failed to place bid.");
      }
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  const isMyJob = currentUserId === String(job.seeker_id);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
            {job.origin} <span className="text-gray-400 text-sm">➔</span> {job.destination}
          </h3>
          <div className="mt-2 flex gap-2 text-sm">
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
              ⚖️ {job.weight_kg} kg
            </span>
            <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium uppercase tracking-wider text-xs">
              {job.status}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-gray-400">
          <span>Job #{job.id}</span>
        </div>
      </div>
      
      {/* 🏆 THE LIVE AUCTION BOARD */}
      <div className="mb-5 bg-gray-50 rounded-lg p-4 border border-gray-100">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Live Auction Bids ({job.bids.length})</h4>
        {job.bids.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No bids yet. Be the first to bid!</p>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
            {job.bids.map((bid: any, index: number) => {
              const isMyBid = Number(currentUserId) === bid.provider_id;
              return (
                <div key={bid.bid_id} className={`flex justify-between items-center text-sm p-2 rounded-md ${isMyBid ? 'bg-blue-100 border border-blue-200' : 'bg-white border border-gray-200'}`}>
                  <span className="font-medium text-gray-800">
                    {index === 0 ? '🏆 ' : ''}{bid.provider_name} {isMyBid && <span className="text-blue-600 font-bold">(You)</span>}
                  </span>
                  <span className={`font-bold ${index === 0 ? 'text-green-600' : 'text-gray-600'}`}>
                    ₹{bid.amount}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {isMyJob ? (
        <div className="text-center py-2 bg-gray-100 rounded-lg text-gray-500 text-sm font-medium border border-gray-200">
          This is your cargo. Check your Profile to manage bids.
        </div>
      ) : (
        <div className="flex gap-3 items-center">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 font-medium">₹</span>
            </div>
            <input 
              type="number" 
              placeholder="Enter your competitive bid" 
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg text-black placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button 
            onClick={handleBidSubmit} 
            className="whitespace-nowrap bg-gray-900 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-black transition-colors"
          >
            Submit Bid
          </button>
        </div>
      )}
    </div>
  );
}

// --- 2. THE MAIN UNIFIED PAGE ---
export default function UnifiedDashboardPage() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Form States
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [weight, setWeight] = useState("");

  // Autocomplete States
  const [originSuggestions, setOriginSuggestions] = useState<any[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [isTypingOrigin, setIsTypingOrigin] = useState(false);
  const [isTypingDest, setIsTypingDest] = useState(false);

  // Pricing States
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    setCurrentUserId(localStorage.getItem("userId"));
    const fetchJobs = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/jobs");
        if (response.ok) {
          const data = await response.json();
          setJobs(data);
        }
      } catch (error) {
        console.error("Failed to fetch jobs:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchJobs();
  }, []);

  // 🗺️ Debounced Fetch for Origin
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (origin.length > 2 && isTypingOrigin) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${origin}&format=json&limit=5`);
          const data = await res.json();
          setOriginSuggestions(data);
        } catch (err) {
          console.error("Error fetching origin cities:", err);
        }
      } else {
        setOriginSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [origin, isTypingOrigin]);

  // 🗺️ Debounced Fetch for Destination
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (destination.length > 2 && isTypingDest) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${destination}&format=json&limit=5`);
          const data = await res.json();
          setDestSuggestions(data);
        } catch (err) {
          console.error("Error fetching dest cities:", err);
        }
      } else {
        setDestSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [destination, isTypingDest]);

  // Handlers for selecting a city from the dropdown
  const handleOriginSelect = (cityName: string) => {
    setOrigin(cityName.split(",")[0]); // Just keep the main city name
    setIsTypingOrigin(false);
    setOriginSuggestions([]);
  };

  const handleDestSelect = (cityName: string) => {
    setDestination(cityName.split(",")[0]);
    setIsTypingDest(false);
    setDestSuggestions([]);
  };

  // 🧮 Calculate Price Engine
  const handleCalculatePrice = async (e: React.MouseEvent) => {
    e.preventDefault(); 
    if (!origin || !destination || !weight) {
      alert("Please fill in Origin, Destination, and Weight first!");
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/price-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          originCity: origin, 
          destCity: destination, 
          weight: Number(weight) 
        })
      });
      const data = await response.json();
      
      if (response.ok) {
        setEstimatedPrice(data.price);
        setDistance(data.distance);
      } else {
        alert("Could not calculate price. Make sure cities are valid.");
      }
    } catch (error) {
      console.error("Failed to calculate price:", error);
    }
  };

  // 📦 Final Job Post 
  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ origin, destination, weight_kg: Number(weight) }),
      });

      if (response.ok) {
        alert(`Success! Cargo posted to the market.`);
        setOrigin(""); setDestination(""); setWeight("");
        setEstimatedPrice(null); setDistance(null);
        window.location.reload(); 
      } else {
        alert("Failed to post the shipment.");
      }
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-blue-600 tracking-tight">LogiMatch</h1>
          <Link href="/profile" className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors cursor-pointer bg-gray-100 px-4 py-2 rounded-full font-medium">
            <span className="text-lg">👤</span> My Profile
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Open Market</h2>
            <div className="flex flex-col gap-5">
              {isLoading ? (
                <p className="text-gray-500 font-medium animate-pulse">Loading market data...</p>
              ) : jobs.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                  <p className="text-gray-500">No open jobs on the market right now.</p>
                </div>
              ) : (
                jobs.map((job: any) => (
                  <JobCard key={job.id} job={job} currentUserId={currentUserId} />
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-visible sticky top-24">
              <div className="px-6 py-6">
                <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Post a New Shipment</h3>
                <form onSubmit={handlePostJob} className="space-y-4">
                  
                  {/* Origin Input */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Mumbai" 
                      value={origin} 
                      onChange={(e) => {
                        setOrigin(e.target.value);
                        setIsTypingOrigin(true);
                      }} 
                      required 
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-black placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {originSuggestions.length > 0 && (
                      <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {originSuggestions.map((city: any, i: number) => (
                          <li 
                            key={i} 
                            onClick={() => handleOriginSelect(city.display_name)}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 border-b last:border-0"
                          >
                            {city.display_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Destination Input */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination City</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Delhi" 
                      value={destination} 
                      onChange={(e) => {
                        setDestination(e.target.value);
                        setIsTypingDest(true);
                      }} 
                      required 
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-black placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {destSuggestions.length > 0 && (
                      <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {destSuggestions.map((city: any, i: number) => (
                          <li 
                            key={i} 
                            onClick={() => handleDestSelect(city.display_name)}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 border-b last:border-0"
                          >
                            {city.display_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Weight Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (KG)</label>
                    <input 
                      type="number" 
                      placeholder="e.g., 500" 
                      value={weight} 
                      onChange={(e) => setWeight(e.target.value)} 
                      required 
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-black placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Pricing Display */}
                  <div className="pt-2">
                    {estimatedPrice ? (
                      <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                        <p className="text-sm text-green-700 font-medium mb-1">Distance: {distance} km</p>
                        <h4 className="text-xl font-bold text-green-800">Recommended: ₹{estimatedPrice}</h4>
                      </div>
                    ) : (
                      <button 
                        onClick={handleCalculatePrice} 
                        className="w-full bg-gray-100 text-gray-700 font-bold py-2 px-4 rounded-md hover:bg-gray-200 transition-colors border border-gray-300"
                      >
                        Calculate Fair Price
                      </button>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button type="submit" className="w-full mt-2 bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 transition-colors shadow-sm">
                    Post Job to Market
                  </button>
                </form>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}