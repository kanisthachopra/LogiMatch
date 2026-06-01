"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("settings"); // 'settings', 'posted', or 'won'
  
  // Data States
  const [profile, setProfile] = useState<any>(null);
  const [myJobs, setMyJobs] = useState([]);
  const [wonJobs, setWonJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Password Change States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          window.location.href = "/login";
          return;
        }

        const headers = { "Authorization": `Bearer ${token}` };

        // We fetch all three data sets at once using Promise.all to speed up loading
        const [profileRes, postedRes, wonRes] = await Promise.all([
          fetch("http://localhost:5000/api/users/me", { headers }),
          fetch("http://localhost:5000/api/profile/my-jobs", { headers }),
          fetch("http://localhost:5000/api/profile/won-jobs", { headers })
        ]);

        if (profileRes.status === 401) {
          localStorage.clear();
          window.location.href = "/login";
          return;
        }

        setProfile(await profileRes.json());
        setMyJobs(await postedRes.json());
        setWonJobs(await wonRes.json());

      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  // Action: Change Password
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/users/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.ok) {
        alert("Password successfully updated!");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update password.");
      }
    } catch (error) {
      alert("Connection error.");
    }
  };

  // Action: Accept Bid
  const handleAcceptBid = async (bidId: number) => {
    if (!confirm("Are you sure you want to accept this bid? This will assign the job.")) return;
    
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:5000/api/bids/${bidId}/accept`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        alert("Bid accepted successfully!");
        window.location.reload(); // Refresh to show the updated status
      } else {
        alert("Failed to accept the bid.");
      }
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="animate-pulse text-gray-500 font-bold text-xl">Loading your command center...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-blue-600 tracking-tight">LogiMatch</h1>
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors bg-gray-100 px-4 py-2 rounded-full font-medium">
            ⬅ Back to Market
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Header & Tabs */}
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-6 flex items-center gap-3">
            <span className="text-4xl">👤</span> Hello, {profile?.name}
          </h2>
          
          <div className="flex border-b border-gray-200 gap-6">
            <button 
              onClick={() => setActiveTab("settings")}
              className={`pb-3 font-medium text-lg transition-colors ${activeTab === 'settings' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Account Settings
            </button>
            <button 
              onClick={() => setActiveTab("posted")}
              className={`pb-3 font-medium text-lg transition-colors ${activeTab === 'posted' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Jobs I Posted
            </button>
            <button 
              onClick={() => setActiveTab("won")}
              className={`pb-3 font-medium text-lg transition-colors ${activeTab === 'won' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Jobs I Won
            </button>
          </div>
        </div>

        {/* --- TAB 1: ACCOUNT SETTINGS --- */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Profile Details</h3>
            <div className="mb-8 space-y-2">
              <p className="text-gray-600"><strong className="text-gray-900">Name:</strong> {profile?.name}</p>
              <p className="text-gray-600"><strong className="text-gray-900">Email:</strong> {profile?.email}</p>
              <p className="text-gray-600"><strong className="text-gray-900">Account Type:</strong> <span className="uppercase bg-gray-100 px-2 py-1 rounded text-xs font-bold">{profile?.role}</span></p>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Change Password</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)} 
                  required 
                  className="w-full px-4 py-2 border border-gray-300 rounded-md text-black placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                  className="w-full px-4 py-2 border border-gray-300 rounded-md text-black placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button type="submit" className="bg-gray-900 text-white font-bold py-2 px-6 rounded-lg hover:bg-black transition-colors">
                Update Password
              </button>
            </form>
          </div>
        )}

        {/* --- TAB 2: JOBS I POSTED --- */}
        {activeTab === "posted" && (
          <div className="space-y-6">
            {myJobs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200"><p className="text-gray-500">You haven't posted any jobs yet.</p></div>
            ) : (
              myJobs.map((job: any) => (
                <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Job Header */}
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">{job.origin} ➔ {job.destination}</h4>
                      <p className="text-sm text-gray-500">Weight: {job.weight_kg} kg | Status: <span className="uppercase font-bold">{job.status}</span></p>
                    </div>
                  </div>
                  
                  {/* Bids List */}
                  <div className="px-6 py-4">
                    <h5 className="font-bold text-gray-700 mb-3 border-b pb-1">Bids Received ({job.bids.length})</h5>
                    {job.bids.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No bids yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {job.bids.map((bid: any) => (
                          <div key={bid.bid_id} className={`flex justify-between items-center p-3 rounded-lg border ${bid.status === 'accepted' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
                            <div>
                              <p className="font-bold text-gray-900">{bid.provider_name}</p>
                              <p className="text-xs text-gray-500">{bid.provider_email}</p>
                            </div>
                            <div className="text-right flex items-center gap-4">
                              <p className="text-xl font-extrabold text-green-600">₹{bid.amount}</p>
                              
                              {/* Only show accept button if job is open */}
                              {job.status === 'open' && (
                                <button 
                                  onClick={() => handleAcceptBid(bid.bid_id)}
                                  className="bg-green-600 text-white text-sm font-bold py-1.5 px-4 rounded hover:bg-green-700 transition-colors"
                                >
                                  Accept
                                </button>
                              )}
                              
                              {bid.status === 'accepted' && (
                                <span className="bg-green-200 text-green-800 text-xs font-bold px-2 py-1 rounded">WINNER</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- TAB 3: JOBS I WON --- */}
        {activeTab === "won" && (
          <div className="space-y-6">
            {wonJobs.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200"><p className="text-gray-500">You haven't won any jobs yet. Keep bidding!</p></div>
            ) : (
              wonJobs.map((job: any) => (
                <div key={job.job_id} className="bg-white rounded-xl shadow-sm border border-green-200 p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{job.origin} ➔ {job.destination}</h3>
                      <p className="text-sm text-gray-600 mb-4 bg-gray-100 inline-block px-2 py-1 rounded">Weight: {job.weight_kg} kg</p>
                      
                      <div className="mt-2">
                        <h4 className="text-xs uppercase font-bold text-gray-400 mb-1">Seeker Contact Details</h4>
                        <p className="text-gray-900 font-medium">{job.seeker_name}</p>
                        <p className="text-gray-600 text-sm">📧 {job.seeker_email}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm text-gray-500 mb-1">Your Winning Bid</p>
                      <p className="text-3xl font-extrabold text-green-600">₹{job.winning_bid}</p>
                      <span className="mt-2 inline-block bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                        Job Assigned to You
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}