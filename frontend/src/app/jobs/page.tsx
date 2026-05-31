"use client";
import { useState, useEffect } from "react";

// 1. The stylized Job Card
function JobCard({ job }: { job: any }) {
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
        // We only need to send the job ID and the money! The backend knows who the driver is via the token.
        body: JSON.stringify({
          job_id: job.id,       
          amount: bidAmount     
        })
      });

      if (response.status === 401) {
        alert("Your session has expired. Please log in again.");
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("userRole");
        window.location.href = "/login";
        return; 
      }

      if (response.ok) {
        alert(`Success! Bid of ₹${bidAmount} placed on Job #${job.id}`);
        setBidAmount(""); 
      } else {
        alert("Failed to place bid.");
      }
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      
      {/* Card Header: Route and Status */}
      <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
            {job.origin} 
            <span className="text-gray-400 text-sm">➔</span> 
            {job.destination}
          </h3>
          <div className="mt-2 flex gap-2 text-sm">
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
              ⚖️ {job.weight_kg} kg
            </span>
            <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium uppercase tracking-wider text-xs flex items-center">
              {job.status}
            </span>
          </div>
        </div>
        <div className="text-right text-xs text-gray-400 flex flex-col gap-1">
          <span>Job #{job.id}</span>
          <span>Seeker #{job.seeker_id}</span>
        </div>
      </div>
      
      {/* Card Footer: Bidding Action */}
      <div className="flex flex-col sm:flex-row gap-3 mt-4 items-center">
        <div className="relative w-full sm:w-auto flex-grow">
          {/* Pinned Currency Symbol */}
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm font-medium">₹</span>
          </div>
          <input 
            type="number" 
            placeholder="Enter your bid amount" 
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        <button 
          onClick={handleBidSubmit} 
          className="w-full sm:w-auto whitespace-nowrap bg-gray-900 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-black transition-colors shadow-sm"
        >
          Submit Bid
        </button>
      </div>
      
    </div>
  );
}

// 2. The stylized Main Page
export default function JobFeedPage() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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
        setIsLoading(false); // Stop the loading animation once data arrives!
      }
    };
    fetchJobs();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Open Market
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Browse available cargo shipments and submit your competitive bids.
          </p>
        </div>
        
        {/* Job Feed List */}
        <div className="flex flex-col gap-5">
          {isLoading ? (
            <div className="text-center py-10">
              <p className="text-gray-500 font-medium animate-pulse">Loading market data...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
              <p className="text-gray-500">No open jobs on the market right now. Check back later!</p>
            </div>
          ) : (
            jobs.map((job: any) => <JobCard key={job.id} job={job} />)
          )}
        </div>

      </div>
    </div>
  );
}