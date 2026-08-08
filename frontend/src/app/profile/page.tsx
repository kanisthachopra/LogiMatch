"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { apiUrl, authHeaders, waitForBackend } from "@/lib/api";

// ==========================================
// 1. DRIVER TRACKING CARD COMPONENT
// ==========================================
function DriverTrackingCard({
  job,
  handleUpdateLocation,
  handleDownloadManifest,
  formatDate,
  currentUserId,
}: any) {
  const [locationText, setLocationText] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Debounced Autocomplete for Waypoint Updates
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (locationText.length > 2 && isTyping) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${locationText},India&format=json&limit=5`,
          );
          setSuggestions(await res.json());
        } catch (err) {
          console.error(err);
        }
      } else {
        setSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [locationText, isTyping]);

  const handleCitySelect = (cityName: string) => {
    setLocationText(cityName.split(",")[0]);
    setIsTyping(false);
    setSuggestions([]);
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-md border-l-8 overflow-hidden ${job.status === "delivered" ? "border-green-500" : "border-blue-500"}`}
    >
      <div className="p-6">
        <div className="flex flex-col md:flex-row justify-between border-b border-gray-100 pb-4 mb-4 gap-4">
          <div>
            <h4 className="text-2xl font-black text-gray-900">
              {job.origin.split(",")[0]} ➔ {job.destination.split(",")[0]}
            </h4>
            <p className="text-sm text-gray-600 font-bold mt-1">
              Client Contact: {job.seeker_name} ({job.seeker_email})
            </p>
          </div>
          <div className="text-left md:text-right">
            <span
              className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${job.status === "delivered" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}
            >
              {job.status}
            </span>
            <p className="text-2xl font-black text-green-600 mt-2">
              Payout: ₹{job.winning_bid}
            </p>
            <button
              onClick={() => handleDownloadManifest(job.job_id)}
              className="mt-3 bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-lg font-black text-xs transition-colors"
            >
              Download Manifest
            </button>
            <button
              onClick={() => setIsChatOpen((open) => !open)}
              className="mt-3 md:ml-2 bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-lg font-black text-xs transition-colors"
            >
              {isChatOpen ? "Hide Chat" : "Open Chat"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Schedule & Info */}
          <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 text-sm font-medium space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 uppercase tracking-widest text-xs font-bold mb-1">
                  Target Pickup
                </p>
                <p className="text-gray-900">
                  {formatDate(job.pickup_window_start)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 uppercase tracking-widest text-xs font-bold mb-1">
                  Target Delivery
                </p>
                <p className="text-gray-900">
                  {formatDate(job.delivery_window_start)}
                </p>
              </div>
            </div>
            <div className="border-t sm:border-t-0 sm:border-l sm:pl-4 border-gray-200">
              <span className="font-bold text-gray-500 uppercase block tracking-wider mb-0.5">
                Logged Manifest Timestamps
              </span>
              <p>
                🏭 Cargo Loaded At:{" "}
                <span className="font-bold text-blue-900">
                  {job.actual_pickup_time
                    ? formatDate(job.actual_pickup_time)
                    : "Not Configured Yet"}
                </span>
              </p>
              <p>
                🏁 Offloaded Arrived At:{" "}
                <span className="font-bold text-green-900">
                  {job.actual_delivery_time
                    ? formatDate(job.actual_delivery_time)
                    : "In Transit"}
                </span>
              </p>
            </div>
            <div className="border-t border-gray-200 pt-4">
              <p className="text-gray-500 uppercase tracking-widest text-xs font-bold mb-1">
                Special Instructions
              </p>
              <p className="text-gray-800 italic bg-white p-3 rounded border border-gray-100">
                "
                {job.special_instructions ||
                  "No special instructions provided."}
                "
              </p>
            </div>
          </div>

          {/* Provider shipment controls */}
          <div className="bg-blue-50 p-5 rounded-xl border-2 border-blue-200 shadow-inner flex flex-col justify-between">
            <div>
              <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-2 flex items-center gap-1">
                <span>📍</span> Update Shipment
              </p>
              <p className="font-black text-xl text-gray-900 mb-4 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                Current:{" "}
                <span className="text-blue-700">{job.current_location}</span>
              </p>
            </div>

            {job.status !== "delivered" && (
              <div className="flex flex-col gap-3">
                {job.status === "assigned" && (
                  <button
                    onClick={() =>
                      handleUpdateLocation(
                        job.job_id,
                        "Origin Dock - Loaded & Dispatched",
                        "picked_up",
                      )
                    }
                    className="w-full bg-blue-600 text-white font-black px-6 py-4 rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all text-lg transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    Confirm Cargo Picked Up 🏗️
                  </button>
                )}

                {job.status === "picked_up" && (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 relative">
                      <input
                        type="text"
                        value={locationText}
                        onChange={(e) => {
                          setLocationText(e.target.value);
                          setIsTyping(true);
                        }}
                        placeholder="Enter new waypoint city..."
                        className="w-full px-4 py-3 border border-blue-200 rounded-lg text-sm bg-white text-gray-900 font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                      />
                      {/* Autocomplete Dropdown Menu */}
                      {suggestions.length > 0 && (
                        <ul className="absolute top-full left-0 z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                          {suggestions.map((city: any, i: number) => (
                            <li
                              key={`city-${i}`}
                              onClick={() =>
                                handleCitySelect(city.display_name)
                              }
                              className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm text-gray-900 border-b border-gray-100 last:border-0 font-medium transition-colors"
                            >
                              {city.display_name}
                            </li>
                          ))}
                        </ul>
                      )}
                      <button
                        onClick={() => {
                          handleUpdateLocation(
                            job.job_id,
                            locationText,
                            "picked_up",
                          );
                          setLocationText("");
                        }}
                        className="w-full bg-blue-200 text-blue-900 font-black px-4 py-3 rounded-lg hover:bg-blue-300 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                      >
                        Update Location
                      </button>
                    </div>
                    <button
                      onClick={() =>
                        handleUpdateLocation(
                          job.job_id,
                          "Arrived at Destination Point",
                          "delivered",
                        )
                      }
                      className="w-full bg-green-600 text-white font-black px-6 py-4 rounded-xl shadow-lg hover:bg-green-700 hover:shadow-xl transition-all text-lg transform hover:-translate-y-0.5 cursor-pointer"
                    >
                      Mark Delivered ✅
                    </button>
                  </div>
                )}
              </div>
            )}

            {job.status === "delivered" && (
              <div className="bg-green-100 border border-green-300 rounded-lg p-4 text-center mt-auto">
                <p className="font-black text-green-800 text-lg">
                  Mission Accomplished 🏁
                </p>
                <p className="text-sm font-bold text-green-700 mt-1">
                  Timestamps successfully logged to system.
                </p>
              </div>
            )}
          </div>
        </div>

        {isChatOpen && (
          <div className="mt-6 border-t border-gray-100 pt-6">
            <JobChatThread jobId={job.job_id} currentUserId={currentUserId} />
          </div>
        )}
      </div>
    </div>
  );
}

function JobChatThread({ jobId, currentUserId }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatError, setChatError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const response = await fetch(apiUrl(`/api/jobs/${jobId}/messages`), {
          headers: authHeaders(),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not load chat.");
        }
        if (isMounted) {
          setMessages(data);
          setChatError("");
        }
      } catch (error: any) {
        if (isMounted) setChatError(error.message || "Could not load chat.");
      } finally {
        if (isMounted) setIsLoadingMessages(false);
      }
    };

    fetchMessages();
    const intervalId = window.setInterval(fetchMessages, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [jobId]);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedMessage = messageText.trim();
    if (!trimmedMessage || isSendingMessage) return;

    try {
      setIsSendingMessage(true);
      const response = await fetch(apiUrl(`/api/jobs/${jobId}/messages`), {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmedMessage }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Message could not be sent.");
      }
      setMessages((currentMessages) => [...currentMessages, data]);
      setMessageText("");
      setChatError("");
    } catch (error: any) {
      setChatError(error.message || "Message could not be sent.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="bg-white border border-blue-100 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-blue-800">
            Shipment Chat
          </p>
          <p className="text-xs font-bold text-blue-600">
            Visible only to the customer and accepted transporter.
          </p>
        </div>
        {isLoadingMessages && (
          <span className="text-xs font-bold text-blue-500">Refreshing...</span>
        )}
      </div>

      <div className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {chatError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm font-bold">
            {chatError}
          </div>
        )}
        {messages.length === 0 && !chatError ? (
          <div className="h-full flex items-center justify-center text-center">
            <p className="text-sm font-bold text-gray-500">
              No messages yet. Start the dispatch conversation here.
            </p>
          </div>
        ) : (
          messages.map((message: any) => {
            const isMine = Number(message.sender_id) === Number(currentUserId);
            return (
              <div
                key={message.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] rounded-xl px-4 py-3 shadow-sm ${isMine ? "bg-blue-600 text-white" : "bg-white text-gray-900 border border-gray-200"}`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span
                      className={`text-xs font-black uppercase tracking-widest ${isMine ? "text-blue-100" : "text-gray-500"}`}
                    >
                      {isMine ? "You" : message.sender_name}
                    </span>
                    <span
                      className={`text-[11px] font-bold ${isMine ? "text-blue-100" : "text-gray-400"}`}
                    >
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium whitespace-pre-wrap break-words">
                    {message.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-gray-100">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            maxLength={1000}
            placeholder="Type a dispatch update or question..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!messageText.trim() || isSendingMessage}
            className="bg-blue-600 disabled:bg-gray-300 text-white font-black px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isSendingMessage ? "Sending" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function StatCard({ label, value, tone = "blue" }: any) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 text-green-800 border-green-100"
      : tone === "yellow"
        ? "bg-yellow-50 text-yellow-800 border-yellow-100"
        : "bg-blue-50 text-blue-800 border-blue-100";

  return (
    <div className={`rounded-xl border p-5 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-widest opacity-75">
        {label}
      </p>
      <p className="text-3xl font-black mt-2">{value}</p>
    </div>
  );
}

function BarList({ title, rows, valueKey, labelKey = "count", money = false }: any) {
  const max = Math.max(
    1,
    ...rows.map((row: any) => Number(row[valueKey] || row[labelKey] || 0)),
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h4 className="text-lg font-black text-gray-900 mb-4">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm font-bold text-gray-500">No data yet.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row: any, index: number) => {
            const value = Number(row[valueKey] || row[labelKey] || 0);
            const routeLabel = row.origin
              ? `${row.origin.split(",")[0]} to ${row.destination.split(",")[0]}`
              : row.status;

            return (
              <div key={`${routeLabel}-${index}`}>
                <div className="flex justify-between gap-3 text-sm font-bold mb-1">
                  <span className="text-gray-800 truncate">{routeLabel}</span>
                  <span className="text-gray-600 whitespace-nowrap">
                    {money
                      ? `₹${Math.round(value).toLocaleString("en-IN")}`
                      : value}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${Math.max((value / max) * 100, 6)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function aggregateRecords(records: any[], xKey: string, yKey: string, mode: string) {
  const buckets = new Map<
    string,
    { label: string; total: number; count: number; sortDate: string }
  >();

  records.forEach((record) => {
    const label = String(record[xKey] || "Unknown");
    const metricValue = yKey === "count" ? 1 : Number(record[yKey] || 0);
    const current = buckets.get(label) || {
      label,
      total: 0,
      count: 0,
      sortDate: record.created_date || label,
    };
    current.total += Number.isFinite(metricValue) ? metricValue : 0;
    current.count += 1;
    if (record.created_date && record.created_date < current.sortDate) {
      current.sortDate = record.created_date;
    }
    buckets.set(label, current);
  });

  return Array.from(buckets.values())
    .map((bucket) => ({
      label: bucket.label,
      total: bucket.total,
      count: bucket.count,
      sortDate: bucket.sortDate,
      value:
        mode === "average"
          ? bucket.count
            ? bucket.total / bucket.count
            : 0
          : mode === "count"
            ? bucket.count
            : bucket.total,
    }))
    .sort((a, b) =>
      xKey === "created_month"
        ? a.sortDate.localeCompare(b.sortDate)
        : b.value - a.value,
    )
    .slice(0, 8);
}

function aggregateTimeline(records: any[], yKey: string) {
  const buckets = new Map<string, { label: string; value: number; sortDate: string }>();

  records.forEach((record) => {
    const label = String(record.created_month || "Unknown");
    const current = buckets.get(label) || {
      label,
      value: 0,
      sortDate: record.created_date || label,
    };
    current.value += Number(record[yKey] || 0);
    buckets.set(label, current);
  });

  return Array.from(buckets.values())
    .sort((a, b) => a.sortDate.localeCompare(b.sortDate))
    .slice(-6);
}

function moneyLabel(value: number | string) {
  return `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
}

function ChartValue({ value, money = false }: any) {
  return (
    <span className="text-xs font-black text-gray-600 whitespace-nowrap">
      {money ? moneyLabel(value) : Math.round(Number(value || 0)).toLocaleString("en-IN")}
    </span>
  );
}

function metricLabel(value: number | string, money = false) {
  const numericValue = Number(value || 0);
  if (money) return moneyLabel(numericValue);
  return Number.isInteger(numericValue)
    ? numericValue.toLocaleString("en-IN")
    : numericValue.toFixed(1);
}

function InsightMetric({ label, value, tone = "blue" }: any) {
  const toneClass =
    tone === "green"
      ? "bg-green-50 text-green-800 border-green-100"
      : tone === "yellow"
        ? "bg-yellow-50 text-yellow-800 border-yellow-100"
        : tone === "red"
          ? "bg-red-50 text-red-800 border-red-100"
          : "bg-blue-50 text-blue-800 border-blue-100";

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-widest opacity-75">
        {label}
      </p>
      <p className="text-sm font-black mt-1 truncate">{value}</p>
    </div>
  );
}

function AnalyzerChart({ rows, chartType, money = false }: any) {
  const width = 760;
  const height = 360;
  const margin = { top: 34, right: 28, bottom: 92, left: 76 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const max = Math.max(1, ...rows.map((row: any) => Number(row.value || 0)));
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const step = rows.length > 0 ? plotWidth / rows.length : plotWidth;
  const pointFor = (row: any, index: number) => {
    const x = margin.left + step * index + step / 2;
    const y = margin.top + plotHeight - (Number(row.value || 0) / max) * plotHeight;
    return { x, y };
  };
  const points = rows.map((row: any, index: number) => pointFor(row, index));

  if (chartType === "table") {
    return (
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-black text-gray-600 uppercase tracking-widest text-xs">
                Group
              </th>
              <th className="px-4 py-3 text-right font-black text-gray-600 uppercase tracking-widest text-xs">
                Value
              </th>
              <th className="px-4 py-3 text-right font-black text-gray-600 uppercase tracking-widest text-xs">
                Records
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rows.map((row: any) => (
              <tr key={row.label}>
                <td className="px-4 py-3 font-bold text-gray-900">{row.label}</td>
                <td className="px-4 py-3 font-black text-gray-900 text-right">
                  {metricLabel(row.value, money)}
                </td>
                <td className="px-4 py-3 font-bold text-gray-500 text-right">
                  {row.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[680px] w-full h-[360px]">
        <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
        {ticks.map((tick) => {
          const y = margin.top + plotHeight - tick * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={margin.left - 12}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-500 text-[12px] font-bold"
              >
                {tick === 1 ? metricLabel(max, money) : metricLabel(max * tick, money)}
              </text>
            </g>
          );
        })}
        <line
          x1={margin.left}
          x2={margin.left}
          y1={margin.top}
          y2={margin.top + plotHeight}
          stroke="#94a3b8"
          strokeWidth="1.5"
        />
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={margin.top + plotHeight}
          y2={margin.top + plotHeight}
          stroke="#94a3b8"
          strokeWidth="1.5"
        />

        {chartType === "bar" &&
          rows.map((row: any, index: number) => {
            const point = pointFor(row, index);
            const barWidth = Math.min(54, Math.max(22, step * 0.56));
            const barHeight = margin.top + plotHeight - point.y;
            return (
              <g key={row.label}>
                <rect
                  x={point.x - barWidth / 2}
                  y={point.y}
                  width={barWidth}
                  height={Math.max(barHeight, 3)}
                  rx="8"
                  fill="#2563eb"
                />
                <text
                  x={point.x}
                  y={point.y - 10}
                  textAnchor="middle"
                  className="fill-gray-700 text-[12px] font-black"
                >
                  {metricLabel(row.value, money)}
                </text>
              </g>
            );
          })}

        {chartType === "line" && points.length > 0 && (
          <polyline
            fill="none"
            stroke="#16a34a"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points.map((point: any) => `${point.x},${point.y}`).join(" ")}
          />
        )}

        {(chartType === "line" || chartType === "scatter") &&
          rows.map((row: any, index: number) => {
            const point = pointFor(row, index);
            return (
              <g key={row.label}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={chartType === "scatter" ? 9 : 7}
                  fill="#ffffff"
                  stroke={chartType === "scatter" ? "#2563eb" : "#16a34a"}
                  strokeWidth="4"
                />
                <text
                  x={point.x}
                  y={point.y - 14}
                  textAnchor="middle"
                  className="fill-gray-700 text-[12px] font-black"
                >
                  {metricLabel(row.value, money)}
                </text>
              </g>
            );
          })}

        {rows.map((row: any, index: number) => {
          const point = pointFor(row, index);
          return (
            <text
              key={`label-${row.label}`}
              x={point.x - 4}
              y={height - 62}
              textAnchor="end"
              transform={`rotate(-28 ${point.x - 4} ${height - 62})`}
              className="fill-gray-600 text-[12px] font-bold"
            >
              {row.label.length > 18 ? `${row.label.slice(0, 18)}...` : row.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function VerticalBarChart({ title, rows, valueKey, labelBuilder, money = false }: any) {
  const max = Math.max(1, ...rows.map((row: any) => Number(row[valueKey] || 0)));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h4 className="text-lg font-black text-gray-900 mb-5">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm font-bold text-gray-500">No chart data yet.</p>
      ) : (
        <div className="h-64 flex items-end gap-3 border-l border-b border-gray-200 pl-3 pb-3">
          {rows.slice(0, 6).map((row: any, index: number) => {
            const value = Number(row[valueKey] || 0);
            const label = labelBuilder ? labelBuilder(row) : row.label;
            return (
              <div key={`${label}-${index}`} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-2 h-full">
                <ChartValue value={value} money={money} />
                <div
                  className="w-full max-w-16 bg-blue-600 rounded-t-lg shadow-sm hover:bg-blue-700 transition-colors"
                  style={{ height: `${Math.max((value / max) * 78, 8)}%` }}
                  title={`${label}: ${money ? moneyLabel(value) : value}`}
                />
                <p className="text-[11px] font-black text-gray-500 text-center leading-tight w-full truncate">
                  {label}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LineTrendChart({ title, rows, valueKey, labelKey, money = false }: any) {
  const values = rows.map((row: any) => Number(row[valueKey] || 0));
  const max = Math.max(1, ...values);
  const width = 520;
  const height = 180;
  const points = rows.map((row: any, index: number) => {
    const x = rows.length === 1 ? width / 2 : (index / (rows.length - 1)) * width;
    const y = height - (Number(row[valueKey] || 0) / max) * 145 - 15;
    return `${x},${y}`;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h4 className="text-lg font-black text-gray-900 mb-5">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm font-bold text-gray-500">No trend data yet.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 overflow-visible">
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points.join(" ")}
            />
            {points.map((point: string, index: number) => {
              const [cx, cy] = point.split(",").map(Number);
              return (
                <g key={`${point}-${index}`}>
                  <circle cx={cx} cy={cy} r="6" fill="#ffffff" stroke="#2563eb" strokeWidth="4" />
                  <text x={cx} y={cy - 12} textAnchor="middle" className="fill-gray-700 text-[20px] font-bold">
                    {money ? moneyLabel(values[index]).replace("₹", "") : Math.round(values[index])}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 6)}, minmax(0, 1fr))` }}>
            {rows.slice(0, 6).map((row: any, index: number) => (
              <p key={`${row[labelKey]}-${index}`} className="text-[11px] font-black text-gray-500 text-center truncate">
                {row[labelKey]}
              </p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CustomChartBuilder({ records, isSeeker }: any) {
  const xOptions = [
    { key: "route", label: "Route" },
    { key: "origin_city", label: "Origin City" },
    { key: "destination_city", label: "Destination City" },
    { key: isSeeker ? "status" : "bid_status", label: isSeeker ? "Shipment Status" : "Bid Status" },
    { key: "created_month", label: "Month" },
  ];
  const yOptions = isSeeker
    ? [
        { key: "accepted_price", label: "Accepted Price", money: true },
        { key: "seeker_ask", label: "Seeker Ask", money: true },
        { key: "weight_kg", label: "Cargo Weight" },
        { key: "bid_count", label: "Bid Count" },
        { key: "transit_days", label: "Transit Days" },
        { key: "count", label: "Shipment Count" },
      ]
    : [
        { key: "bid_amount", label: "Bid Amount", money: true },
        { key: "earnings", label: "Earnings", money: true },
        { key: "weight_kg", label: "Cargo Weight" },
        { key: "won", label: "Won Bids" },
        { key: "count", label: "Bid Count" },
      ];

  const [xKey, setXKey] = useState(xOptions[0].key);
  const [yKey, setYKey] = useState(yOptions[0].key);
  const [mode, setMode] = useState("average");
  const [chartType, setChartType] = useState("bar");
  const selectedMetric = yOptions.find((option) => option.key === yKey) || yOptions[0];
  const chartRows = aggregateRecords(records || [], xKey, yKey, yKey === "count" ? "count" : mode);
  const sortedByValue = [...chartRows].sort((a, b) => b.value - a.value);
  const highest = sortedByValue[0];
  const lowest = sortedByValue[sortedByValue.length - 1];
  const average =
    chartRows.length > 0
      ? chartRows.reduce((total, row) => total + row.value, 0) / chartRows.length
      : 0;
  const recordsUsed = chartRows.reduce((total, row) => total + row.count, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h4 className="text-lg font-black text-gray-900">
            Custom Historical Graph Analyser
          </h4>
          <p className="text-sm font-bold text-gray-500">
            Choose axes, aggregation, and chart type to analyse historical records.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <select
            value={xKey}
            onChange={(event) => setXKey(event.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm font-bold text-gray-900"
          >
            {xOptions.map((option) => (
              <option key={option.key} value={option.key}>
                X: {option.label}
              </option>
            ))}
          </select>
          <select
            value={yKey}
            onChange={(event) => setYKey(event.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm font-bold text-gray-900"
          >
            {yOptions.map((option) => (
              <option key={option.key} value={option.key}>
                Y: {option.label}
              </option>
            ))}
          </select>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            disabled={yKey === "count"}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm font-bold text-gray-900 disabled:text-gray-400"
          >
            <option value="average">Average</option>
            <option value="sum">Total</option>
          </select>
          <select
            value={chartType}
            onChange={(event) => setChartType(event.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-gray-50 text-sm font-bold text-gray-900"
          >
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="scatter">Scatter Plot</option>
            <option value="table">Table View</option>
          </select>
        </div>
      </div>

      {chartRows.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-8 text-center">
          <p className="text-sm font-bold text-gray-500">No historical records available for this graph yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <InsightMetric
              label="Highest"
              value={`${highest?.label}: ${metricLabel(highest?.value, selectedMetric.money)}`}
              tone="green"
            />
            <InsightMetric
              label="Lowest"
              value={`${lowest?.label}: ${metricLabel(lowest?.value, selectedMetric.money)}`}
              tone="yellow"
            />
            <InsightMetric
              label="Group Average"
              value={metricLabel(average, selectedMetric.money)}
            />
            <InsightMetric
              label="Records Used"
              value={recordsUsed.toLocaleString("en-IN")}
            />
          </div>

          <AnalyzerChart
            rows={chartRows}
            chartType={chartType}
            money={selectedMetric.money}
          />

          <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
            <p className="text-sm font-bold text-gray-700">
              Showing{" "}
              <span className="text-blue-700">
                {yKey === "count" ? "count" : mode}
              </span>{" "}
              of <span className="text-blue-700">{selectedMetric.label}</span>{" "}
              grouped by{" "}
              <span className="text-blue-700">
                {xOptions.find((option) => option.key === xKey)?.label}
              </span>
              . Add more completed jobs and bids during testing to make this
              comparison richer.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightsPanel({ insights }: any) {
  if (!insights) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <p className="text-gray-500 font-bold">Insights are loading...</p>
      </div>
    );
  }

  const summary = insights.summary || {};
  const isSeeker = insights.role === "seeker";
  const records = insights.records || [];
  const timelineRows = aggregateTimeline(
    records,
    isSeeker ? "accepted_price" : "earnings",
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isSeeker ? (
          <>
            <StatCard label="Posted Jobs" value={summary.total_jobs || 0} />
            <StatCard label="Awarded Jobs" value={summary.awarded_jobs || 0} />
            <StatCard
              label="Total Spend"
              value={moneyLabel(summary.total_spend)}
              tone="green"
            />
            <StatCard
              label="Avg Accepted"
              value={moneyLabel(summary.average_accepted_price)}
              tone="yellow"
            />
          </>
        ) : (
          <>
            <StatCard label="Bids Placed" value={summary.total_bids || 0} />
            <StatCard label="Bids Won" value={summary.won_bids || 0} />
            <StatCard
              label="Win Rate"
              value={`${Number(summary.win_rate || 0)}%`}
              tone="yellow"
            />
            <StatCard
              label="Earnings"
              value={moneyLabel(summary.total_earnings)}
              tone="green"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VerticalBarChart
          title={isSeeker ? "Route Spend Benchmarks" : "Route Bid Patterns"}
          rows={insights.routes || []}
          valueKey={isSeeker ? "average_price" : "average_bid"}
          labelBuilder={(row: any) =>
            `${row.origin.split(",")[0]} to ${row.destination.split(",")[0]}`
          }
          money
        />
        <BarList
          title={isSeeker ? "Shipment Status Mix" : "Bid Status Mix"}
          rows={insights.statuses || []}
          valueKey="count"
        />
      </div>

      <LineTrendChart
        title={isSeeker ? "Monthly Spend Trend" : "Monthly Earnings Trend"}
        rows={timelineRows}
        valueKey="value"
        labelKey="label"
        money
      />

      <CustomChartBuilder records={records} isSeeker={isSeeker} />
    </div>
  );
}

// ==========================================
// 2. MAIN PROFILE PAGE
// ==========================================
export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState("dispatch");

  const [profile, setProfile] = useState<any>(null);
  const [myJobs, setMyJobs] = useState([]);
  const [wonJobs, setWonJobs] = useState([]);
  const [activeBids, setActiveBids] = useState([]);
  const [insights, setInsights] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionMessage, setConnectionMessage] = useState(
    "Connecting to LogiMatch...",
  );
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [bio, setBio] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [bannerPhoto, setBannerPhoto] = useState("");
  const [businessDocUrl, setBusinessDocUrl] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [expandedCustomerJobId, setExpandedCustomerJobId] = useState<
    string | number | null
  >(null);
  const [expandedCustomerChatJobId, setExpandedCustomerChatJobId] = useState<
    string | number | null
  >(null);

  useEffect(() => {
    const fetchProfileData = async () => {
      setIsLoading(true);
      setLoadError(false);
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          window.location.href = "/login";
          return;
        }

        await waitForBackend({
          onAttempt: (attempt) =>
            setConnectionMessage(
              attempt === 1
                ? "Connecting to LogiMatch..."
                : "The backend is waking up. Retrying...",
            ),
        });

        const headers = { Authorization: `Bearer ${token}` };

        const [profileRes, myJobsRes, wonJobsRes, activeBidsRes, insightsRes] =
          await Promise.all([
            fetch(apiUrl("/api/users/me"), { headers }),
            fetch(apiUrl("/api/profile/my-jobs"), { headers }),
            fetch(apiUrl("/api/profile/won-jobs"), { headers }),
            fetch(apiUrl("/api/profile/active-bids"), { headers }),
            fetch(apiUrl("/api/insights/summary"), { headers }),
          ]);

        if (profileRes.status === 401) {
          localStorage.clear();
          window.location.href = "/login";
          return;
        }

        if (
          !profileRes.ok ||
          !myJobsRes.ok ||
          !wonJobsRes.ok ||
          !activeBidsRes.ok
        ) {
          throw new Error("PROFILE_LOAD_FAILED");
        }

        const profileData = await profileRes.json();
        setProfile(profileData);
        setMyJobs(await myJobsRes.json());
        setWonJobs(await wonJobsRes.json());
        setActiveBids(await activeBidsRes.json());
        if (insightsRes.ok) {
          setInsights(await insightsRes.json());
        }

        setBio(profileData.bio || "");
        setCompanyName(profileData.company_name || "");
        setProfilePhoto(profileData.profile_photo || "");
        setBannerPhoto(profileData.banner_photo || "");
        setBusinessDocUrl(profileData.business_doc_url || "");
        setIsPublic(profileData.is_public ?? true);
      } catch {
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfileData();
  }, [loadAttempt]);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const handleDownloadManifest = async (jobId: string | number) => {
    try {
      const response = await fetch(apiUrl(`/api/jobs/${jobId}/manifest.pdf`), {
        headers: authHeaders(),
      });
      if (!response.ok) {
        const data = await response.json();
        return alert(data.error || "Manifest is available after bid acceptance.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `logimatch-manifest-${jobId}.pdf`;
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error(error);
      alert("Could not download manifest.");
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(apiUrl("/api/users/profile"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          bio,
          company_name: companyName,
          is_public: isPublic,
          profile_photo: profilePhoto,
          banner_photo: bannerPhoto,
          business_doc_url: businessDocUrl,
        }),
      });
      if (response.ok) {
        alert("Enterprise Profile successfully updated! ✅");
      }
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(apiUrl("/api/users/password"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (response.ok) {
        alert("Security Credentials Updated! 🔐");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update password.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateLocation = async (
    jobId: string,
    location: string,
    status: string,
  ) => {
    if (!location.trim()) {
      return alert("Please enter a location first.");
    }
    try {
      const response = await fetch(
        apiUrl(`/api/jobs/${jobId}/track`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ location, status }),
        },
      );
      if (response.ok) {
        alert("Logistics Milestone & Timestamp Logged successfully! 📍");
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || "The shipment update could not be saved.");
      }
    } catch {
      alert("The tracking service could not be reached. Please try again.");
    }
  };

  const handleRateProvider = async (
    providerId: string,
    jobId: string | number,
    score: number,
  ) => {
    if (!confirm(`Submit a ${score}-Star rating for this driver?`)) return;
    try {
      const response = await fetch(
        apiUrl(`/api/users/${providerId}/rate`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ score, job_id: jobId }),
        },
      );
      if (response.ok) {
        alert(
          `Thank you! A ${score}-Star rating has been added to their profile. ⭐`,
        );
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || "The rating could not be submitted.");
      }
    } catch {
      alert("The rating service could not be reached. Please try again.");
    }
  };

  const renderStars = (sum: number, count: number) => {
    const avg = count > 0 ? Math.round(sum / count) : 0;
    return "⭐".repeat(avg) + "☆".repeat(5 - avg);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "Pending System Log";
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
        <div className="flex flex-col items-center px-6 text-center" role="status">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="mt-4 text-lg font-bold text-gray-800">
            {connectionMessage}
          </p>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Free hosting can take a little longer after inactivity.
          </p>
        </div>
      </div>
    );

  if (loadError)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-black text-gray-900">Could not load your account</h1>
          <p className="mt-2 text-sm font-medium text-gray-600">
            Check your connection and try again. No profile or shipment data was changed.
          </p>
          <button
            type="button"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 font-black text-white hover:bg-blue-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 text-gray-900 font-sans">
      {/* NAVIGATION BAR */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-black text-blue-600 tracking-tighter">
            LogiMatch
          </h1>
          <div className="flex gap-4 items-center">
            <Link
              href="/dashboard"
              className="font-bold text-gray-600 hover:text-blue-600 transition-colors text-sm"
            >
              ⬅ Market Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white px-4 py-1.5 rounded-full font-bold text-sm transition-all"
            >
              Logout ⏏
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <div className="max-w-5xl mx-auto mt-8 px-4 sm:px-6 lg:px-8">
        <div className="h-48 sm:h-64 bg-gray-800 rounded-t-2xl overflow-hidden relative shadow-sm border border-gray-200">
          {bannerPhoto ? (
            <img
              src={bannerPhoto}
              className="w-full h-full object-cover opacity-90"
              alt="Banner"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-900 to-gray-800"></div>
          )}
        </div>
        <div className="bg-white px-8 py-6 rounded-b-2xl shadow-md border border-t-0 border-gray-200 flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-16 sm:-mt-20 relative z-10">
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white bg-gray-100 overflow-hidden flex-shrink-0 shadow-lg">
            {profilePhoto ? (
              <img
                src={profilePhoto}
                className="w-full h-full object-cover"
                alt="Avatar"
              />
            ) : (
              <span className="flex items-center justify-center w-full h-full text-6xl">
                👤
              </span>
            )}
          </div>
          <div className="flex-grow pb-2 w-full flex justify-between items-end">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900">
                {profile?.name}
              </h2>
              <p className="text-gray-600 font-bold text-lg mt-1">
                {companyName || "Independent Operator"}
              </p>
              <div className="flex items-center gap-3 mt-3">
                <span className="uppercase text-blue-800 text-xs font-black bg-blue-100 px-3 py-1 rounded-full tracking-wider border border-blue-200">
                  {profile?.role} Account
                </span>
                {profile?.role === "driver" && (
                  <span className="text-sm font-bold text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
                    {renderStars(profile.rating_sum, profile.rating_count)} (
                    {profile.rating_count} Reviews)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SETTINGS TABS */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="flex border-b border-gray-300 gap-8 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab("dispatch")}
            className={`pb-4 font-bold text-sm sm:text-base transition-all whitespace-nowrap ${activeTab === "dispatch" ? "border-b-4 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-900"}`}
          >
            📍 Freight & Dispatch Tracker
          </button>
          <button
            onClick={() => setActiveTab("insights")}
            className={`pb-4 font-bold text-sm sm:text-base transition-all whitespace-nowrap ${activeTab === "insights" ? "border-b-4 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-900"}`}
          >
            Market Insights
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`pb-4 font-bold text-sm sm:text-base transition-all whitespace-nowrap ${activeTab === "profile" ? "border-b-4 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-900"}`}
          >
            🏢 Enterprise Profile
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`pb-4 font-bold text-sm sm:text-base transition-all whitespace-nowrap ${activeTab === "security" ? "border-b-4 border-blue-600 text-blue-600" : "text-gray-500 hover:text-gray-900"}`}
          >
            🔐 Account Security
          </button>
        </div>

        {/* TAB 1: ENTERPRISE PROFILE */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-3xl animate-fade-in">
            <div className="mb-8">
              <h3 className="text-2xl font-black text-gray-900 mb-2">
                Public Information
              </h3>
              <p className="text-sm text-gray-500 font-medium">
                Update your business details to build trust on the open market.
              </p>
            </div>
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  Registered Company Entity
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g., Apex Logistics Ltd."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">
                    Avatar Image URL
                  </label>
                  <input
                    type="text"
                    value={profilePhoto}
                    onChange={(e) => setProfilePhoto(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-800 mb-2">
                    Banner Image URL
                  </label>
                  <input
                    type="text"
                    value={bannerPhoto}
                    onChange={(e) => setBannerPhoto(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  Business Bio & Capabilities
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={
                    profile?.role === "driver"
                      ? "Describe your fleet size, special permits, regions covered..."
                      : "Describe your enterprise supply chain needs..."
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm resize-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  Business Registration / License Documents
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-blue-50 hover:border-blue-300 transition-colors">
                  <span className="text-4xl block mb-2">📄</span>
                  <p className="font-bold text-gray-700 mb-1">
                    Drag & Drop official documents here
                  </p>
                  <p className="text-xs text-gray-500 font-medium mb-4">
                    Or securely paste a Google Drive / AWS link below:
                  </p>
                  <input
                    type="text"
                    value={businessDocUrl}
                    onChange={(e) => setBusinessDocUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full max-w-md mx-auto px-4 py-2 border border-gray-300 rounded-md text-sm outline-none shadow-inner bg-white"
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-blue-600 text-white font-black py-3 px-8 rounded-lg hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
                >
                  Save Enterprise Profile
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: ACCOUNT SECURITY */}
        {activeTab === "security" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-2xl animate-fade-in">
            <div className="mb-8">
              <h3 className="text-2xl font-black text-gray-900 mb-2">
                Security Settings
              </h3>
              <p className="text-sm text-gray-500 font-medium">
                Manage your encrypted credentials.
              </p>
            </div>
            <form onSubmit={handlePasswordChange} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none font-medium transition-all"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowCurrentPassword((visible) => !visible)
                    }
                    aria-label={
                      showCurrentPassword
                        ? "Hide current password"
                        : "Show current password"
                    }
                    className="absolute inset-y-0 right-3 flex items-center text-lg text-gray-500 hover:text-gray-900"
                  >
                    {showCurrentPassword ? "◉" : "◎"}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  New Secure Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none font-medium transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((visible) => !visible)}
                    aria-label={
                      showNewPassword ? "Hide new password" : "Show new password"
                    }
                    className="absolute inset-y-0 right-3 flex items-center text-lg text-gray-500 hover:text-gray-900"
                  >
                    {showNewPassword ? "◉" : "◎"}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                className="bg-gray-900 text-white font-black py-3 px-8 rounded-lg hover:bg-black shadow-md transition-all"
              >
                Update Password
              </button>
            </form>
          </div>
        )}

        {activeTab === "insights" && <InsightsPanel insights={insights} />}

        {/* TAB 3: FREIGHT & DISPATCH TRACKER */}
        {activeTab === "dispatch" && (
          <div className="space-y-12 animate-fade-in">
            {/* 📦 FREIGHT I AM SHIPPING (Seekers & Postings) */}
            {(myJobs.length > 0 || profile?.role === "seeker") && (
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm">
                <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                  📦 My Active Shipments
                </h3>
                {myJobs.filter((j: any) => j.status !== "open").length === 0 ? (
                  <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center">
                    <p className="text-gray-500 font-bold text-sm">
                      No active outbound freight found.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {myJobs
                      .filter((j: any) => j.status !== "open")
                      .map((job: any, index: number) => {
                        const isInDispatch = [
                          "assigned",
                          "picked_up",
                          "delivered",
                          "completed",
                        ].includes(job.status);
                        const winningBid = isInDispatch
                          ? job.bids.find((b: any) => b.status === "accepted")
                          : null;
                        const isExpanded = expandedCustomerJobId === job.id;
                        const isCustomerChatOpen =
                          expandedCustomerChatJobId === job.id;
                        const statusTone =
                          job.status === "delivered" || job.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : job.status === "picked_up"
                              ? "bg-blue-100 text-blue-800"
                              : job.status === "assigned"
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-gray-100 text-gray-800";
                        const borderTone =
                          job.status === "delivered" || job.status === "completed"
                            ? "border-green-500"
                            : job.status === "picked_up"
                              ? "border-blue-500"
                              : job.status === "assigned"
                                ? "border-indigo-500"
                                : "border-gray-300";
                        const progressSteps = [
                          {
                            label: "Assigned",
                            done: ["assigned", "picked_up", "delivered", "completed"].includes(
                              job.status,
                            ),
                          },
                          {
                            label: "Picked Up",
                            done: ["picked_up", "delivered", "completed"].includes(job.status),
                          },
                          {
                            label: "Delivered",
                            done: ["delivered", "completed"].includes(job.status),
                          },
                        ];

                        return (
                          <div
                            key={`myjob-${job.id}-${index}`}
                            className={`bg-white rounded-xl shadow-md overflow-hidden border-l-8 ${borderTone}`}
                          >
                            <div className="p-6">
                              <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                                <div>
                                  <h4 className="text-xl font-black text-gray-900">
                                    {job.origin.split(",")[0]} ➔{" "}
                                    {job.destination.split(",")[0]}
                                  </h4>
                                  <p className="text-sm text-gray-500 font-bold mt-1">
                                    {winningBid
                                      ? `Accepted at ₹${winningBid.amount}`
                                      : "Provider assignment pending"}
                                  </p>
                                </div>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider text-center ${statusTone}`}
                                  >
                                    {job.status === "open"
                                      ? "Awaiting Auto-Resolve"
                                      : job.status.replace("_", " ")}
                                  </span>
                                  {isInDispatch && winningBid && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedCustomerJobId(
                                          isExpanded ? null : job.id,
                                        )
                                      }
                                      className="px-4 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 font-black text-xs transition-colors"
                                    >
                                      {isExpanded ? "Hide Tracking" : "Track Shipment"}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Tracking Box */}
                              {isInDispatch && winningBid && (
                                <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 mt-4">
                                  <div className="grid grid-cols-3 gap-2 mb-5">
                                    {progressSteps.map((step: any) => (
                                      <div
                                        key={step.label}
                                        className={`rounded-lg border px-2 py-3 text-center ${step.done ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-white border-gray-200 text-gray-400"}`}
                                      >
                                        <p className="text-xs font-black uppercase tracking-widest">
                                          {step.label}
                                        </p>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                                        Assigned Provider
                                      </p>
                                      <p className="font-black text-gray-900 text-lg">
                                        {winningBid.provider_name}
                                      </p>
                                      <p className="text-sm text-blue-600 font-bold">
                                        {winningBid.provider_email}
                                      </p>
                                      <p className="text-xs text-yellow-600 font-bold mt-2 bg-yellow-50 inline-block px-3 py-1 rounded border border-yellow-200">
                                        {renderStars(
                                          winningBid.rating_sum,
                                          winningBid.rating_count,
                                        )}{" "}
                                        ({winningBid.rating_count} Reviews)
                                      </p>
                                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                        <button
                                          onClick={() =>
                                            handleDownloadManifest(job.id)
                                          }
                                          className="bg-blue-600 text-white font-black px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-xs"
                                        >
                                          Download Manifest
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedCustomerChatJobId(
                                              isCustomerChatOpen ? null : job.id,
                                            )
                                          }
                                          className="bg-white text-blue-700 border border-blue-200 font-black px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors text-xs"
                                        >
                                          {isCustomerChatOpen
                                            ? "Hide Chat"
                                            : "Open Chat"}
                                        </button>
                                      </div>
                                    </div>
                                    <div className="border-l-0 md:border-l-2 border-gray-200 md:pl-6 flex flex-col justify-center">
                                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                                        Current Shipment Location
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={
                                            job.status === "delivered" ||
                                            job.status === "completed"
                                              ? "text-green-500 animate-pulse text-2xl"
                                              : "text-blue-500 animate-pulse text-2xl"
                                          }
                                        >
                                          📍
                                        </span>
                                        <p className="font-black text-xl text-gray-900">
                                          {job.current_location ||
                                            (job.status === "assigned"
                                              ? "Awaiting pickup at origin"
                                              : job.destination)}
                                        </p>
                                      </div>
                                      {job.status === "picked_up" && (
                                        <p className="text-sm font-bold text-blue-700 mt-2">
                                          Cargo is in transit. The provider can update
                                          the waypoint from their dispatch panel.
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="mt-5 pt-5 border-t border-gray-200 grid grid-cols-1 lg:grid-cols-2 gap-5">
                                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                          Schedule & Logged Times
                                        </p>
                                        <div className="space-y-2 text-sm font-bold text-gray-800">
                                          <p>
                                            Target Pickup:{" "}
                                            <span className="text-gray-600">
                                              {formatDate(job.pickup_window_start)}
                                            </span>
                                          </p>
                                          <p>
                                            Target Delivery:{" "}
                                            <span className="text-gray-600">
                                              {formatDate(job.delivery_window_start)}
                                            </span>
                                          </p>
                                          <p>
                                            Actual Pickup:{" "}
                                            <span className="text-blue-800">
                                              {job.actual_pickup_time
                                                ? formatDate(job.actual_pickup_time)
                                                : "Not picked up yet"}
                                            </span>
                                          </p>
                                          <p>
                                            Actual Delivery:{" "}
                                            <span className="text-green-800">
                                              {job.actual_delivery_time
                                                ? formatDate(job.actual_delivery_time)
                                                : "Not delivered yet"}
                                            </span>
                                          </p>
                                        </div>
                                      </div>
                                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                          Special Instructions
                                        </p>
                                        <p className="text-sm text-gray-800 italic">
                                          "
                                          {job.special_instructions ||
                                            "No special instructions provided."}
                                          "
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {isCustomerChatOpen && (
                                    <div className="mt-5 pt-5 border-t border-gray-200">
                                      <JobChatThread
                                        jobId={job.id}
                                        currentUserId={profile?.id}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Rating System Banner */}
                              {job.status === "delivered" && winningBid && (
                                <div className="mt-4 bg-green-50 border border-green-200 p-5 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                                  <div>
                                    <p className="font-black text-green-900 text-lg">
                                      Shipment Arrived Safely!
                                    </p>
                                    <p className="text-sm text-green-800 font-medium">
                                      {job.has_rated
                                        ? `Your rating for ${winningBid.provider_name} has been recorded.`
                                        : `Please rate your experience with ${winningBid.provider_name}.`}
                                    </p>
                                  </div>
                                  {job.has_rated ? (
                                    <span className="rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-black text-green-700">
                                      Rating submitted
                                    </span>
                                  ) : (
                                    <div className="flex gap-1 bg-white p-2 rounded-lg border border-green-200 shadow-inner sm:gap-2">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                          key={star}
                                          onClick={() =>
                                            handleRateProvider(
                                              winningBid.provider_id,
                                              job.id,
                                              star,
                                            )
                                          }
                                          className="text-2xl hover:scale-125 transform transition-transform filter drop-shadow-sm cursor-pointer sm:text-3xl"
                                          title={`Rate ${star} Stars`}
                                        >
                                          ⭐
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* 🚚 FREIGHT I AM HAULING (Drivers & Won Jobs) */}
            {(profile?.role === "driver" ||
              activeBids.length > 0 ||
              wonJobs.length > 0) && (
              <div className="bg-blue-50 p-6 sm:p-8 rounded-2xl border border-blue-100 shadow-sm">
                <h3 className="text-xl font-black text-blue-900 mb-8 flex items-center gap-2">
                  🚚 Provider Operations
                </h3>

                {/* Active Auctions */}
                <div className="mb-10">
                  <h4 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                    ⏳ Active Auctions (Pending Bids)
                  </h4>
                  {activeBids.length === 0 ? (
                    <div className="bg-white/60 border border-dashed border-blue-200 rounded-xl p-8 text-center shadow-sm">
                      <p className="text-blue-600 font-medium">
                        You have no pending bids on the market.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {activeBids.map((bid: any, index: number) => (
                        <div
                          key={`activebid-${bid.job_id}-${index}`}
                          className="bg-white rounded-xl shadow-sm border-l-4 border-yellow-400 p-5 hover:shadow-md transition-shadow relative"
                        >
                          <span className="absolute top-4 right-4 text-xs font-black bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            PENDING
                          </span>
                          <h4 className="font-bold text-gray-900 text-lg mb-1 pr-16">
                            {bid.origin.split(",")[0]} ➔{" "}
                            {bid.destination.split(",")[0]}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1 font-medium">
                            Cargo: {bid.weight_kg}kg | Client:{" "}
                            <span className="font-bold text-gray-800">
                              {bid.seeker_name}
                            </span>
                          </p>
                          <div className="mt-4 flex justify-between items-center bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                            <span className="text-sm font-bold text-yellow-800 uppercase tracking-wide">
                              Your Bid:
                            </span>
                            <span className="text-2xl font-black text-yellow-700">
                              ₹{bid.my_bid}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirmed / Won Jobs */}
                <div>
                  <h4 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                    ✅ Confirmed Dispatches
                  </h4>
                  {wonJobs.length === 0 ? (
                    <div className="bg-white/60 border border-dashed border-blue-200 rounded-xl p-8 text-center shadow-sm">
                      <p className="text-blue-600 font-medium">
                        No assigned shipments currently.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {wonJobs.map((job: any, index: number) => (
                        <DriverTrackingCard
                          key={`wonjob-${job.job_id}-${index}`}
                          job={job}
                          handleUpdateLocation={handleUpdateLocation}
                          handleDownloadManifest={handleDownloadManifest}
                          formatDate={formatDate}
                          currentUserId={profile?.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
