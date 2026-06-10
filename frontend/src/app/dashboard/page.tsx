"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

// --- 1. THE JOB CARD COMPONENT ---
function JobCard({
  job,
  currentUserId,
}: {
  job: any;
  currentUserId: string | null;
}) {
  const [bidAmount, setBidAmount] = useState("");
  const [showSeekerProfile, setShowSeekerProfile] = useState(false);
  const [showManifest, setShowManifest] = useState(false);

  const handleBidSubmit = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/bids", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ job_id: job.id, amount: bidAmount }),
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

  // Helper to format dates cleanly
  const formatDate = (dateString: string) => {
    if (!dateString) return "TBD";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative">
      {/* Action Buttons Top Right */}
      <div className="absolute top-6 right-6 flex gap-2">
        <button
          onClick={() => setShowManifest(!showManifest)}
          className="text-xs font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full hover:bg-gray-200 transition-colors"
        >
          {showManifest ? "Hide Manifest" : "View Manifest"}
        </button>
        <button
          onClick={() => setShowSeekerProfile(!showSeekerProfile)}
          className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full hover:bg-blue-100 transition-colors"
        >
          {showSeekerProfile ? "Hide Seeker" : "View Seeker"}
        </button>
      </div>

      <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3 pr-48">
            {job.origin} <span className="text-gray-400 text-sm">➔</span>{" "}
            {job.destination}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium">
              ⚖️ {job.weight_kg} kg
            </span>
            <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium uppercase tracking-wider text-xs">
              {job.status}
            </span>
            {/* Risk Badges */}
            {job.is_hazmat && (
              <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full font-bold text-xs">
                ☣️ HAZMAT
              </span>
            )}
            {job.requires_refrigeration && (
              <span className="bg-cyan-100 text-cyan-800 px-3 py-1 rounded-full font-bold text-xs">
                ❄️ REEFER
              </span>
            )}
            {job.is_fragile && (
              <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-bold text-xs">
                📦 FRAGILE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Seeker Profile View */}
      {showSeekerProfile && (
        <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200 flex gap-4 items-center animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-gray-300 flex-shrink-0 overflow-hidden border-2 border-white shadow-sm">
            {job.seeker_photo ? (
              <img
                src={job.seeker_photo}
                alt="Seeker Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="flex items-center justify-center w-full h-full text-2xl text-gray-600">
                👤
              </span>
            )}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">
              {job.seeker_name || "Verified Cargo Seeker"}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              {job.seeker_bio || "This user hasn't added a bio yet."}
            </p>
          </div>
        </div>
      )}

      {/* Expanded Manifest View */}
      {showManifest && (
        <div className="mb-5 p-5 bg-blue-50/50 rounded-lg border border-blue-100 text-sm animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-bold text-gray-800 mb-2 border-b border-blue-200 pb-1">
              Cargo Details
            </h4>
            <p className="text-gray-700">
              <span className="font-semibold text-gray-900">Dimensions:</span>{" "}
              {job.length_cm || "-"}L x {job.width_cm || "-"}W x{" "}
              {job.height_cm || "-"}H cm
            </p>
            <p className="text-gray-700">
              <span className="font-semibold text-gray-900">Packaging:</span>{" "}
              {job.packaging_type || "Unspecified"}
            </p>
          </div>
          <div>
            <h4 className="font-bold text-gray-800 mb-2 border-b border-blue-200 pb-1">
              Scheduling
            </h4>
            <p className="text-gray-700">
              <span className="font-semibold text-gray-900">Pickup:</span>{" "}
              {formatDate(job.pickup_window_start)} -{" "}
              {formatDate(job.pickup_window_end)}
            </p>
            <p className="text-gray-700">
              <span className="font-semibold text-gray-900">Delivery:</span>{" "}
              {formatDate(job.delivery_window_start)} -{" "}
              {formatDate(job.delivery_window_end)}
            </p>
          </div>
          <div className="md:col-span-2">
            <h4 className="font-bold text-gray-800 mb-2 border-b border-blue-200 pb-1">
              Equipment & Instructions
            </h4>
            <p className="text-gray-700 mb-1">
              <span className="font-semibold text-gray-900">Requires:</span>
              {job.requires_liftgate ? " Liftgate " : ""}
              {job.requires_loading_dock ? " Loading Dock " : ""}
              {!job.requires_liftgate && !job.requires_loading_dock
                ? " Standard Loading"
                : ""}
            </p>
            <p className="text-gray-700 font-medium italic mt-2 bg-white p-3 rounded-lg border border-blue-100">
              "{job.special_instructions || "No special instructions provided."}"
            </p>
          </div>
        </div>
      )}

      {/* 🏆 THE LIVE AUCTION BOARD */}
      <div className="mb-5 bg-gray-50 rounded-lg p-4 border border-gray-100">
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          Live Auction Bids ({job.bids.length})
        </h4>
        {job.bids.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No bids yet. Be the first to bid!
          </p>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
            {job.bids.map((bid: any, index: number) => {
              const isMyBid = Number(currentUserId) === bid.provider_id;
              return (
                <div
                  key={bid.bid_id}
                  className={`flex items-center text-sm p-2 rounded-md ${isMyBid ? "bg-blue-100 border border-blue-200" : "bg-white border border-gray-200"}`}
                >
                  <div className="w-6 h-6 rounded-full bg-gray-200 mr-3 overflow-hidden flex-shrink-0">
                    {bid.provider_photo ? (
                      <img
                        src={bid.provider_photo}
                        alt="Provider"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-xs text-gray-500">
                        👤
                      </span>
                    )}
                  </div>
                  <span className="font-medium text-gray-800 flex-grow">
                    {index === 0 ? "🏆 " : ""}
                    {bid.provider_name}{" "}
                    {isMyBid && (
                      <span className="text-blue-600 font-bold">(You)</span>
                    )}
                  </span>
                  <span
                    className={`font-bold ${index === 0 ? "text-green-600" : "text-gray-600"}`}
                  >
                    ₹{bid.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isMyJob ? (
        <div className="text-center py-2 bg-gray-100 rounded-lg text-gray-500 text-sm font-medium border border-gray-200">
          This is your cargo. Check your History to manage bids.
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
              className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium shadow-sm"
            />
          </div>
          <button
            onClick={handleBidSubmit}
            className="whitespace-nowrap bg-gray-900 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-black transition-colors shadow-sm"
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
  const [myHistory, setMyHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Form States (Basic)
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [weight, setWeight] = useState("");

  // Form States (Professional Manifest)
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [packagingType, setPackagingType] = useState("Palletized");
  const [isFragile, setIsFragile] = useState(false);
  const [isHazmat, setIsHazmat] = useState(false);
  const [requiresRefrigeration, setRequiresRefrigeration] = useState(false);
  const [pickupStart, setPickupStart] = useState("");
  const [pickupEnd, setPickupEnd] = useState("");
  const [deliveryStart, setDeliveryStart] = useState("");
  const [deliveryEnd, setDeliveryEnd] = useState("");
  const [requiresLiftgate, setRequiresLiftgate] = useState(false);
  const [requiresLoadingDock, setRequiresLoadingDock] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");

  const [originSuggestions, setOriginSuggestions] = useState<any[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [isTypingOrigin, setIsTypingOrigin] = useState(false);
  const [isTypingDest, setIsTypingDest] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    setCurrentUserId(localStorage.getItem("userId"));
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = token
          ? { Authorization: `Bearer ${token}` }
          : undefined;

        const jobsRes = await fetch("http://localhost:5000/api/jobs");
        if (jobsRes.ok) setJobs(await jobsRes.json());

        if (token) {
          const historyRes = await fetch(
            "http://localhost:5000/api/profile/my-jobs",
            { headers },
          );
          if (historyRes.ok) setMyHistory(await historyRes.json());
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Debounced Autocomplete (Origin)
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (origin.length > 2 && isTypingOrigin) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${origin}&format=json&limit=5`,
          );
          setOriginSuggestions(await res.json());
        } catch (err) {
          console.error(err);
        }
      } else setOriginSuggestions([]);
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [origin, isTypingOrigin]);

  // Debounced Autocomplete (Destination)
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (destination.length > 2 && isTypingDest) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${destination}&format=json&limit=5`,
          );
          setDestSuggestions(await res.json());
        } catch (err) {
          console.error(err);
        }
      } else setDestSuggestions([]);
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [destination, isTypingDest]);

  const handleOriginSelect = (cityName: string) => {
    setOrigin(cityName.split(",")[0]);
    setIsTypingOrigin(false);
    setOriginSuggestions([]);
  };
  const handleDestSelect = (cityName: string) => {
    setDestination(cityName.split(",")[0]);
    setIsTypingDest(false);
    setDestSuggestions([]);
  };

  const handleCalculatePrice = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!origin || !destination || !weight)
      return alert("Fill in Origin, Destination, and Weight first!");
    try {
      const response = await fetch("http://localhost:5000/api/price-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originCity: origin,
          destCity: destination,
          weight: Number(weight),
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setEstimatedPrice(data.price);
        setDistance(data.distance);
      } else alert("Could not calculate price.");
    } catch (error) {
      console.error(error);
    }
  };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const payload = {
        origin,
        destination,
        weight_kg: Number(weight),
        length_cm: Number(length),
        width_cm: Number(width),
        height_cm: Number(height),
        packaging_type: packagingType,
        is_fragile: isFragile,
        is_hazmat: isHazmat,
        requires_refrigeration: requiresRefrigeration,
        pickup_window_start: pickupStart || null,
        pickup_window_end: pickupEnd || null,
        delivery_window_start: deliveryStart || null,
        delivery_window_end: deliveryEnd || null,
        requires_liftgate: requiresLiftgate,
        requires_loading_dock: requiresLoadingDock,
        special_instructions: specialInstructions,
      };

      const response = await fetch("http://localhost:5000/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert(`Success! Professional Cargo Manifest posted.`);
        window.location.reload();
      } else {
        alert("Failed to post the shipment.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAcceptBid = async (bidId: number) => {
    if (!confirm("Are you sure you want to accept this bid?")) return;
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `http://localhost:5000/api/bids/${bidId}/accept`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        alert("Bid accepted!");
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-extrabold text-blue-600 tracking-tight">
              LogiMatch
            </h1>
            <div className="flex gap-3 ml-4 border-l pl-6 border-gray-200">
              <button
                onClick={() => setIsPostModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors text-sm"
              >
                <span>➕</span> Post a Job
              </button>
              <button
                onClick={() => setIsHistoryModalOpen(true)}
                className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-bold py-2 px-4 rounded-lg border border-gray-300 transition-colors text-sm"
              >
                <span>📜</span> Job History
              </button>
            </div>
          </div>
          <Link
            href="/profile"
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors bg-gray-100 px-4 py-2 rounded-full font-medium"
          >
            <span className="text-lg">👤</span> My Profile
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Live Open Market
        </h2>
        <div className="flex flex-col gap-5">
          {isLoading ? (
            <p className="text-gray-500 animate-pulse font-medium">
              Loading market data...
            </p>
          ) : jobs.length === 0 ? (
            <p className="text-center py-12 text-gray-500">No open jobs.</p>
          ) : (
            jobs.map((job: any) => (
              <JobCard key={job.id} job={job} currentUserId={currentUserId} />
            ))
          )}
        </div>
      </div>

      {/* --- MODAL 1: POST A NEW SHIPMENT (EXPANDED MANIFEST) --- */}
      {isPostModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-100">
            <div className="flex justify-between items-center mb-6 border-b pb-3">
              <h3 className="text-2xl font-bold text-gray-900">
                Post a Professional Shipment Manifest
              </h3>
              <button
                onClick={() => setIsPostModalOpen(false)}
                className="text-gray-400 hover:text-red-500 font-bold text-3xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handlePostJob} className="space-y-8">
              {/* Section 1: Core Logistics */}
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">
                  1. Route & Weight
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Origin City
                    </label>
                    <input
                      type="text"
                      value={origin}
                      placeholder="Type origin location..."
                      onChange={(e) => {
                        setOrigin(e.target.value);
                        setIsTypingOrigin(true);
                      }}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    />
                    {originSuggestions.length > 0 && (
                      <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {originSuggestions.map((city: any, i: number) => (
                          <li
                            key={i}
                            onClick={() =>
                              handleOriginSelect(city.display_name)
                            }
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-900 border-b border-gray-100 last:border-0 font-medium"
                          >
                            {city.display_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Destination City
                    </label>
                    <input
                      type="text"
                      value={destination}
                      placeholder="Type destination location..."
                      onChange={(e) => {
                        setDestination(e.target.value);
                        setIsTypingDest(true);
                      }}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    />
                    {destSuggestions.length > 0 && (
                      <ul className="absolute z-20 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {destSuggestions.map((city: any, i: number) => (
                          <li
                            key={i}
                            onClick={() => handleDestSelect(city.display_name)}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-900 border-b border-gray-100 last:border-0 font-medium"
                          >
                            {city.display_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Total Weight (KG)
                    </label>
                    <input
                      type="number"
                      value={weight}
                      placeholder="e.g., 1500"
                      onChange={(e) => setWeight(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Dimensions & Type */}
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">
                  2. Cargo Specifications
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Length (cm)
                    </label>
                    <input
                      type="number"
                      value={length}
                      placeholder="Length"
                      onChange={(e) => setLength(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Width (cm)
                    </label>
                    <input
                      type="number"
                      value={width}
                      placeholder="Width"
                      onChange={(e) => setWidth(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      value={height}
                      placeholder="Height"
                      onChange={(e) => setHeight(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Packaging
                    </label>
                    <select
                      value={packagingType}
                      onChange={(e) => setPackagingType(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none font-medium cursor-pointer"
                    >
                      <option className="text-gray-950">Palletized</option>
                      <option className="text-gray-950">Crates</option>
                      <option className="text-gray-950">Loose Boxes</option>
                      <option className="text-gray-950">Liquid Bulk</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-red-700 select-none">
                    <input
                      type="checkbox"
                      checked={isHazmat}
                      onChange={(e) => setIsHazmat(e.target.checked)}
                      className="w-4 h-4 accent-red-600"
                    />{" "}
                    ☣️ Contains HAZMAT
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-cyan-700 select-none">
                    <input
                      type="checkbox"
                      checked={requiresRefrigeration}
                      onChange={(e) =>
                        setRequiresRefrigeration(e.target.checked)
                      }
                      className="w-4 h-4 accent-cyan-600"
                    />{" "}
                    ❄️ Requires Reefer
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-orange-700 select-none">
                    <input
                      type="checkbox"
                      checked={isFragile}
                      onChange={(e) => setIsFragile(e.target.checked)}
                      className="w-4 h-4 accent-orange-600"
                    />{" "}
                    📦 Fragile Goods
                  </label>
                </div>
              </div>

              {/* Section 3: Scheduling & Equipment */}
              <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">
                  3. Scheduling & Operations
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-3">
                    <h5 className="text-sm font-bold text-gray-600 uppercase tracking-wide border-l-2 border-gray-400 pl-2">
                      Pickup Window
                    </h5>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Earliest
                      </label>
                      <input
                        type="datetime-local"
                        value={pickupStart}
                        onChange={(e) => setPickupStart(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Latest
                      </label>
                      <input
                        type="datetime-local"
                        value={pickupEnd}
                        onChange={(e) => setPickupEnd(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h5 className="text-sm font-bold text-gray-600 uppercase tracking-wide border-l-2 border-gray-400 pl-2">
                      Delivery Window
                    </h5>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Earliest
                      </label>
                      <input
                        type="datetime-local"
                        value={deliveryStart}
                        onChange={(e) => setDeliveryStart(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Latest
                      </label>
                      <input
                        type="datetime-local"
                        value={deliveryEnd}
                        onChange={(e) => setDeliveryEnd(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-white text-gray-950 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-200 pt-4">
                  <div className="flex flex-col gap-3">
                    <h5 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-1">
                      Site Equipment
                    </h5>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-800 select-none">
                      <input
                        type="checkbox"
                        checked={requiresLiftgate}
                        onChange={(e) => setRequiresLiftgate(e.target.checked)}
                        className="w-4 h-4 accent-blue-600"
                      />{" "}
                      Truck Needs Liftgate
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-800 select-none">
                      <input
                        type="checkbox"
                        checked={requiresLoadingDock}
                        onChange={(e) =>
                          setRequiresLoadingDock(e.target.checked)
                        }
                        className="w-4 h-4 accent-blue-600"
                      />{" "}
                      Site has Loading Dock
                    </label>
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-gray-600 uppercase mb-2 tracking-wide">
                      Driver Instructions
                    </h5>
                    <textarea
                      rows={3}
                      placeholder="Gate codes, warehouse contact details, loading instructions..."
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-950 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm resize-none shadow-xs"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Pricing & Submit */}
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-inner flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="w-full md:w-1/2">
                  {estimatedPrice ? (
                    <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-center shadow-xs animate-fade-in">
                      <p className="text-xs text-green-700 font-semibold mb-1">
                        Route Distance: {distance} km
                      </p>
                      <h4 className="text-lg font-extrabold text-green-800">
                        Recommended Budget: ₹{estimatedPrice}
                      </h4>
                    </div>
                  ) : (
                    <button
                      onClick={handleCalculatePrice}
                      className="w-full bg-gray-100 text-gray-800 font-bold py-3 px-4 rounded-md hover:bg-gray-200 border border-gray-300 transition-colors shadow-xs cursor-pointer text-sm"
                    >
                      Calculate Fair Market Price
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full md:w-1/2 bg-blue-600 text-white font-bold py-4 px-6 rounded-md hover:bg-blue-700 transition-colors shadow-md text-lg cursor-pointer"
                >
                  Submit Manifest to Market
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: JOB HISTORY */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-100">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-xl font-bold text-gray-900">
                My Job Posting History
              </h3>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-gray-400 hover:text-red-500 font-bold text-2xl cursor-pointer"
              >
                &times;
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-grow space-y-6 bg-white">
              {myHistory.length === 0 ? (
                <p className="text-center text-gray-500 py-8 font-medium">
                  No jobs posted yet.
                </p>
              ) : (
                myHistory.map((job: any) => (
                  <div
                    key={job.id}
                    className="border border-gray-200 bg-white rounded-xl shadow-xs overflow-hidden"
                  >
                    <div className="bg-gray-50 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-lg text-gray-900">
                          {job.origin} ➔ {job.destination}
                        </h4>
                        <p className="text-xs text-gray-500 font-medium">
                          Weight: {job.weight_kg}kg
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded uppercase ${job.status === "open" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}
                      >
                        {job.status}
                      </span>
                    </div>
                    <div className="p-4 bg-white">
                      <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Bids ({job.bids.length})
                      </h5>
                      {job.bids.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">
                          No bids received yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {job.bids.map((bid: any) => (
                            <div
                              key={bid.bid_id}
                              className={`flex justify-between items-center p-3 rounded-lg border ${bid.status === "accepted" ? "bg-green-50 border-green-200" : "bg-white border-gray-100"}`}
                            >
                              <div>
                                <p className="font-bold text-sm text-gray-900">
                                  {bid.provider_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {bid.provider_email}
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-lg font-extrabold text-green-600">
                                  ₹{bid.amount}
                                </span>
                                {job.status === "open" && (
                                  <button
                                    onClick={() => handleAcceptBid(bid.bid_id)}
                                    className="bg-green-600 text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-green-700 shadow-xs cursor-pointer"
                                  >
                                    Accept
                                  </button>
                                )}
                                {bid.status === "accepted" && (
                                  <span className="bg-green-200 text-green-800 text-xs font-bold px-2 py-1 rounded">
                                    WINNER
                                  </span>
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
          </div>
        </div>
      )}
    </div>
  );
}