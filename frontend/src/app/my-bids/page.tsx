"use client";
import { useState, useEffect } from "react";

export default function MyBidsPage() {
  const [bids, setBids] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Added a loading state!

  useEffect(() => {
    const fetchMyBids = async () => {
      try {
        const token = localStorage.getItem("token"); 

        const response = await fetch("http://localhost:5000/api/seeker/bids", {
          headers: {
            "Authorization": `Bearer ${token}` 
          }
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
          const data = await response.json();
          setBids(data);
        }
      } catch (error) {
        console.error("Failed to fetch bids:", error);
      } finally {
        setIsLoading(false); // Stop loading once done
      }
    };
    fetchMyBids();
  }, []);

  const handleAcceptBid = async (bidId: number) => {
    try {
      const token = localStorage.getItem("token"); 

      const response = await fetch(`http://localhost:5000/api/bids/${bidId}/accept`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}` 
        }
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
        alert("Bid accepted successfully! The job is now assigned.");
        window.location.reload(); 
      } else {
        alert("Failed to accept the bid.");
      }
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900">
            My Cargo: Active Bids
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Review offers from drivers and assign your shipments.
          </p>
        </div>
        
        {/* Bids Feed List */}
        <div className="flex flex-col gap-5">
          {isLoading ? (
            <div className="text-center py-10">
              <p className="text-gray-500 font-medium animate-pulse">Loading your bids...</p>
            </div>
          ) : bids.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
              <p className="text-gray-500">No bids on your cargo yet. Hang tight!</p>
            </div>
          ) : (
            bids.map((bid: any) => (
              <div key={bid.bid_id} className={`bg-white rounded-xl shadow-sm border p-6 transition-all ${bid.status === 'accepted' ? 'border-green-500 ring-1 ring-green-500' : 'border-gray-200 hover:shadow-md'}`}>
                
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  
                  {/* Left Side: Route & Details */}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3 mb-2">
                      {bid.origin} 
                      <span className="text-gray-400 text-sm">➔</span> 
                      {bid.destination}
                    </h3>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                        Weight: {bid.weight_kg} kg
                      </span>
                      <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${bid.status === 'accepted' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {bid.status}
                      </span>
                    </div>
                  </div>
                  
                  {/* Right Side: Price & Action */}
                  <div className="flex flex-col items-start sm:items-end w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                    <p className="text-3xl font-extrabold text-green-600 mb-2">
                      ₹{bid.amount}
                    </p>
                    
                    {/* We only show the accept button if the bid is pending! */}
                    {bid.status !== 'accepted' && (
                      <button 
                        onClick={() => handleAcceptBid(bid.bid_id)}
                        className="w-full sm:w-auto bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                      >
                        Accept Offer
                      </button>
                    )}
                    {bid.status === 'accepted' && (
                      <p className="text-sm font-medium text-green-700 flex items-center gap-1">
                        ✓ Job Assigned
                      </p>
                    )}
                  </div>

                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}