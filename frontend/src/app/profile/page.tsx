"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("settings");

  const [profile, setProfile] = useState<any>(null);
  const [wonJobs, setWonJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [bio, setBio] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [bannerPhoto, setBannerPhoto] = useState("");
  const [licenseUrl, setLicenseUrl] = useState("");
  const [isPublic, setIsPublic] = useState(true);

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
        const headers = { Authorization: `Bearer ${token}` };

        const [profileRes, wonRes] = await Promise.all([
          fetch("http://localhost:5000/api/users/me", { headers }),
          fetch("http://localhost:5000/api/profile/won-jobs", { headers }),
        ]);

        if (profileRes.status === 401) {
          localStorage.clear();
          window.location.href = "/login";
          return;
        }

        const profileData = await profileRes.json();
        setProfile(profileData);
        setWonJobs(await wonRes.json());

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

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/users/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bio,
          is_public: isPublic,
          profile_photo: profilePhoto,
          banner_photo: bannerPhoto,
          license_file_url: licenseUrl,
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        setProfile(updated.profile);
        alert("Profile details successfully saved!");
      } else alert("Failed to update profile.");
    } catch (error) {
      alert("Connection error.");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/users/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

  // Helper to format dates cleanly for the dispatch view
  const formatDate = (dateString: string) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="animate-pulse text-gray-800 font-bold text-lg">Loading command center...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-gray-900">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-blue-600 tracking-tight">
            LogiMatch
          </h1>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-700 hover:text-black bg-gray-100 px-4 py-2 rounded-full font-semibold text-sm transition-colors"
          >
            ⬅ Back to Market
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div className="max-w-5xl mx-auto mt-8 px-4">
        <div className="h-48 bg-gray-300 rounded-t-2xl overflow-hidden relative border border-gray-200 shadow-xs">
          {bannerPhoto ? (
            <img
              src={bannerPhoto}
              alt="Banner"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-600 to-indigo-800"></div>
          )}
        </div>
        <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-t-0 border-gray-200 flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-12 relative z-10">
          <div className="w-28 h-28 rounded-full border-4 border-white bg-gray-200 overflow-hidden flex-shrink-0 shadow-md">
            {profilePhoto ? (
              <img
                src={profilePhoto}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="flex items-center justify-center w-full h-full text-5xl text-gray-500">
                👤
              </span>
            )}
          </div>
          <div className="flex-grow pb-2">
            <h2 className="text-3xl font-extrabold text-gray-900">
              {profile?.name}
            </h2>
            <p className="text-gray-600 font-semibold mt-1">
              {profile?.email} •{" "}
              <span className="uppercase text-blue-700 text-xs font-bold bg-blue-50 px-2 py-1 rounded ml-1">
                {profile?.role}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-10">
        <div className="flex border-b border-gray-200 gap-8 mb-8">
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-4 font-bold text-lg transition-colors ${activeTab === "settings" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-800"}`}
          >
            Account Settings
          </button>
          <button
            onClick={() => setActiveTab("my_jobs")}
            className={`pb-4 font-bold text-lg transition-colors ${activeTab === "my_jobs" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-800"}`}
          >
            My Jobs (Dispatch)
          </button>
        </div>

        {/* --- TAB 1: ACCOUNT SETTINGS --- */}
        {activeTab === "settings" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Rich Profile Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <h3 className="text-xl font-bold mb-6 text-gray-900 border-b border-gray-100 pb-2">
                Public Profile Details
              </h3>
              <form onSubmit={handleProfileUpdate} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">
                    Avatar Image URL
                  </label>
                  <input
                    type="text"
                    value={profilePhoto}
                    placeholder="https://example.com/avatar.jpg"
                    onChange={(e) => setProfilePhoto(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">
                    Banner Image URL
                  </label>
                  <input
                    type="text"
                    value={bannerPhoto}
                    placeholder="https://example.com/banner.jpg"
                    onChange={(e) => setBannerPhoto(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">
                    Bio & Experience
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    placeholder="Describe your enterprise fleet size, certifications, freight preferences..."
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm resize-none shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-1">
                    License/Certification Document URL
                  </label>
                  <input
                    type="text"
                    value={licenseUrl}
                    placeholder="Link to hosted operating license PDF..."
                    onChange={(e) => setLicenseUrl(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2 pb-4 select-none">
                  <input
                    type="checkbox"
                    id="makePublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="w-5 h-5 accent-blue-600 cursor-pointer"
                  />
                  <label htmlFor="makePublic" className="text-sm font-bold text-gray-800 cursor-pointer">
                    Make my detailed profile public
                  </label>
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 shadow-sm transition-colors cursor-pointer"
                >
                  Save Profile Settings
                </button>
              </form>
            </div>

            {/* Security Settings Section */}
            <div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sticky top-24">
                <h3 className="text-xl font-bold mb-6 text-gray-900 border-b border-gray-100 pb-2">
                  Security
                </h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-gray-900 text-white font-bold py-3 rounded-md hover:bg-black shadow-sm transition-colors cursor-pointer"
                  >
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: MY JOBS (Full Dispatch Manifest) --- */}
        {activeTab === "my_jobs" && (
          <div className="space-y-8 max-w-4xl mx-auto">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                ✅ Confirmed Dispatches
              </h3>
              {wonJobs.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
                  <p className="text-gray-500 font-medium">No confirmed jobs yet.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {wonJobs.map((job: any) => (
                    <div
                      key={job.job_id}
                      className="bg-white rounded-xl shadow-md border-t-4 border-green-500 overflow-hidden"
                    >
                      {/* Header Row */}
                      <div className="p-6 bg-gray-50 flex justify-between items-start border-b border-gray-200">
                        <div>
                          <h4 className="text-2xl font-extrabold text-gray-900">
                            {job.origin} ➔ {job.destination}
                          </h4>
                          <div className="flex gap-2 mt-2">
                            {job.is_hazmat && (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">
                                ☣️ HAZMAT
                              </span>
                            )}
                            {job.requires_refrigeration && (
                              <span className="bg-cyan-100 text-cyan-800 px-2 py-1 rounded text-xs font-bold">
                                ❄️ REEFER
                              </span>
                            )}
                            {job.is_fragile && (
                              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-bold">
                                📦 FRAGILE
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500 uppercase tracking-wide font-bold mb-1">
                            Expected Payout
                          </p>
                          <p className="text-3xl font-extrabold text-green-600">
                            ₹{job.winning_bid}
                          </p>
                        </div>
                      </div>

                      {/* Manifest Grid */}
                      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Column 1 */}
                        <div className="space-y-6">
                          <div>
                            <h5 className="text-xs uppercase font-bold text-gray-400 mb-2 border-b pb-1">
                              Cargo Details
                            </h5>
                            <p className="text-gray-800">
                              <span className="font-semibold text-gray-900">Weight:</span>{" "}
                              {job.weight_kg} kg
                            </p>
                            <p className="text-gray-800">
                              <span className="font-semibold text-gray-900">Dimensions:</span>{" "}
                              {job.length_cm || "-"} x {job.width_cm || "-"} x{" "}
                              {job.height_cm || "-"} cm
                            </p>
                            <p className="text-gray-800">
                              <span className="font-semibold text-gray-900">Packaging:</span>{" "}
                              {job.packaging_type || "Unspecified"}
                            </p>
                          </div>
                          <div>
                            <h5 className="text-xs uppercase font-bold text-gray-400 mb-2 border-b pb-1">
                              Equipment Required
                            </h5>
                            <ul className="list-disc list-inside text-gray-800 text-sm space-y-1 font-medium">
                              {job.requires_liftgate && (
                                <li className="text-gray-800">Liftgate equipped truck needed</li>
                              )}
                              {job.requires_loading_dock && (
                                <li className="text-gray-800">Loading dock present at site</li>
                              )}
                              {!job.requires_liftgate &&
                                !job.requires_loading_dock && (
                                  <li className="text-gray-500 italic font-normal">
                                    Standard loading
                                  </li>
                                )}
                            </ul>
                          </div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-6">
                          <div>
                            <h5 className="text-xs uppercase font-bold text-gray-400 mb-2 border-b pb-1">
                              Scheduling Windows
                            </h5>
                            <div className="mb-2">
                              <p className="text-sm font-bold text-gray-800">
                                Pickup
                              </p>
                              <p className="text-sm text-gray-700 font-medium">
                                {formatDate(job.pickup_window_start)} to{" "}
                                {formatDate(job.pickup_window_end)}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-800">
                                Delivery
                              </p>
                              <p className="text-sm text-gray-700 font-medium">
                                {formatDate(job.delivery_window_start)} to{" "}
                                {formatDate(job.delivery_window_end)}
                              </p>
                            </div>
                          </div>
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <h5 className="text-xs uppercase font-bold text-blue-600 mb-1">
                              Seeker Contact
                            </h5>
                            <p className="font-bold text-gray-900">
                              {job.seeker_name}
                            </p>
                            <p className="text-sm text-blue-800 font-semibold mt-0.5">
                              📧 {job.seeker_email}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Instructions Footer */}
                      <div className="bg-gray-50 p-6 border-t border-gray-200">
                        <h5 className="text-xs uppercase font-bold text-gray-500 mb-2">
                          Special Driver Instructions
                        </h5>
                        <p className="text-gray-800 font-medium italic bg-white p-3 rounded-lg border border-gray-200">
                          "{job.special_instructions || "None provided."}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}