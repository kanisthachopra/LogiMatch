"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("settings"); // 'settings' or 'my_jobs'
  
  // Data States
  const [profile, setProfile] = useState<any>(null);
  const [wonJobs, setWonJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Profile Edit States (NEW)
  const [bio, setBio] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [bannerPhoto, setBannerPhoto] = useState("");
  const [licenseUrl, setLicenseUrl] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Password Change States (Kept from your original code)
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

        // We only fetch profile and won jobs now
        const [profileRes, wonRes] = await Promise.all([
          fetch("http://localhost:5000/api/users/me", { headers }),
          fetch("http://localhost:5000/api/profile/won-jobs", { headers })
        ]);

        if (profileRes.status === 401) {
          localStorage.clear();
          window.location.href = "/login";
          return;
        }

        const profileData = await profileRes.json();
        setProfile(profileData);
        setWonJobs(await wonRes.json());

        // Pre-fill the edit states with existing database data
        setBio(profileData.bio || "");
        setProfilePhoto(profileData.profile_photo || "");
        setBannerPhoto(profileData.banner_photo || "");
        setLicenseUrl(profileData.license_file_url || "");
        setIsPublic(profileData.is_public ?? true);

      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  // Action: Update Rich Profile Details
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/users/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          bio, 
          is_public: isPublic, 
          profile_photo: profilePhoto, 
          banner_photo: bannerPhoto, 
          license_file_url: licenseUrl 
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        setProfile(updated.profile); // Update the UI instantly
        alert("Profile details successfully saved!");
      } else {
        alert("Failed to update profile.");
      }
    } catch (error) {
      alert("Connection error.");
    }
  };

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

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="animate-pulse text-gray-500 font-bold text-xl">Loading your command center...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-blue-600 tracking-tight">LogiMatch</h1>
          <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors bg-gray-100 px-4 py-2 rounded-full font-medium text-sm">
            ⬅ Back to Market
          </Link>
        </div>
      </nav>

      {/* --- HERO SECTION: BANNER & AVATAR --- */}
      <div className="max-w-5xl mx-auto mt-8 px-4 sm:px-6 lg:px-8">
        <div className="h-48 bg-gray-300 rounded-t-2xl overflow-hidden relative border border-gray-200 shadow-sm">
          {bannerPhoto ? (
            <img src={bannerPhoto} alt="Banner" className="w-full h-full object-cover"/>
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-600 to-indigo-800"></div>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-t-0 border-gray-200 flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-12 relative z-10">
          <div className="w-28 h-28 rounded-full border-4 border-white bg-gray-200 overflow-hidden flex-shrink-0 shadow-md">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover"/>
            ) : (
              <span className="flex items-center justify-center w-full h-full text-5xl">👤</span>
            )}
          </div>
          <div className="flex-grow pb-2">
            <h2 className="text-3xl font-extrabold text-gray-900">{profile?.name}</h2>
            <p className="text-gray-500 font-medium mt-1">
              {profile?.email} • <span className="uppercase text-blue-700 text-xs font-bold bg-blue-50 px-2 py-1 rounded ml-1">{profile?.role}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 gap-8 mb-8">
          <button 
            onClick={() => setActiveTab("settings")}
            className={`pb-4 font-bold text-lg transition-colors ${activeTab === 'settings' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
          >
            Account Settings
          </button>
          <button 
            onClick={() => setActiveTab("my_jobs")}
            className={`pb-4 font-bold text-lg transition-colors ${activeTab === 'my_jobs' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
          >
            My Jobs
          </button>
        </div>

        {/* --- TAB 1: ACCOUNT SETTINGS --- */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Rich Profile Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Public Profile Details</h3>
              <form onSubmit={handleProfileUpdate} className="space-y-5">
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Avatar Image URL</label>
                  <input type="text" placeholder="https://..." value={profilePhoto} onChange={(e) => setProfilePhoto(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Banner Image URL</label>
                  <input type="text" placeholder="https://..." value={bannerPhoto} onChange={(e) => setBannerPhoto(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Bio & Experience</label>
                  <textarea rows={4} placeholder="Tell others about your logistics experience, vehicle types, or company details..." value={bio} onChange={(e) => setBio(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md resize-none outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">License/Certification Document URL</label>
                  <input type="text" placeholder="Link to PDF or Image (Google Drive, AWS, etc.)" value={licenseUrl} onChange={(e) => setLicenseUrl(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="flex items-center gap-3 pt-2 pb-4">
                  <input type="checkbox" id="isPublic" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="w-5 h-5 cursor-pointer accent-blue-600"/>
                  <label htmlFor="isPublic" className="text-sm font-medium text-gray-700 cursor-pointer">Make my detailed profile public to other users</label>
                </div>

                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 transition-colors">
                  Save Profile Settings
                </button>
              </form>
            </div>

            {/* Change Password Form (From Original) */}
            <div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sticky top-24">
                <h3 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Security</h3>
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
                  <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 px-6 rounded-md hover:bg-black transition-colors">
                    Update Password
                  </button>
                </form>
              </div>
            </div>
            
          </div>
        )}

        {/* --- TAB 2: MY JOBS (Won + Active Bids) --- */}
        {activeTab === "my_jobs" && (
          <div className="space-y-10 max-w-3xl">
            
            {/* Section 1: Confirmed / Assigned Jobs */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                ✅ Confirmed & Assigned to Me
              </h3>
              {wonJobs.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-gray-200"><p className="text-gray-500">No confirmed jobs yet. Keep bidding!</p></div>
              ) : (
                <div className="space-y-4">
                  {wonJobs.map((job: any) => (
                    <div key={job.job_id} className="bg-white rounded-xl shadow-sm border border-green-300 p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-lg font-bold text-gray-900">{job.origin} ➔ {job.destination}</h4>
                          <p className="text-sm text-gray-600 mb-3 mt-1">Weight: {job.weight_kg} kg</p>
                          
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
                            <h5 className="text-xs uppercase font-bold text-gray-500 mb-1">Seeker Contact</h5>
                            <p className="font-bold text-gray-800">{job.seeker_name}</p>
                            <p className="text-sm text-gray-600">📧 {job.seeker_email}</p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <p className="text-3xl font-extrabold text-green-600">₹{job.winning_bid}</p>
                          <span className="mt-2 bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            Assigned to You
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Section 2: Active Bids in Progress */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 opacity-80">
                ⏳ Active Bids (In Progress)
              </h3>
              <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
                <p className="text-gray-500 italic">
                  Head over to the Open Market dashboard to monitor the real-time status of your active bids!
                </p>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}