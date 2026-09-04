import type { FieldLeadContext } from "./api";
import { refreshSession } from "./api";

const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";
const useSameOriginApi = typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app");

export async function updateFieldNote(leadId: string, noteId: string, body: string): Promise<FieldLeadContext["notes"][number]> {
  const init: RequestInit = { method: "PATCH", body: JSON.stringify({ body }), headers: { "content-type": "application/json" } };
  const url = `/api/v1/field/leads/${encodeURIComponent(leadId)}/notes/${encodeURIComponent(noteId)}`;
  let response = await fetch(useSameOriginApi || !baseUrl ? url : `${baseUrl}${url}`, { ...init, credentials: "include" });
  if (response.status === 401) {
    await refreshSession();
    response = await fetch(useSameOriginApi || !baseUrl ? url : `${baseUrl}${url}`, { ...init, credentials: "include" });
  }
  const payload = await response.json().catch(() => ({})) as { note?: FieldLeadContext["notes"][number]; error?: string };
  if (!response.ok || !payload.note) throw new Error(payload.error || `Request failed with status ${response.status}`);
  return payload.note;
}
