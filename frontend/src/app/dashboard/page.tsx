"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { apiUrl, waitForBackend } from "@/lib/api";

// ==========================================
// 1. THE JOB CARD COMPONENT
// ==========================================
function JobCard({
  job,
  currentUserId,
  currentUserRole,
}: {
  job: any;
  currentUserId: string | null;
  currentUserRole: string | null;
}) {
  const [bidAmount, setBidAmount] = useState("");
  const [showSeekerProfile, setShowSeekerProfile] = useState(false);
  const [showManifest, setShowManifest] = useState(false);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const [bidFeedback, setBidFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const numericBidAmount = Number(bidAmount);

  const openBidConfirmation = () => {
    setBidFeedback(null);
    if (!Number.isFinite(numericBidAmount) || numericBidAmount <= 0) {
      setBidFeedback({
        type: "error",
        message: "Enter a valid bid amount greater than zero.",
      });
      return;
    }
    setIsBidModalOpen(true);
  };

  const handleBidSubmit = async () => {
    if (isSubmittingBid) return;
    setIsSubmittingBid(true);
    setBidFeedback(null);

    try {
      const response = await fetch(apiUrl("/api/bids"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ job_id: job.id, amount: bidAmount }),
      });

      if (response.status === 401) {
        alert("Session expired. Please log in again.");
        window.location.href = "/login";
        return;
      }

      const data = await response.json();
      if (response.ok) {
        setBidFeedback({
          type: "success",
          message: `Bid of ₹${numericBidAmount.toLocaleString("en-IN")} submitted successfully.`,
        });
        setBidAmount("");
      } else {
        setBidFeedback({
          type: "error",
          message: data.error || "The bid could not be submitted. Please try again.",
        });
      }
    } catch {
      setBidFeedback({
        type: "error",
        message: "The service could not be reached. Please try again.",
      });
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const isMyJob = currentUserId === String(job.seeker_id);
  const canBid = currentUserRole === "driver" && !isMyJob;

  const renderStars = (sum: number, count: number) => {
    const avg = count > 0 ? Math.round(sum / count) : 0;
    return "⭐".repeat(avg) + "☆".repeat(5 - avg);
  };

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
      {/* Top Right Action Buttons */}
      <div className="mb-4 flex flex-wrap justify-end gap-2 sm:absolute sm:top-6 sm:right-6 sm:mb-0">
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

      {/* Main Header */}
      <div className="border-b border-gray-100 pb-4 mb-4">
        <h3 className="text-xl font-bold text-gray-900 flex flex-wrap items-center gap-3 sm:pr-48">
          {job.origin.split(",")[0]}{" "}
          <span className="text-gray-400 text-sm">➔</span>{" "}
          {job.destination.split(",")[0]}
        </h3>

        {/* Badges & Seeker Ask */}
        <div className="mt-3 flex flex-wrap gap-2 text-sm items-center">
          <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold">
            ⚖️ {job.weight_kg} kg
          </span>
          <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-bold">
            🎯 Target Budget:{" "}
            {job.seeker_ask ? `₹${job.seeker_ask}` : "Open to Offers"}
          </span>
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

      {/* Expanded Seeker Profile */}
      {showSeekerProfile && (
        <div className="mb-5 p-4 bg-gray-50 rounded-lg border border-gray-200 flex gap-4 items-center">
          <div className="w-14 h-14 rounded-full bg-gray-300 flex-shrink-0 overflow-hidden shadow-sm border border-gray-200">
            {job.seeker_photo ? (
              <img
                src={job.seeker_photo}
                className="w-full h-full object-cover"
                alt="Seeker"
              />
            ) : (
              <span className="flex items-center justify-center w-full h-full text-2xl text-gray-600">
                👤
              </span>
            )}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">
              {job.seeker_name || "Verified Seeker"}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              {job.seeker_bio || "This user hasn't added a bio yet."}
            </p>
          </div>
        </div>
      )}

      {/* Expanded Cargo Manifest */}
      {showManifest && (
        <div className="mb-5 p-5 bg-blue-50/30 rounded-lg border border-blue-100 text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-bold text-gray-800 mb-2 border-b border-blue-200 pb-1">
              Cargo Details
            </h4>
            <p className="text-gray-700">
              <span className="font-semibold text-gray-900">Dimensions: </span>
              {job.length_cm || job.length || "-"}L x{" "}
              {job.width_cm || job.width || "-"}W x{" "}
              {job.height_cm || job.height || "-"}H cm
            </p>
            <p className="text-gray-700">
              <span className="font-semibold text-gray-900">Packaging: </span>
              {job.packaging_type || "Unspecified"}
            </p>
          </div>
          <div>
            <h4 className="font-bold text-gray-800 mb-2 border-b border-blue-200 pb-1">
              Scheduling Windows
            </h4>
            <p className="text-gray-700">
              <span className="font-semibold text-gray-900">Pickup: </span>
              {formatDate(job.pickup_window_start)} to{" "}
              {formatDate(job.pickup_window_end)}
            </p>
            <p className="text-gray-700">
              <span className="font-semibold text-gray-900">Delivery: </span>
              {formatDate(job.delivery_window_start)} to{" "}
              {formatDate(job.delivery_window_end)}
            </p>
          </div>
          <div className="md:col-span-2">
            <h4 className="font-bold text-gray-800 mb-2 border-b border-blue-200 pb-1">
              Equipment & Instructions
            </h4>
            <p className="text-gray-700 mb-2">
              <span className="font-semibold text-gray-900">Requires: </span>
              {job.requires_liftgate ? " Liftgate " : ""}
              {job.requires_loading_dock ? " Loading Dock " : ""}
              {!job.requires_liftgate && !job.requires_loading_dock
                ? " Standard Loading"
                : ""}
            </p>
            <p className="text-gray-700 font-medium italic mt-2 bg-white p-3 rounded-lg border border-blue-100">
              "{job.special_instructions || "No special instructions provided."}
              "
            </p>
          </div>
        </div>
      )}

      {/* Live Auction Board */}
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
                  className={`flex items-center text-sm p-3 rounded-lg ${isMyBid ? "bg-blue-100 border border-blue-200" : "bg-white border border-gray-200 shadow-sm"}`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 mr-3 overflow-hidden flex-shrink-0">
                    {bid.provider_photo ? (
                      <img
                        src={bid.provider_photo}
                        className="w-full h-full object-cover"
                        alt={`${bid.provider_name} profile`}
                      />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full text-sm">
                        👤
                      </span>
                    )}
                  </div>
                  <div className="flex-grow">
                    <p className="font-bold text-gray-900">
                      {index === 0 ? "🏆 " : ""}
                      {bid.provider_name}{" "}
                      {isMyBid && (
                        <span className="text-blue-600 font-bold">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-yellow-600 font-bold tracking-widest">
                      {renderStars(bid.rating_sum, bid.rating_count)}
                    </p>
                  </div>
                  <span
                    className={`text-lg font-black ${index === 0 ? "text-green-600" : "text-gray-600"}`}
                  >
                    ₹{bid.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bidding Input Section */}
      {isMyJob ? (
        <div className="text-center py-3 bg-gray-100 rounded-lg text-gray-500 text-sm font-bold border border-gray-200">
          This is your cargo. Go to Job History to accept bids.
        </div>
      ) : !canBid ? (
        <div className="text-center py-3 bg-gray-100 rounded-lg text-gray-500 text-sm font-bold border border-gray-200">
          Provider accounts can submit bids on open jobs.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-grow">
            <span className="absolute left-3 top-2.5 text-gray-500 font-bold">
              ₹
            </span>
            <input
              type="number"
              placeholder="Enter your competitive bid"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              min="0.01"
              step="0.01"
              className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
            />
          </div>
          <button
            onClick={openBidConfirmation}
            className="w-full whitespace-nowrap bg-gray-900 text-white font-black py-2.5 px-6 rounded-lg hover:bg-black shadow-md transition-colors sm:w-auto"
          >
            Submit Bid
          </button>
          </div>
          {bidFeedback?.type === "error" && !isBidModalOpen && (
            <p className="text-sm font-bold text-red-700" role="alert">
              {bidFeedback.message}
            </p>
          )}
        </div>
      )}

      {isBidModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`bid-confirmation-${job.id}`}
          data-testid="bid-confirmation-modal"
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-2xl sm:p-6">
            {bidFeedback?.type === "success" ? (
              <div className="space-y-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
                  ✓
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">Bid submitted</h3>
                  <p className="mt-2 text-sm font-medium text-gray-600" role="status">
                    {bidFeedback.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="w-full rounded-lg bg-gray-900 px-4 py-3 font-black text-white hover:bg-black"
                >
                  Return to Market
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-blue-700">
                    Confirm provider bid
                  </p>
                  <h3
                    id={`bid-confirmation-${job.id}`}
                    className="mt-2 text-xl font-black text-gray-900"
                  >
                    {job.origin.split(",")[0]} to {job.destination.split(",")[0]}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-gray-500">Job #{job.id}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-blue-700">
                    Your bid
                  </p>
                  <p className="mt-1 text-3xl font-black text-gray-900">
                    ₹{numericBidAmount.toLocaleString("en-IN")}
                  </p>
                </div>
                <p className="text-sm font-medium text-gray-600">
                  Review the route and amount before sending this bid to the seeker.
                </p>
                {bidFeedback?.type === "error" && (
                  <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">
                    {bidFeedback.message}
                  </p>
                )}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setIsBidModalOpen(false)}
                    disabled={isSubmittingBid}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 font-bold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel / Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleBidSubmit}
                    disabled={isSubmittingBid}
                    className="rounded-lg bg-blue-600 px-5 py-2.5 font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    data-testid="confirm-bid-button"
                  >
                    {isSubmittingBid ? "Submitting..." : "Confirm Bid"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. THE MAIN DASHBOARD PAGE
// ==========================================
export default function UnifiedDashboardPage() {
  const [jobs, setJobs] = useState([]);
  const [myHistory, setMyHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState(
    "Connecting to LogiMatch...",
  );
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Search & Filter States
  const [searchOrigin, setSearchOrigin] = useState("");
  const [searchDest, setSearchDest] = useState("");
  const [filterHazmat, setFilterHazmat] = useState(false);
  const [filterReefer, setFilterReefer] = useState(false);
  const [filterFragile, setFilterFragile] = useState(false);

  // Form States (Professional Manifest)
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [weight, setWeight] = useState("");
  const [seekerAsk, setSeekerAsk] = useState("");

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

  const [pricingBreakdown, setPricingBreakdown] = useState<any>(null);

  // Autocomplete States
  const [originSuggestions, setOriginSuggestions] = useState<any[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [isTypingOrigin, setIsTypingOrigin] = useState(false);
  const [isTypingDest, setIsTypingDest] = useState(false);

  useEffect(() => {
    setCurrentUserId(localStorage.getItem("userId"));
    setCurrentUserRole(localStorage.getItem("userRole"));

    const fetchData = async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
        await waitForBackend({
          onAttempt: (attempt) =>
            setConnectionMessage(
              attempt === 1
                ? "Connecting to LogiMatch..."
                : "The backend is waking up. Retrying...",
            ),
        });

        const headers = {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        };

        const jobsRes = await fetch(apiUrl("/api/jobs"));
        if (!jobsRes.ok) throw new Error("MARKET_LOAD_FAILED");
        setJobs(await jobsRes.json());

        if (localStorage.getItem("token")) {
          const historyRes = await fetch(
            apiUrl("/api/profile/my-jobs"),
            { headers },
          );
          if (historyRes.ok) {
            setMyHistory(await historyRes.json());
          }
        }
      } catch {
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [loadAttempt]);

  const isSeeker = currentUserRole === "seeker";

  // Debounced Autocomplete (Origin)
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (origin.length > 2 && isTypingOrigin) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${origin},India&format=json&limit=5`,
          );
          setOriginSuggestions(await res.json());
        } catch (err) {
          console.error(err);
        }
      } else {
        setOriginSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [origin, isTypingOrigin]);

  // Debounced Autocomplete (Destination)
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (destination.length > 2 && isTypingDest) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${destination},India&format=json&limit=5`,
          );
          setDestSuggestions(await res.json());
        } catch (err) {
          console.error(err);
        }
      } else {
        setDestSuggestions([]);
      }
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

  const optionalNumber = (value: string) => {
    const parsed = Number(value);
    return value.trim() === "" || !Number.isFinite(parsed) ? null : parsed;
  };

  // Recommended-price estimator
  const handleCalculatePrice = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!origin || !destination || !weight) {
      return alert("Fill in Origin, Destination, and Weight first!");
    }
    setIsTypingOrigin(false);
    setIsTypingDest(false);
    setOriginSuggestions([]);
    setDestSuggestions([]);

    try {
      const response = await fetch(apiUrl("/api/price-estimate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originCity: origin,
          destCity: destination,
          weight: Number(weight),
          length_cm: optionalNumber(length),
          width_cm: optionalNumber(width),
          height_cm: optionalNumber(height),
          packaging_type: packagingType,
          is_fragile: isFragile,
          is_hazmat: isHazmat,
          requires_refrigeration: requiresRefrigeration,
          requires_liftgate: requiresLiftgate,
          requires_loading_dock: requiresLoadingDock,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setPricingBreakdown(data);
        setSeekerAsk(data.price.toString());
      } else {
        alert("Could not calculate price. Ensure cities are valid.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handlePostJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        origin,
        destination,
        weight_kg: Number(weight),
        seeker_ask: Number(seekerAsk),
        length_cm: optionalNumber(length),
        width_cm: optionalNumber(width),
        height_cm: optionalNumber(height),
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

      const response = await fetch(apiUrl("/api/jobs"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert(`Success! Professional Cargo Manifest posted to the market.`);
        window.location.reload();
      } else {
        alert("Failed to post the shipment.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleAcceptBid = async (bidId: number) => {
    if (!confirm("Are you sure you want to officially accept this bid?"))
      return;
    try {
      const response = await fetch(
        apiUrl(`/api/bids/${bidId}/accept`),
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );

      if (response.ok) {
        alert("Bid accepted! Job assigned.");
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Live Market Filter Logic
  const filteredJobs = jobs.filter((job: any) => {
    const matchesOrigin = job.origin
      .toLowerCase()
      .includes(searchOrigin.toLowerCase());
    const matchesDest = job.destination
      .toLowerCase()
      .includes(searchDest.toLowerCase());
    const matchesHazmat = filterHazmat ? job.is_hazmat : true;
    const matchesReefer = filterReefer ? job.requires_refrigeration : true;
    const matchesFragile = filterFragile ? job.is_fragile : true;

    return (
      matchesOrigin &&
      matchesDest &&
      matchesHazmat &&
      matchesReefer &&
      matchesFragile
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 pb-20 font-sans">
      {/* ============================== */}
      {/* Top Navigation               */}
      {/* ============================== */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-extrabold text-blue-600 tracking-tight">
              LogiMatch
            </h1>
            {isSeeker && (
              <div className="hidden sm:flex gap-3 ml-4 border-l pl-6 border-gray-200">
              <button
                onClick={() => setIsPostModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-sm hover:bg-blue-700 transition-colors text-sm"
              >
                ➕ Post a Job
              </button>
              <button
                onClick={() => setIsHistoryModalOpen(true)}
                className="flex items-center gap-2 bg-white text-gray-700 font-bold py-2 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm"
              >
                📜 Job History
              </button>
              </div>
            )}
          </div>
          <Link
            href="/profile"
            className="flex items-center gap-2 text-gray-700 bg-gray-100 border border-gray-200 px-4 py-2 rounded-full font-bold hover:bg-gray-200 transition-colors"
          >
            👤 My Profile
          </Link>
        </div>
        {isSeeker && (
          <div className="sm:hidden border-t border-gray-100 px-4 py-3 flex gap-3">
            <button
              onClick={() => setIsPostModalOpen(true)}
              className="flex-1 bg-blue-600 text-white font-bold py-2 px-3 rounded-lg shadow-sm hover:bg-blue-700 transition-colors text-sm"
            >
              Post Job
            </button>
            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="flex-1 bg-white text-gray-700 font-bold py-2 px-3 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm"
            >
              History
            </button>
          </div>
        )}
      </nav>

      {/* ============================== */}
      {/* Search & Filter Engine       */}
      {/* ============================== */}
      <div className="bg-white border-b border-gray-200 py-4 shadow-sm mb-8 z-10 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative w-full sm:w-48">
              <span className="absolute left-3 top-2.5 text-gray-400">📍</span>
              <input
                type="text"
                placeholder="Origin..."
                value={searchOrigin}
                onChange={(e) => setSearchOrigin(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 font-medium w-full text-sm"
              />
            </div>
            <div className="relative w-full sm:w-48">
              <span className="absolute left-3 top-2.5 text-gray-400">🏁</span>
              <input
                type="text"
                placeholder="Destination..."
                value={searchDest}
                onChange={(e) => setSearchDest(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500 font-medium w-full text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <span className="font-bold text-gray-500 text-xs uppercase tracking-wider hidden md:inline">
              Requirements:
            </span>

            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-sm text-red-700 bg-red-50 px-3 py-1.5 rounded-md border border-red-100 select-none hover:bg-red-100 transition-colors">
              <input
                type="checkbox"
                checked={filterHazmat}
                onChange={(e) => setFilterHazmat(e.target.checked)}
                className="accent-red-600 w-4 h-4"
              />
              ☣️ Hazmat
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-sm text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-md border border-cyan-100 select-none hover:bg-cyan-100 transition-colors">
              <input
                type="checkbox"
                checked={filterReefer}
                onChange={(e) => setFilterReefer(e.target.checked)}
                className="accent-cyan-600 w-4 h-4"
              />
              ❄️ Reefer
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-sm text-orange-700 bg-orange-50 px-3 py-1.5 rounded-md border border-orange-100 select-none hover:bg-orange-100 transition-colors">
              <input
                type="checkbox"
                checked={filterFragile}
                onChange={(e) => setFilterFragile(e.target.checked)}
                className="accent-orange-600 w-4 h-4"
              />
              📦 Fragile
            </label>
          </div>
        </div>
      </div>

      {/* ============================== */}
      {/* Main Market Board            */}
      {/* ============================== */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center justify-between">
          Live Open Market
          <span className="text-sm font-medium text-gray-500 bg-gray-200 px-3 py-1 rounded-full">
            {filteredJobs.length} Jobs Found
          </span>
        </h2>

        <div className="flex flex-col gap-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-14 text-center" role="status">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
              <p className="mt-4 text-base font-bold text-gray-600">
                {connectionMessage}
              </p>
              <p className="mt-1 text-sm font-medium text-gray-400">
                Free hosting can take a little longer after inactivity.
              </p>
            </div>
          ) : loadError ? (
            <div className="rounded-lg border border-red-200 bg-white px-5 py-10 text-center">
              <h3 className="text-lg font-black text-gray-900">Could not reach the service</h3>
              <p className="mt-2 text-sm font-medium text-gray-600">
                Check your connection and try again. Your account data has not been changed.
              </p>
              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 font-black text-white hover:bg-blue-700"
              >
                Retry Connection
              </button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
              <span className="text-4xl block mb-3">🏜️</span>
              <p className="text-gray-500 font-bold text-lg">
                No jobs match your exact filters.
              </p>
              <button
                onClick={() => {
                  setSearchOrigin("");
                  setSearchDest("");
                  setFilterHazmat(false);
                  setFilterReefer(false);
                  setFilterFragile(false);
                }}
                className="mt-4 text-blue-600 font-bold hover:text-blue-800 transition-colors"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            filteredJobs.map((job: any) => (
              <JobCard
                key={job.id}
                job={job}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
              />
            ))
          )}
        </div>
      </div>

      {/* ============================== */}
      {/* MODAL 1: POST A NEW SHIPMENT */}
      {/* ============================== */}
      {isPostModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
              <h3 className="text-2xl font-black text-gray-900">
                Post Professional Manifest
              </h3>
              <button
                onClick={() => setIsPostModalOpen(false)}
                className="text-gray-400 hover:text-red-500 font-bold text-3xl transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handlePostJob} className="space-y-6">
              {/* Route & Weight (With Dropdowns) */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="relative">
                  <label className="block text-sm font-extrabold text-gray-800 mb-2">
                    Origin City
                  </label>
                  <input
                    type="text"
                    value={origin}
                    placeholder="Type origin..."
                    onChange={(e) => {
                      setOrigin(e.target.value);
                      setIsTypingOrigin(true);
                    }}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                  {originSuggestions.length > 0 && (
                    <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                      {originSuggestions.map((city: any, i: number) => (
                        <li
                          key={i}
                          onClick={() => handleOriginSelect(city.display_name)}
                          className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm text-gray-900 border-b border-gray-100 last:border-0 font-medium transition-colors"
                        >
                          {city.display_name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-sm font-extrabold text-gray-800 mb-2">
                    Destination City
                  </label>
                  <input
                    type="text"
                    value={destination}
                    placeholder="Type destination..."
                    onChange={(e) => {
                      setDestination(e.target.value);
                      setIsTypingDest(true);
                    }}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                  {destSuggestions.length > 0 && (
                    <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                      {destSuggestions.map((city: any, i: number) => (
                        <li
                          key={i}
                          onClick={() => handleDestSelect(city.display_name)}
                          className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm text-gray-900 border-b border-gray-100 last:border-0 font-medium transition-colors"
                        >
                          {city.display_name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-extrabold text-gray-800 mb-2">
                    Total Weight (KG)
                  </label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g., 2000"
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
              </div>

              {/* Cargo Specs */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Length (cm)
                    </label>
                    <input
                      type="number"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Width (cm)
                    </label>
                    <input
                      type="number"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Packaging
                    </label>
                    <select
                      value={packagingType}
                      onChange={(e) => setPackagingType(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md font-medium bg-white text-gray-900 outline-none"
                    >
                      <option>Palletized</option>
                      <option>Boxed</option>
                      <option>Crated</option>
                      <option>Drums</option>
                      <option>Loose</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 pt-4 border-t border-gray-200">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-red-700">
                    <input
                      type="checkbox"
                      checked={isHazmat}
                      onChange={(e) => setIsHazmat(e.target.checked)}
                      className="w-5 h-5 accent-red-600"
                    />
                    ☣️ HAZMAT
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-cyan-700">
                    <input
                      type="checkbox"
                      checked={requiresRefrigeration}
                      onChange={(e) =>
                        setRequiresRefrigeration(e.target.checked)
                      }
                      className="w-5 h-5 accent-cyan-600"
                    />
                    ❄️ Reefer Required
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-orange-700">
                    <input
                      type="checkbox"
                      checked={isFragile}
                      onChange={(e) => setIsFragile(e.target.checked)}
                      className="w-5 h-5 accent-orange-600"
                    />
                    📦 Fragile
                  </label>
                </div>
              </div>

              {/* RESTORED: Scheduling Windows */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/40 p-5 rounded-xl border border-blue-100">
                <div>
                  <label className="block text-sm font-bold text-blue-900 mb-2">
                    ⏰ Pickup Window Target
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="datetime-local"
                      onChange={(e) => setPickupStart(e.target.value)}
                      className="border border-blue-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    />
                    <input
                      type="datetime-local"
                      onChange={(e) => setPickupEnd(e.target.value)}
                      className="border border-blue-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-blue-900 mb-2">
                    ⏰ Delivery Window Target
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="datetime-local"
                      onChange={(e) => setDeliveryStart(e.target.value)}
                      className="border border-blue-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    />
                    <input
                      type="datetime-local"
                      onChange={(e) => setDeliveryEnd(e.target.value)}
                      className="border border-blue-200 p-2.5 rounded-lg text-xs bg-white text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Equipment & Details */}
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                  <label className="flex items-center gap-3 cursor-pointer font-bold text-gray-800">
                    <input
                      type="checkbox"
                      checked={requiresLiftgate}
                      onChange={(e) => setRequiresLiftgate(e.target.checked)}
                      className="w-5 h-5 accent-gray-900"
                    />
                    Requires Liftgate
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer font-bold text-gray-800">
                    <input
                      type="checkbox"
                      checked={requiresLoadingDock}
                      onChange={(e) => setRequiresLoadingDock(e.target.checked)}
                      className="w-5 h-5 accent-gray-900"
                    />
                    Site has Loading Dock
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Driver Instructions
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Gate codes, special routes..."
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md font-medium text-sm resize-none"
                  ></textarea>
                </div>
              </div>

              {/* Advanced Pricing Engine Box */}
              <div className="bg-white p-6 rounded-xl border-2 border-blue-200 shadow-sm flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 gap-4">
                  <div>
                    <h4 className="font-black text-xl text-gray-900">
                      Budget Setup
                    </h4>
                    <p className="text-sm text-gray-500 font-medium mt-1">
                      Use the cost model to calculate a recommended India-wide rate.
                    </p>
                  </div>
                  <button
                    onClick={handleCalculatePrice}
                    className="bg-gray-900 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-black shadow-md transition-all whitespace-nowrap"
                  >
                    Calculate Fair Price 🧮
                  </button>
                </div>

                {pricingBreakdown && (
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-inner space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                          Conservative
                        </p>
                        <p className="font-black text-xl text-blue-900">
                          ₹{pricingBreakdown.recommendedRange?.low}
                        </p>
                      </div>
                      <div className="border-y sm:border-y-0 sm:border-x border-blue-200 py-3 sm:py-0">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                          Fair Ask
                        </p>
                        <p className="font-black text-2xl text-green-700">
                          ₹{pricingBreakdown.recommendedRange?.fair}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                          Upper Range
                        </p>
                        <p className="font-black text-xl text-blue-900">
                          ₹{pricingBreakdown.recommendedRange?.high}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center bg-white rounded-lg border border-blue-100 p-3">
                      <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                        Distance
                      </p>
                      <p className="font-black text-xl text-blue-900">
                        {pricingBreakdown.distance} km
                      </p>
                      </div>
                      <div className="border-l border-r border-blue-100">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                        Est. Time
                      </p>
                      <p className="font-black text-xl text-blue-900">
                        {pricingBreakdown.days} Days
                      </p>
                      </div>
                      <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                        Fleet
                      </p>
                      <p className="font-black text-xl text-blue-900">
                        {pricingBreakdown.numTrucks} Trucks
                      </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative mt-2">
                  <label className="block text-sm font-black text-green-800 mb-2 uppercase tracking-wide">
                    Your Target Budget (Seeker Ask)
                  </label>
                  <span className="absolute left-4 bottom-3 font-bold text-green-700 text-lg">
                    ₹
                  </span>
                  <input
                    type="number"
                    value={seekerAsk}
                    onChange={(e) => setSeekerAsk(e.target.value)}
                    placeholder="e.g., 25000"
                    required
                    className="w-full pl-9 pr-4 py-3 border-2 border-green-300 rounded-lg font-black text-xl text-green-900 bg-green-50 focus:ring-0 focus:border-green-600 outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl text-lg tracking-wide"
              >
                Publish Manifest to Live Market
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================== */}
      {/* Modal 2: History             */}
      {/* ============================== */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h3 className="text-2xl font-black text-gray-900">
                My Job Posting History
              </h3>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-gray-400 hover:text-red-500 font-bold text-3xl transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow space-y-6">
              {myHistory.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-gray-500 font-bold text-lg">
                    No jobs posted yet.
                  </p>
                </div>
              ) : (
                myHistory.map((job: any) => (
                  <div
                    key={job.id}
                    className="border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                  >
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-lg text-gray-900">
                          {job.origin.split(",")[0]} ➔{" "}
                          {job.destination.split(",")[0]}
                        </h4>
                      </div>
                      <span
                        className={`text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-wider ${job.status === "open" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}
                      >
                        {job.status}
                      </span>
                    </div>

                    <div className="p-5">
                      <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                        Received Bids ({job.bids.length})
                      </h5>
                      <div className="space-y-3">
                        {job.bids.length === 0 ? (
                          <p className="text-sm text-gray-400 font-medium italic">
                            Waiting for providers to bid...
                          </p>
                        ) : (
                          job.bids.map((bid: any) => (
                            <div
                              key={bid.bid_id}
                              className="flex justify-between items-center p-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                            >
                              <div>
                                <p className="font-bold text-gray-900">
                                  {bid.provider_name}
                                </p>
                                <p className="text-xs text-yellow-600 font-bold mt-1">
                                  ⭐{" "}
                                  {bid.rating_sum > 0
                                    ? (
                                        bid.rating_sum / bid.rating_count
                                      ).toFixed(1)
                                    : "New"}
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xl font-black text-green-600">
                                  ₹{bid.amount}
                                </span>
                                {job.status === "open" && (
                                  <button
                                    onClick={() => handleAcceptBid(bid.bid_id)}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 shadow-sm transition-colors"
                                  >
                                    Accept
                                  </button>
                                )}
                                {bid.status === "accepted" && (
                                  <span className="bg-green-100 border border-green-300 text-green-800 text-xs font-black px-3 py-1.5 rounded-full">
                                    WINNER
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
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
