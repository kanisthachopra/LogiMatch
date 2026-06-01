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
        window.location.reload(); // Refresh to immediately show their new bid in the list
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

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [weight, setWeight] = useState("");

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
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden sticky top-24">
              <div className="px-6 py-6">
                <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2">Post a New Shipment</h3>
                <form onSubmit={handlePostJob} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Origin City</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Mumbai" 
                      value={origin} 
                      onChange={(e) => setOrigin(e.target.value)} 
                      required 
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-black placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-black placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-md text-black placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
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