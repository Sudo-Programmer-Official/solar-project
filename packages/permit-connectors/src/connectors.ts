import type {
  ConnectorHealth,
  ConnectorMetadata,
  DiscoveryResult,
  Jurisdiction,
  NormalizedPermit,
  PermitCategory,
  PermitConnector,
  RawPermitPage,
  RateLimitPolicy,
} from "../../contracts/src/index";
import { PermitCategory as Categories } from "../../contracts/src/index";

abstract class BaseConnector implements PermitConnector {
  abstract metadata(): ConnectorMetadata;
  abstract discover(jurisdiction: Jurisdiction): Promise<DiscoveryResult>;
  abstract fetchPage(cursor?: string): Promise<RawPermitPage>;
  abstract normalize(record: unknown): Promise<NormalizedPermit>;
  abstract healthCheck(): Promise<ConnectorHealth>;
  abstract rateLimit(): RateLimitPolicy;

  protected detectCategory(description: string): PermitCategory {
    const text = description.toLowerCase();
    if (/\bsolar\b|\bpv\b|\bphotovoltaic\b/.test(text)) return Categories.SOLAR;
    if (/\broof|\bre-?roof|\bshingle/.test(text)) return Categories.ROOF_REPLACEMENT;
    if (/\bservice upgrade|\bpanel upgrade|\b200 amp/.test(text)) return Categories.ELECTRICAL_SERVICE;
    if (/\bbattery|\bstorage/.test(text)) return Categories.BATTERY;
    if (/\bnew construction|\bnew home\b/.test(text)) return Categories.NEW_RESIDENTIAL;
    return Categories.OTHER;
  }
}

export class ManualPermitConnector extends BaseConnector {
  metadata(): ConnectorMetadata {
    return {
      id: "manual-permit",
      name: "Manual Permit Import",
      sourceType: "manual_upload",
      jurisdictionIds: [],
      publicAccessConfirmed: true,
    };
  }
  async discover(jurisdiction: Jurisdiction): Promise<DiscoveryResult> {
    return {
      connectorId: this.metadata().id,
      sourceType: this.metadata().sourceType,
      notes: [`Manual import required for ${jurisdiction.name}`],
    };
  }
  async fetchPage(): Promise<RawPermitPage> {
    return { records: [], hasMore: false, sourceFetchedAt: new Date().toISOString() };
  }
  async normalize(record: unknown): Promise<NormalizedPermit> {
    const description = typeof record === "object" && record && "description" in record
      ? String((record as Record<string, unknown>).description ?? "")
      : "";
    return {
      sourceConnector: this.metadata().id,
      sourceRecordId: `manual-${Date.now()}`,
      permitCategory: this.detectCategory(description),
      originalDescription: description,
      normalizedDescription: description,
      rawSource: record,
    };
  }
  async healthCheck(): Promise<ConnectorHealth> {
    return { healthy: true, checkedAt: new Date().toISOString() };
  }
  rateLimit(): RateLimitPolicy {
    return { requestsPerMinute: 30, burst: 5, backoffMs: 500 };
  }
}

export class CsvPermitConnector extends BaseConnector {
  metadata(): ConnectorMetadata {
    return {
      id: "csv-permit",
      name: "CSV Permit Import",
      sourceType: "csv",
      jurisdictionIds: [],
      publicAccessConfirmed: true,
    };
  }
  async discover(jurisdiction: Jurisdiction): Promise<DiscoveryResult> {
    return { connectorId: this.metadata().id, sourceType: this.metadata().sourceType, notes: [jurisdiction.name] };
  }
  async fetchPage(): Promise<RawPermitPage> {
    return { records: [], hasMore: false, sourceFetchedAt: new Date().toISOString() };
  }
  async normalize(record: unknown): Promise<NormalizedPermit> {
    const description = stringifyDescription(record);
    return {
      sourceConnector: this.metadata().id,
      sourceRecordId: `csv-${Date.now()}`,
      permitCategory: this.detectCategory(description),
      originalDescription: description,
      normalizedDescription: description,
      rawSource: record,
    };
  }
  async healthCheck(): Promise<ConnectorHealth> {
    return { healthy: true, checkedAt: new Date().toISOString() };
  }
  rateLimit(): RateLimitPolicy {
    return { requestsPerMinute: 60, burst: 10, backoffMs: 250 };
  }
}

export class ArcGISPermitConnector extends BaseConnector {
  metadata(): ConnectorMetadata {
    return {
      id: "arcgis-permit",
      name: "ArcGIS Permit Connector",
      sourceType: "arcgis",
      jurisdictionIds: [],
      publicAccessConfirmed: true,
    };
  }
  async discover(jurisdiction: Jurisdiction): Promise<DiscoveryResult> {
    return {
      connectorId: this.metadata().id,
      sourceType: this.metadata().sourceType,
      notes: [`ArcGIS discovery for ${jurisdiction.name}`],
    };
  }
  async fetchPage(): Promise<RawPermitPage> {
    return { records: [], hasMore: false, sourceFetchedAt: new Date().toISOString() };
  }
  async normalize(record: unknown): Promise<NormalizedPermit> {
    const description = stringifyDescription(record);
    return {
      sourceConnector: this.metadata().id,
      sourceRecordId: `arcgis-${Date.now()}`,
      permitCategory: this.detectCategory(description),
      originalDescription: description,
      normalizedDescription: description,
      rawSource: record,
    };
  }
  async healthCheck(): Promise<ConnectorHealth> {
    return { healthy: true, checkedAt: new Date().toISOString() };
  }
  rateLimit(): RateLimitPolicy {
    return { requestsPerMinute: 120, burst: 20, backoffMs: 200 };
  }
}

function stringifyDescription(record: unknown): string {
  if (!record || typeof record !== "object") return String(record ?? "");
  const candidate = record as Record<string, unknown>;
  return String(candidate.description ?? candidate.permitDescription ?? candidate.type ?? "");
}
