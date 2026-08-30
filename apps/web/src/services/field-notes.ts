import type { FieldLeadContext } from "./api";
import { refreshSession } from "./api";

const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export async function updateFieldNote(leadId: string, noteId: string, body: string): Promise<FieldLeadContext["notes"][number]> {
  const init: RequestInit = { method: "PATCH", body: JSON.stringify({ body }), headers: { "content-type": "application/json" } };
  let response = await fetch(`${baseUrl}/api/v1/field/leads/${encodeURIComponent(leadId)}/notes/${encodeURIComponent(noteId)}`, { ...init, credentials: "include" });
  if (response.status === 401) {
    await refreshSession();
    response = await fetch(`${baseUrl}/api/v1/field/leads/${encodeURIComponent(leadId)}/notes/${encodeURIComponent(noteId)}`, { ...init, credentials: "include" });
  }
  const payload = await response.json().catch(() => ({})) as { note?: FieldLeadContext["notes"][number]; error?: string };
  if (!response.ok || !payload.note) throw new Error(payload.error || `Request failed with status ${response.status}`);
  return payload.note;
}
