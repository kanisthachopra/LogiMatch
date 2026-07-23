export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});
