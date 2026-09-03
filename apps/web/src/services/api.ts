import type {
  DealBrief,
  DiscoverResponse,
  DiscoveryScanRequest,
  DiscoveryScanJobResponse,
  DiscoveryScanLead,
  DiscoveryScanResult,
  DiscoveryScanResultsPage,
  DiscoveryScanStatus,
  DiscoveryScanStatusResponse,
  LeadOutcome,
  LeadOutcomeCard,
  LocationResolveRequest,
  LocationResolveResponse,
  LocationReverseRequest,
  NeighborhoodMarket,
  PropertyDataQualityResponse,
  RevenueCommandCenter,
  RouteCreateRequest,
  RouteNextResponse,
  RoutePlan,
  TodayDashboard,
  OpportunitySignal,
  ImageryCapabilitiesResponse,
  MarketAreaDetail,
  MarketEventsResponse,
  MarketHotspotsResponse,
  ConversationInsight,
  HomeownerConfirmationState,
  PropertyVisualSignal,
  PlatformPermission,
  PlatformRole,
  PlatformFeatureFlags,
  PlatformModule,
} from "@solar/contracts";
import type { IntelligenceDashboard } from "@solar/analytics-contracts";

const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export interface PlatformAuthUser {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  active: boolean;
  mustChangePassword: boolean;
  roles: PlatformRole[];
  permissions: PlatformPermission[];
  teamIds: string[];
  featureFlags: PlatformFeatureFlags;
  modules: PlatformModule[];
}

export interface TeamMember extends PlatformAuthUser {
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export interface TeamMemberInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password?: string;
  roles: PlatformRole[];
}

export interface FieldLead {
  id: string;
  sourceFollowUpId?: string | null;
  propertyId: string | null;
  setterId: string | null;
  currentCloserId: string | null;
  createdByUserId: string | null;
  teamId: string | null;
  homeownerName: string;
  phone: string | null;
  email: string | null;
  addressLine1: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  utility: string | null;
  supplier: string | null;
  approximateMonthlyBill: number | null;
  qualification: unknown;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface FieldAppointment {
  id: string;
  leadId: string;
  setterId: string | null;
  closerId: string | null;
  teamId: string | null;
  availabilitySlotId: string | null;
  operationalSlotId: string | null;
  isOverflow: boolean;
  scheduledStart: string;
  scheduledEnd: string;
  timezone: string;
  appointmentType: string;
  status: string;
  outcome: string | null;
  outcomeNotes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  notes: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  createdAt: string;
  updatedAt: string;
  homeownerName?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  setterName?: string | null;
  closerName?: string | null;
  hasBill?: boolean;
}

export interface FieldAvailabilitySlot {
  id: string;
  closerId: string;
  closerName: string;
  slotStart: string;
  slotEnd: string;
  timezone: string;
  capacity: number;
  bookedCount: number;
  status: string;
  note: string | null;
}

export interface FieldOperationalSlotAppointment {
  id: string;
  leadId: string;
  status: string;
  isOverflow: boolean;
}

export interface FieldOperationalSlotDefinition {
  id: string;
  startTime: string;
  durationMinutes: number;
  standardCapacity: number;
  overflowPolicy: "ALLOW_WITH_WARNING" | "BLOCK";
  source: string;
  active: boolean;
}

export interface FieldOperationalSlot {
  id: string;
  teamId: string | null;
  slotDate: string;
  startTime: string;
  slotStart: string;
  slotEnd: string;
  timezone: string;
  standardCapacity: number;
  bookedCount: number;
  remainingCapacity: number;
  overflowCount: number;
  overflowPolicy: "ALLOW_WITH_WARNING" | "BLOCK";
  status: "OPEN" | "BLOCKED";
  appointments: FieldOperationalSlotAppointment[];
}

export interface FieldLeadContext {
  lead: FieldLead;
  appointments: FieldAppointment[];
  notes: Array<{ id: string; leadId: string; appointmentId: string | null; authorId: string | null; authorName: string | null; authorRole: string | null; kind: string; body: string | null; createdAt: string; updatedAt: string }>;
  bills: Array<{ id: string; leadId: string; uploadedBy: string | null; storageKey: string; fileName: string; mimeType: string; fileSizeBytes: number; replacedBy: string | null; replacedAt: string | null; createdAt: string }>;
  activities: Array<{ id: string; leadId: string; actorId: string | null; actorName: string | null; eventType: string; event: unknown; createdAt: string }>;
  sheetSync: { id: string; leadId: string; status: string; attempts: number; lastSyncedAt: string | null; lastError: string | null; nextAttemptAt: string | null; updatedAt: string } | null;
}

export interface FieldReport {
  leadCount: number;
  appointmentCount: number;
  byStatus: Array<{ status: string; count: number }>;
  byOutcome: Array<{ outcome: string; count: number }>;
  sync: { pending: number; synced: number; failed: number };
  capacity: { standard: number; booked: number; remaining: number; overflow: number };
  unassignedCount: number;
  confirmedCount: number;
  cancelledCount: number;
  cancellationReasons: Array<{ reason: string; count: number }>;
}

export type FieldFollowUpStatus = "OPEN" | "DONE" | "SNOOZED" | "CANCELLED" | "CONVERTED_TO_APPOINTMENT" | "CONVERTED";
export interface FieldFollowUpActivity {
  id: string;
  followUpId: string;
  actorId: string | null;
  eventType: string;
  event: unknown;
  createdAt: string;
}
export interface FieldFollowUp {
  id: string;
  leadId: string | null;
  teamId: string | null;
  convertedLeadId: string | null;
  ownerUserId: string;
  dueAt: string | null;
  dueDaypart: string | null;
  reason: string;
  note: string;
  status: FieldFollowUpStatus;
  createdBy: string | null;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
  convertedAppointmentId: string | null;
  homeownerName: string;
  addressLine1: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  activities: FieldFollowUpActivity[];
}

export interface AvailableCloser {
  id: string;
  displayName: string;
  teamIds: string[];
  appointmentsToday: number;
}

export interface PropertyDetailPayload {
  property: {
    id: string;
    normalizedAddress: string;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    county?: string | null;
    municipality?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  locationVerification?: {
    geocodedLatitude?: number | null;
    geocodedLongitude?: number | null;
    solarBuildingCenterLatitude?: number | null;
    solarBuildingCenterLongitude?: number | null;
    distanceMeters: number | null;
    thresholdMeters: number;
    status: "VERIFIED" | "REVIEW" | "MISMATCH" | "UNKNOWN";
  };
  solarAssessment: {
    solarFitScore: number;
    solarFitConfidence: number;
    maxRoofSolarCapacityKw?: number | null;
    confirmedAnnualUsageKwh?: number | null;
    estimatedEnergyNeedKw?: number | null;
    estimatedMaxSystemKw?: number | null;
    estimatedAnnualProductionKwh?: number | null;
    maxArrayPanelsCount?: number | null;
    maxSunshineHoursPerYear?: number | null;
    imageryQuality?: string | null;
    existingSolarStatus: "DETECTED" | "NOT_DETECTED" | "UNKNOWN";
    imageryDate?: string | null;
    imageryProcessedDate?: string | null;
  };
  opportunityAssessment: {
    overallOpportunityScore: number;
    confidence: number;
  };
  whaleScore: {
    whaleScore: number;
    confidence: number;
    reasons: string[];
    verificationNeeded: string[];
  };
  signals: Array<{
    signalType: string;
    source: string;
    confidence: number;
    valueJson: unknown;
  }>;
  visualSignals: PropertyVisualSignal[];
  conversationInsights: ConversationInsight[];
  homeownerConfirmations: HomeownerConfirmationState;
  opportunitySignals: OpportunitySignal[];
  usageProfile: {
    annualUsageKwh?: number | null;
    monthlyBillAverage?: number | null;
    source: string;
    confidence: number;
  };
  permits: Array<{
    permitType: string;
    status: string;
    issuedDate?: string | null;
    applicationDate?: string | null;
  }>;
  leadOutcome: LeadOutcome;
  audit: {
    missingFields: string[];
    warnings: string[];
    detectedArrayStatus: string;
    selectedProductionConfig?: {
      panelsCount: number | null;
      yearlyEnergyDcKwh: number | null;
      selectionReason: string;
    } | null;
  };
  scoreBreakdown: {
    score: number;
    confidence: number;
    components: Array<{
      name: string;
      contribution: number;
      explanation: string;
    }>;
  };
  dataQuality: {
    grade: string;
    confidence: number;
    availableSignals: string[];
    missingSignals: string[];
    warnings: string[];
  };
  maxRoofSolarCapacityKw: number | null;
  confirmedAnnualUsageKwh: number | null;
  estimatedEnergyNeedKw: number | null;
  reasons: string[];
  warnings: string[];
  verificationNeeded: boolean;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    let response = await fetch(resolveUrl(path), {
      ...init,
      credentials: "include",
      signal: init?.signal ?? controller.signal,
    });
    if (response.status === 401 && !path.startsWith("/api/v1/auth/")) {
      try {
        await refreshSession();
        response = await fetch(resolveUrl(path), {
          ...init,
          credentials: "include",
          signal: init?.signal ?? controller.signal,
        });
      } catch {
        return null;
      }
    }
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function requestPlatformJson<T>(path: string, init: RequestInit = {}, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response = await fetch(resolveUrl(path), {
      ...init,
      credentials: "include",
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
      signal: init.signal ?? controller.signal,
    });
    if (response.status === 401 && !path.startsWith("/api/v1/auth/")) {
      await refreshSession();
      response = await fetch(resolveUrl(path), {
        ...init,
        credentials: "include",
        headers: { "content-type": "application/json", ...(init.headers ?? {}) },
        signal: init.signal ?? controller.signal,
      });
    }
    const payload = await response.json().catch(() => ({})) as { error?: string; code?: string };
    if (!response.ok) {
      const error = new Error(payload.error || `Request failed with status ${response.status}`);
      Object.assign(error, { status: response.status, code: payload.code });
      throw error;
    }
    return payload as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getCurrentUser(): Promise<PlatformAuthUser | null> {
  try {
    const response = await requestPlatformJson<{ user: PlatformAuthUser }>("/api/v1/auth/me", { method: "GET" });
    return response.user;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<PlatformAuthUser> {
  const response = await requestPlatformJson<{ user: PlatformAuthUser }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return response.user;
}

export async function logout(): Promise<void> {
  await requestPlatformJson<{ ok: true }>("/api/v1/auth/logout", { method: "POST" });
}

export async function refreshSession(): Promise<PlatformAuthUser> {
  const response = await requestPlatformJson<{ user: PlatformAuthUser }>("/api/v1/auth/refresh", { method: "POST" });
  return response.user;
}

export async function acceptInvite(token: string, password: string): Promise<void> {
  await requestPlatformJson<{ ok: true }>("/api/v1/auth/invite/accept", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<PlatformAuthUser> {
  const response = await requestPlatformJson<{ user: PlatformAuthUser }>("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return response.user;
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  const response = await requestPlatformJson<{ users: TeamMember[] }>("/api/v1/team", { method: "GET" });
  return response.users;
}

export async function createTeamMember(input: TeamMemberInput): Promise<{ user: TeamMember; invite: { token?: string; expiresAt: string } | null }> {
  return requestPlatformJson("/api/v1/team/users", { method: "POST", body: JSON.stringify(input) });
}

export async function updateTeamMember(id: string, input: Partial<TeamMemberInput> & { active?: boolean }): Promise<TeamMember> {
  const response = await requestPlatformJson<{ user: TeamMember }>(`/api/v1/team/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return response.user;
}

export async function createTeamInvite(id: string): Promise<{ token?: string; expiresAt: string }> {
  const response = await requestPlatformJson<{ invite: { token?: string; expiresAt: string } }>(`/api/v1/team/users/${encodeURIComponent(id)}/invite`, { method: "POST" });
  return response.invite;
}

export async function getFieldLeads(): Promise<FieldLead[]> {
  const response = await requestPlatformJson<{ leads: FieldLead[] }>("/api/v1/field/leads", { method: "GET" });
  return response.leads;
}

export async function getFieldLead(id: string): Promise<FieldLeadContext> {
  return requestPlatformJson<FieldLeadContext>(`/api/v1/field/leads/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function createFieldLead(input: Record<string, unknown>): Promise<FieldLead> {
  const response = await requestPlatformJson<{ lead: FieldLead }>("/api/v1/field/leads", { method: "POST", body: JSON.stringify(input) });
  return response.lead;
}

export async function createFieldLeadWithAppointment(input: Record<string, unknown>, operationalSlotId: string, allowOverflow = false, appointmentType?: string): Promise<{ lead: FieldLead; appointment: FieldAppointment }> {
  return requestPlatformJson<{ lead: FieldLead; appointment: FieldAppointment }>("/api/v1/field/leads", {
    method: "POST",
    body: JSON.stringify({ ...input, operationalSlotId, allowOverflow, appointmentType }),
  });
}

export async function getFieldAvailability(from?: string, to?: string): Promise<FieldAvailabilitySlot[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const response = await requestPlatformJson<{ slots: FieldAvailabilitySlot[] }>(`/api/v1/field/availability${params.toString() ? `?${params}` : ""}`, { method: "GET" });
  return response.slots;
}

export async function getFieldOperationalSlots(from?: string, to?: string): Promise<FieldOperationalSlot[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const response = await requestPlatformJson<{ slots: FieldOperationalSlot[] }>(`/api/v1/field/operational-slots${params.toString() ? `?${params}` : ""}`, { method: "GET" });
  return response.slots;
}

export async function getFieldOperationalSlotDefinitions(): Promise<FieldOperationalSlotDefinition[]> {
  const response = await requestPlatformJson<{ definitions: FieldOperationalSlotDefinition[] }>("/api/v1/field/operational-slot-definitions", { method: "GET" });
  return response.definitions;
}

export async function updateFieldOperationalSlotDefinition(id: string, standardCapacity: number, overflowPolicy: FieldOperationalSlotDefinition["overflowPolicy"]): Promise<FieldOperationalSlotDefinition> {
  const response = await requestPlatformJson<{ definition: FieldOperationalSlotDefinition }>(`/api/v1/field/operational-slot-definitions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ standardCapacity, overflowPolicy }) });
  return response.definition;
}

export async function getFieldClosers(): Promise<Array<{ id: string; displayName: string; teamIds: string[] }>> {
  const response = await requestPlatformJson<{ closers: Array<{ id: string; displayName: string; teamIds: string[] }> }>("/api/v1/field/closers", { method: "GET" });
  return response.closers;
}

export async function createFieldAvailability(input: Record<string, unknown>): Promise<FieldAvailabilitySlot> {
  const response = await requestPlatformJson<{ slot: FieldAvailabilitySlot }>("/api/v1/field/availability", { method: "POST", body: JSON.stringify(input) });
  return response.slot;
}

export async function createFieldAppointment(leadId: string, slotId: string, appointmentType?: string, options?: { operational?: boolean; allowOverflow?: boolean }): Promise<FieldAppointment> {
  const body = options?.operational ? { operationalSlotId: slotId, allowOverflow: options.allowOverflow === true, appointmentType } : { slotId, appointmentType };
  const response = await requestPlatformJson<{ appointment: FieldAppointment }>(`/api/v1/field/leads/${encodeURIComponent(leadId)}/appointments`, { method: "POST", body: JSON.stringify(body) });
  return response.appointment;
}

export async function createFieldOperationalAppointment(leadId: string, operationalSlotId: string, allowOverflow = false, appointmentType?: string): Promise<FieldAppointment> {
  return createFieldAppointment(leadId, operationalSlotId, appointmentType, { operational: true, allowOverflow });
}

export async function getFieldAppointments(): Promise<FieldAppointment[]> {
  const response = await requestPlatformJson<{ appointments: FieldAppointment[] }>("/api/v1/field/appointments", { method: "GET" });
  return response.appointments;
}

export async function getFieldAppointment(id: string): Promise<{ context: FieldLeadContext; appointment: FieldAppointment }> {
  return requestPlatformJson(`/api/v1/field/appointments/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function getAvailableFieldClosers(id: string): Promise<AvailableCloser[]> {
  const response = await requestPlatformJson<{ closers: AvailableCloser[] }>(`/api/v1/field/appointments/${encodeURIComponent(id)}/available-closers`, { method: "GET" });
  return response.closers;
}

export async function assignFieldAppointment(id: string, closerId: string): Promise<FieldAppointment> {
  const response = await requestPlatformJson<{ appointment: FieldAppointment }>(`/api/v1/field/appointments/${encodeURIComponent(id)}/assign`, { method: "POST", body: JSON.stringify({ closerId }) });
  return response.appointment;
}

export async function cancelFieldAppointment(id: string, cancelReason: string): Promise<FieldAppointment> {
  const response = await requestPlatformJson<{ appointment: FieldAppointment }>(`/api/v1/field/appointments/${encodeURIComponent(id)}/cancel`, { method: "POST", body: JSON.stringify({ cancelReason }) });
  return response.appointment;
}

export async function rescheduleFieldAppointment(id: string, operationalSlotId: string, allowOverflow = false): Promise<FieldAppointment> {
  const response = await requestPlatformJson<{ appointment: FieldAppointment }>(`/api/v1/field/appointments/${encodeURIComponent(id)}/reschedule`, { method: "POST", body: JSON.stringify({ operationalSlotId, allowOverflow }) });
  return response.appointment;
}

export async function updateFieldOutcome(id: string, outcome: string, outcomeNotes?: string): Promise<FieldAppointment> {
  const response = await requestPlatformJson<{ appointment: FieldAppointment }>(`/api/v1/field/appointments/${encodeURIComponent(id)}/outcome`, { method: "POST", body: JSON.stringify({ outcome, outcomeNotes }) });
  return response.appointment;
}

export async function addFieldNote(leadId: string, body: string, appointmentId?: string): Promise<FieldLeadContext["notes"][number]> {
  const response = await requestPlatformJson<{ note: FieldLeadContext["notes"][number] }>(`/api/v1/field/leads/${encodeURIComponent(leadId)}/notes`, { method: "POST", body: JSON.stringify({ body, appointmentId }) });
  return response.note;
}

export async function uploadFieldBill(leadId: string, file: File): Promise<void> {
  const contentBase64 = await fileToBase64(file);
  await requestPlatformJson(`/api/v1/field/leads/${encodeURIComponent(leadId)}/bills`, {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, mimeType: file.type || mimeTypeFromName(file.name), contentBase64 }),
  }, 30_000);
}

export async function getFieldBillDownloadUrl(billId: string): Promise<string> {
  const response = await requestPlatformJson<{ download: { url: string; expiresAt: string } }>(`/api/v1/field/bills/${encodeURIComponent(billId)}/download-url`, { method: "GET" });
  return resolveUrl(response.download.url);
}

export async function downloadFieldBill(billId: string): Promise<void> {
  const url = await getFieldBillDownloadUrl(billId);
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("The bill could not be downloaded.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/i)?.[1] ?? "utility-bill";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

function mimeTypeFromName(fileName: string): string {
  const extension = fileName.toLowerCase().split(".").pop();
  return extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png" : extension === "heic" ? "image/heic" : extension === "heif" ? "image/heif" : "image/jpeg";
}

export async function getFieldReport(): Promise<FieldReport> {
  return requestPlatformJson<FieldReport>("/api/v1/field/reports", { method: "GET" });
}

export async function getFieldFollowUps(): Promise<FieldFollowUp[]> {
  const response = await requestPlatformJson<{ followUps: FieldFollowUp[] }>("/api/v1/field/follow-ups", { method: "GET" });
  return response.followUps;
}

export async function getFieldFollowUp(id: string): Promise<FieldFollowUp> {
  const response = await requestPlatformJson<{ followUp: FieldFollowUp }>(`/api/v1/field/follow-ups/${encodeURIComponent(id)}`, { method: "GET" });
  return response.followUp;
}

export async function createFieldFollowUp(input: { leadId?: string | null; teamId?: string | null; homeownerName?: string | null; phone?: string | null; email?: string | null; addressLine1: string; city?: string | null; state?: string | null; postalCode?: string | null; latitude?: number | null; longitude?: number | null; dueAt?: string | null; dueDaypart?: string | null; reason: string; note?: string }): Promise<FieldFollowUp> {
  const response = await requestPlatformJson<{ followUp: FieldFollowUp }>("/api/v1/field/follow-ups", { method: "POST", body: JSON.stringify(input) });
  return response.followUp;
}

export async function rescheduleFieldFollowUp(id: string, input: { dueAt?: string | null; dueDaypart?: string | null }): Promise<FieldFollowUp> {
  const response = await requestPlatformJson<{ followUp: FieldFollowUp }>(`/api/v1/field/follow-ups/${encodeURIComponent(id)}/reschedule`, { method: "POST", body: JSON.stringify(input) });
  return response.followUp;
}

export async function addFieldFollowUpNote(id: string, body: string): Promise<FieldFollowUp> {
  const response = await requestPlatformJson<{ followUp: FieldFollowUp }>(`/api/v1/field/follow-ups/${encodeURIComponent(id)}/note`, { method: "POST", body: JSON.stringify({ body }) });
  return response.followUp;
}

export async function convertFieldFollowUpToLead(id: string): Promise<{ followUp: FieldFollowUp; lead: FieldLead }> {
  return requestPlatformJson<{ followUp: FieldFollowUp; lead: FieldLead }>(`/api/v1/field/follow-ups/${encodeURIComponent(id)}/convert-to-lead`, { method: "POST" });
}

export async function snoozeFieldFollowUp(id: string, dueAt: string): Promise<FieldFollowUp> {
  const response = await requestPlatformJson<{ followUp: FieldFollowUp }>(`/api/v1/field/follow-ups/${encodeURIComponent(id)}/snooze`, { method: "POST", body: JSON.stringify({ dueAt }) });
  return response.followUp;
}

export async function completeFieldFollowUp(id: string): Promise<FieldFollowUp> {
  const response = await requestPlatformJson<{ followUp: FieldFollowUp }>(`/api/v1/field/follow-ups/${encodeURIComponent(id)}/complete`, { method: "POST" });
  return response.followUp;
}

export async function cancelFieldFollowUp(id: string): Promise<FieldFollowUp> {
  const response = await requestPlatformJson<{ followUp: FieldFollowUp }>(`/api/v1/field/follow-ups/${encodeURIComponent(id)}/cancel`, { method: "POST" });
  return response.followUp;
}

export async function convertFieldFollowUp(id: string, slotId: string, appointmentType?: string): Promise<{ followUp: FieldFollowUp; appointment: FieldAppointment }> {
  return requestPlatformJson<{ followUp: FieldFollowUp; appointment: FieldAppointment }>(`/api/v1/field/follow-ups/${encodeURIComponent(id)}/convert`, { method: "POST", body: JSON.stringify({ slotId, appointmentType }) });
}

export async function convertFieldFollowUpToOperationalSlot(id: string, operationalSlotId: string, allowOverflow = false, appointmentType?: string): Promise<{ followUp: FieldFollowUp; appointment: FieldAppointment }> {
  return requestPlatformJson<{ followUp: FieldFollowUp; appointment: FieldAppointment }>(`/api/v1/field/follow-ups/${encodeURIComponent(id)}/convert`, { method: "POST", body: JSON.stringify({ operationalSlotId, allowOverflow, appointmentType }) });
}

export async function getIntelligenceDashboard(): Promise<IntelligenceDashboard | null> {
  return requestJson<IntelligenceDashboard>("/api/v1/intelligence/dashboard");
}

function resolveUrl(path: string): string {
  return baseUrl ? `${baseUrl}${path}` : path;
}

export async function getApiHealth(): Promise<{ status: "ok"; service: string } | null> {
  return requestJson<{ status: "ok"; service: string }>("/health");
}

export async function getCapabilities(): Promise<ImageryCapabilitiesResponse | null> {
  return requestJson<ImageryCapabilitiesResponse>("/api/v1/capabilities");
}

export async function getTopLeads(): Promise<TodayDashboard | null> {
  return requestJson<TodayDashboard>("/api/v1/leads/top");
}

export async function getLeadOutcomes(outcome: "ALL" | "SAVED" | "SKIPPED" | "REVISIT" = "ALL"): Promise<LeadOutcomeCard[] | null> {
  return requestJson<LeadOutcomeCard[]>(`/api/v1/lead-outcomes?outcome=${encodeURIComponent(outcome)}`);
}

export async function resolveLocation(body: LocationResolveRequest): Promise<LocationResolveResponse | null> {
  try {
    const response = await fetch(resolveUrl("/api/v1/locations/resolve"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (response.status === 404) {
      return null;
    }
    if (response.status === 503) {
      throw new Error("Geocoding unavailable");
    }
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as LocationResolveResponse;
  } catch (error) {
    if (error instanceof Error && error.message === "Geocoding unavailable") {
      throw error;
    }
    return null;
  }
}

export async function reverseLocation(body: LocationReverseRequest): Promise<LocationResolveResponse | null> {
  try {
    const response = await fetch(resolveUrl("/api/v1/locations/reverse"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (response.status === 404) {
      return null;
    }
    if (response.status === 503) {
      throw new Error("Geocoding unavailable");
    }
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as LocationResolveResponse;
  } catch (error) {
    if (error instanceof Error && error.message === "Geocoding unavailable") {
      throw error;
    }
    return null;
  }
}

export async function getCommandCenter(): Promise<RevenueCommandCenter | null> {
  return requestJson<RevenueCommandCenter>("/api/v1/revenue/command-center");
}

export async function getProperty(id: string): Promise<PropertyDetailPayload | null> {
  return requestJson<PropertyDetailPayload>(`/api/v1/properties/${encodeURIComponent(id)}`);
}

export async function getPropertyBrief(id: string): Promise<DealBrief | null> {
  return requestJson<DealBrief>(`/api/v1/properties/${encodeURIComponent(id)}/brief`);
}

export async function analyzeProperty(address: string): Promise<PropertyDetailPayload | null> {
  return requestJson<PropertyDetailPayload>("/api/v1/properties/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
}

export async function scanAroundMe(radiusMiles = 10): Promise<DiscoverResponse | null> {
  return requestJson<DiscoverResponse>(`/api/v1/neighborhoods/discover?radiusMiles=${encodeURIComponent(radiusMiles)}`);
}

export async function startDiscoveryScan(body: DiscoveryScanRequest): Promise<DiscoveryScanJobResponse | null> {
  return requestJson<DiscoveryScanJobResponse>("/api/v1/discovery/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function scanDiscovery(body: DiscoveryScanRequest): Promise<DiscoveryScanResult | null> {
  const job = await startDiscoveryScan(body);
  if (!job?.scanId) {
    return null;
  }
  return waitForDiscoveryScan(job.scanId);
}

export async function getDiscoveryScan(scanId: string): Promise<DiscoveryScanStatusResponse | null> {
  return requestJson<DiscoveryScanStatusResponse>(`/api/v1/discovery/scans/${encodeURIComponent(scanId)}`);
}

export async function getDiscoveryScanResults(scanId: string, cursor?: string | null, limit = 20): Promise<DiscoveryScanResultsPage | null> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }
  params.set("limit", String(limit));
  const suffix = params.toString();
  return requestJson<DiscoveryScanResultsPage>(`/api/v1/discovery/scans/${encodeURIComponent(scanId)}/results${suffix ? `?${suffix}` : ""}`);
}

async function waitForDiscoveryScan(scanId: string): Promise<DiscoveryScanResult | null> {
  const terminalStatuses: DiscoveryScanStatus[] = ["COMPLETE", "PARTIAL", "FAILED", "DISCOVERY_FAILED", "DATA_COVERAGE_UNAVAILABLE"];
  const deadline = Date.now() + 45_000;
  let current = await getDiscoveryScan(scanId);
  while (current && !terminalStatuses.includes(current.status) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 750));
    current = await getDiscoveryScan(scanId);
  }
  if (!current) {
    return null;
  }
  const results = await loadAllDiscoveryScanResults(scanId);
  return {
    scanId: current.scanId,
    currentLocation: current.currentLocation,
    radiusMiles: current.radiusMiles,
    candidateCount: current.candidateCount,
    analyzedCount: current.analyzedCount,
    googleSolarCalls: current.googleSolarCalls,
    estimatedCostUsd: current.estimatedCostUsd,
    propertiesFound: current.propertiesFound,
    qualifiedLeadCount: current.qualifiedLeadCount,
    solarAnalyzedCount: current.solarAnalyzedCount,
    results,
  };
}

async function loadAllDiscoveryScanResults(scanId: string): Promise<DiscoveryScanLead[]> {
  const results: DiscoveryScanLead[] = [];
  let cursor: string | null = null;
  while (true) {
    const page = await getDiscoveryScanResults(scanId, cursor, 100);
    if (!page) {
      break;
    }
    results.push(...page.results);
    if (!page.hasMore || !page.nextCursor) {
      break;
    }
    cursor = page.nextCursor;
  }
  return results;
}

export async function createRoute(body: RouteCreateRequest): Promise<RoutePlan | null> {
  return requestJson<RoutePlan>("/api/v1/routes/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getRouteNext(routeId: string): Promise<RouteNextResponse | null> {
  return requestJson<RouteNextResponse>(`/api/v1/routes/${encodeURIComponent(routeId)}/next`);
}

export async function getPropertyDataQuality(id: string): Promise<PropertyDataQualityResponse | null> {
  return requestJson<PropertyDataQualityResponse>(`/api/v1/properties/${encodeURIComponent(id)}/data-quality`);
}

export async function getMarketHotspots(params: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  days: number;
}): Promise<MarketHotspotsResponse | null> {
  const query = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    radiusMiles: String(params.radiusMiles),
    days: String(params.days),
  });
  return requestJson<MarketHotspotsResponse>(`/api/v1/markets/hotspots?${query.toString()}`);
}

export async function getMarketArea(id: string): Promise<MarketAreaDetail | null> {
  return requestJson<MarketAreaDetail>(`/api/v1/markets/${encodeURIComponent(id)}`);
}

export async function getMarketEvents(
  marketId: string,
  cursor?: string | null,
  limit = 20,
): Promise<MarketEventsResponse | null> {
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }
  params.set("limit", String(limit));
  const suffix = params.toString();
  return requestJson<MarketEventsResponse>(`/api/v1/markets/${encodeURIComponent(marketId)}/events${suffix ? `?${suffix}` : ""}`);
}

export async function updateLeadOutcome(propertyId: string, outcome: LeadOutcome["outcome"], notes: string | null): Promise<LeadOutcome | null> {
  return requestJson<LeadOutcome>(`/api/v1/properties/${encodeURIComponent(propertyId)}/interactions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ outcome, notes }),
  });
}

export async function savePropertyVisualSignals(
  propertyId: string,
  body: HomeownerConfirmationState,
): Promise<PropertyDetailPayload | null> {
  return requestJson<PropertyDetailPayload>(`/api/v1/properties/${encodeURIComponent(propertyId)}/visual-signals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
