import type {
  LeadOutcome,
  OpportunityAssessment,
  PermitRecord,
  Property,
  PropertySignal,
  RoofSegment,
  SolarAssessmentAudit,
  SolarFitScoreBreakdown,
  SolarAssessment,
  UsageProfile,
} from "../../contracts/src/index";

export interface SolarRepository {
  upsertProperty(input: PropertyUpsertInput): Promise<Property>;
  getPropertyById(id: string): Promise<Property | null>;
  listProperties(): Promise<Property[]>;
  upsertPropertyDiscovery(input: PropertyDiscoveryUpsertInput): Promise<PropertyDiscoveryRecord>;
  listPropertyDiscoveries(propertyId: string): Promise<PropertyDiscoveryRecord[]>;
  getDiscoveryPropertyMetadata(propertyIds: string[]): Promise<Map<string, DiscoveryPropertyMetadata>>;
  upsertSolarAssessment(input: SolarAssessmentUpsertInput): Promise<SolarAssessment>;
  getSolarAssessmentByPropertyId(propertyId: string): Promise<SolarAssessment | null>;
  upsertSolarAssessmentAudit(input: SolarAssessmentAuditUpsertInput): Promise<SolarAssessmentAuditRecord>;
  getSolarAssessmentAuditByAssessmentId(solarAssessmentId: string): Promise<SolarAssessmentAuditRecord | null>;
  replaceRoofSegments(solarAssessmentId: string, segments: RoofSegment[]): Promise<RoofSegment[]>;
  getRoofSegments(solarAssessmentId: string): Promise<RoofSegment[]>;
  replacePropertySignals(propertyId: string, signals: PropertySignal[]): Promise<PropertySignal[]>;
  listPropertySignals(propertyId: string): Promise<PropertySignal[]>;
  upsertUsageProfile(input: UsageProfileUpsertInput): Promise<UsageProfile>;
  getUsageProfileByPropertyId(propertyId: string): Promise<UsageProfile | null>;
  replacePermitRecords(propertyId: string, records: PermitRecord[]): Promise<PermitRecord[]>;
  upsertLeadOutcome(input: LeadOutcomeUpsertInput): Promise<LeadOutcome>;
  getLeadOutcomeByPropertyId(propertyId: string): Promise<LeadOutcome | null>;
  listLeadOutcomes(): Promise<LeadOutcome[]>;
  upsertOpportunityAssessment(input: OpportunityAssessmentUpsertInput): Promise<OpportunityAssessment>;
  getOpportunityAssessmentByPropertyId(propertyId: string): Promise<OpportunityAssessment | null>;
  listPermits(propertyId: string): Promise<PermitRecord[]>;
  getPermitStats(municipality: string): Promise<PermitStatsResult>;
}

export interface DiscoveryPropertyMetadata {
  latestDiscovery: PropertyDiscoveryRecord | null;
  leadOutcome: LeadOutcome | null;
  usageProfile: UsageProfile | null;
  permits: PermitRecord[];
  propertySignals: PropertySignal[];
  opportunityAssessment: OpportunityAssessment | null;
  solarAssessment: SolarAssessment | null;
}

export interface PropertyUpsertInput extends Omit<Property, "id" | "createdAt" | "updatedAt"> {
  id: string;
  createdAt?: string;
}

export interface SolarAssessmentUpsertInput extends Omit<SolarAssessment, "id" | "createdAt" | "assessedAt"> {
  id: string;
  assessedAt?: string;
  createdAt?: string;
}

export interface SolarAssessmentAuditUpsertInput {
  solarAssessmentId: string;
  auditJson: SolarAssessmentAudit;
  scoreBreakdownJson: SolarFitScoreBreakdown;
  createdAt?: string;
  updatedAt?: string;
}

export interface SolarAssessmentAuditRecord {
  solarAssessmentId: string;
  auditJson: SolarAssessmentAudit;
  scoreBreakdownJson: SolarFitScoreBreakdown;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyDiscoveryUpsertInput {
  id: string;
  propertyId: string;
  provider: string;
  sourceRecordId?: string | null;
  sourceUrl?: string | null;
  retrievedAt?: string;
  confidence: number;
  discoveryJson: unknown;
  createdAt?: string;
}

export interface PropertyDiscoveryRecord {
  id: string;
  propertyId: string;
  provider: string;
  sourceRecordId: string | null;
  sourceUrl: string | null;
  retrievedAt: string;
  confidence: number;
  discoveryJson: unknown;
  createdAt: string;
}

export interface UsageProfileUpsertInput extends Omit<UsageProfile, "id" | "createdAt"> {
  id: string;
  createdAt?: string;
}

export interface LeadOutcomeUpsertInput extends Omit<LeadOutcome, "id" | "createdAt" | "updatedAt"> {
  id: string;
  createdAt?: string;
}

export interface OpportunityAssessmentUpsertInput extends Omit<OpportunityAssessment, "id" | "createdAt"> {
  id: string;
  createdAt?: string;
}

export interface PermitStatsResult {
  municipality: string;
  solarPermits30d: number;
  solarPermits90d: number;
  solarPermits365d: number;
  roofPermits30d: number;
  roofPermits90d: number;
  roofPermits365d: number;
  averageApprovalDays: number | null;
  solarPermitDensity: number;
  recentContractors: string[];
}

export type QueryRow = Record<string, unknown>;

export interface QueryResult<T = QueryRow> {
  rows: T[];
}

export interface SqlClient {
  query<T = QueryRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export class InMemorySolarRepository implements SolarRepository {
  private readonly properties = new Map<string, Property>();
  private readonly propertyDiscoveries = new Map<string, PropertyDiscoveryRecord[]>();
  private readonly solarAssessments = new Map<string, SolarAssessment>();
  private readonly solarAssessmentAudits = new Map<string, SolarAssessmentAuditRecord>();
  private readonly solarAssessmentsByPropertyId = new Map<string, SolarAssessment>();
  private readonly roofSegments = new Map<string, RoofSegment[]>();
  private readonly usageProfiles = new Map<string, UsageProfile>();
  private readonly leadOutcomes = new Map<string, LeadOutcome>();
  private readonly opportunityAssessments = new Map<string, OpportunityAssessment>();
  private readonly permitRecords = new Map<string, PermitRecord[]>();
  private readonly propertySignals = new Map<string, PropertySignal[]>();

  async upsertProperty(input: PropertyUpsertInput): Promise<Property> {
    const now = input.createdAt ?? new Date().toISOString();
    const property: Property = {
      ...input,
      createdAt: input.createdAt ?? this.properties.get(input.id)?.createdAt ?? now,
      updatedAt: now,
    };
    this.properties.set(property.id, property);
    return property;
  }

  async getPropertyById(id: string): Promise<Property | null> {
    return this.properties.get(id) ?? null;
  }

  async listProperties(): Promise<Property[]> {
    return [...this.properties.values()];
  }

  async upsertPropertyDiscovery(input: PropertyDiscoveryUpsertInput): Promise<PropertyDiscoveryRecord> {
    const record: PropertyDiscoveryRecord = {
      id: input.id,
      propertyId: input.propertyId,
      provider: input.provider,
      sourceRecordId: input.sourceRecordId ?? null,
      sourceUrl: input.sourceUrl ?? null,
      retrievedAt: input.retrievedAt ?? new Date().toISOString(),
      confidence: input.confidence,
      discoveryJson: input.discoveryJson,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    const existing = this.propertyDiscoveries.get(record.propertyId) ?? [];
    this.propertyDiscoveries.set(record.propertyId, [record, ...existing.filter((item) => item.id !== record.id)]);
    return record;
  }

  async listPropertyDiscoveries(propertyId: string): Promise<PropertyDiscoveryRecord[]> {
    return this.propertyDiscoveries.get(propertyId) ?? [];
  }

  async getDiscoveryPropertyMetadata(propertyIds: string[]): Promise<Map<string, DiscoveryPropertyMetadata>> {
    const metadata = new Map<string, DiscoveryPropertyMetadata>();
    for (const propertyId of propertyIds) {
      const discoveries = this.propertyDiscoveries.get(propertyId) ?? [];
      metadata.set(propertyId, {
        latestDiscovery: discoveries[0] ?? null,
        leadOutcome: [...this.leadOutcomes.values()].find((item) => item.propertyId === propertyId) ?? null,
        usageProfile: [...this.usageProfiles.values()].find((item) => item.propertyId === propertyId) ?? null,
        permits: this.permitRecords.get(propertyId) ?? [],
        propertySignals: this.propertySignals.get(propertyId) ?? [],
        opportunityAssessment: [...this.opportunityAssessments.values()].find((item) => item.propertyId === propertyId) ?? null,
        solarAssessment: this.solarAssessmentsByPropertyId.get(propertyId) ?? null,
      });
    }
    return metadata;
  }

  async upsertSolarAssessment(input: SolarAssessmentUpsertInput): Promise<SolarAssessment> {
    const now = input.createdAt ?? new Date().toISOString();
    const assessment: SolarAssessment = {
      ...input,
      createdAt: input.createdAt ?? this.solarAssessments.get(input.id)?.createdAt ?? now,
      assessedAt: input.assessedAt ?? new Date().toISOString(),
    };
    this.solarAssessments.set(assessment.id, assessment);
    this.solarAssessmentsByPropertyId.set(assessment.propertyId, assessment);
    return assessment;
  }

  async upsertSolarAssessmentAudit(input: SolarAssessmentAuditUpsertInput): Promise<SolarAssessmentAuditRecord> {
    const now = input.updatedAt ?? input.createdAt ?? new Date().toISOString();
    const record: SolarAssessmentAuditRecord = {
      solarAssessmentId: input.solarAssessmentId,
      auditJson: input.auditJson,
      scoreBreakdownJson: input.scoreBreakdownJson,
      createdAt: input.createdAt ?? this.solarAssessmentAudits.get(input.solarAssessmentId)?.createdAt ?? now,
      updatedAt: now,
    };
    this.solarAssessmentAudits.set(record.solarAssessmentId, record);
    return record;
  }

  async getSolarAssessmentAuditByAssessmentId(solarAssessmentId: string): Promise<SolarAssessmentAuditRecord | null> {
    return this.solarAssessmentAudits.get(solarAssessmentId) ?? null;
  }

  async getSolarAssessmentByPropertyId(propertyId: string): Promise<SolarAssessment | null> {
    return this.solarAssessmentsByPropertyId.get(propertyId) ?? null;
  }

  async replaceRoofSegments(solarAssessmentId: string, segments: RoofSegment[]): Promise<RoofSegment[]> {
    this.roofSegments.set(solarAssessmentId, segments);
    return segments;
  }

  async getRoofSegments(solarAssessmentId: string): Promise<RoofSegment[]> {
    return this.roofSegments.get(solarAssessmentId) ?? [];
  }

  async replacePropertySignals(propertyId: string, signals: PropertySignal[]): Promise<PropertySignal[]> {
    this.propertySignals.set(propertyId, signals);
    return signals;
  }

  async listPropertySignals(propertyId: string): Promise<PropertySignal[]> {
    return this.propertySignals.get(propertyId) ?? [];
  }

  async upsertUsageProfile(input: UsageProfileUpsertInput): Promise<UsageProfile> {
    const profile: UsageProfile = {
      ...input,
      createdAt: input.createdAt ?? this.usageProfiles.get(input.id)?.createdAt ?? new Date().toISOString(),
    };
    this.usageProfiles.set(profile.id, profile);
    return profile;
  }

  async getUsageProfileByPropertyId(propertyId: string): Promise<UsageProfile | null> {
    return [...this.usageProfiles.values()].find((profile) => profile.propertyId === propertyId) ?? null;
  }

  async replacePermitRecords(propertyId: string, records: PermitRecord[]): Promise<PermitRecord[]> {
    this.permitRecords.set(propertyId, records);
    return records;
  }

  async upsertLeadOutcome(input: LeadOutcomeUpsertInput): Promise<LeadOutcome> {
    const outcome: LeadOutcome = {
      ...input,
      createdAt: input.createdAt ?? this.leadOutcomes.get(input.id)?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.leadOutcomes.set(outcome.id, outcome);
    return outcome;
  }

  async getLeadOutcomeByPropertyId(propertyId: string): Promise<LeadOutcome | null> {
    return [...this.leadOutcomes.values()].find((outcome) => outcome.propertyId === propertyId) ?? null;
  }

  async listLeadOutcomes(): Promise<LeadOutcome[]> {
    return [...this.leadOutcomes.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async upsertOpportunityAssessment(input: OpportunityAssessmentUpsertInput): Promise<OpportunityAssessment> {
    const assessment: OpportunityAssessment = {
      ...input,
      createdAt: input.createdAt ?? this.opportunityAssessments.get(input.id)?.createdAt ?? new Date().toISOString(),
    };
    this.opportunityAssessments.set(assessment.id, assessment);
    return assessment;
  }

  async getOpportunityAssessmentByPropertyId(propertyId: string): Promise<OpportunityAssessment | null> {
    return [...this.opportunityAssessments.values()].find((assessment) => assessment.propertyId === propertyId) ?? null;
  }

  async listPermits(propertyId: string): Promise<PermitRecord[]> {
    return this.permitRecords.get(propertyId) ?? [];
  }

  async getPermitStats(municipality: string): Promise<PermitStatsResult> {
    const records = [...this.permitRecords.values()]
      .flat()
      .filter((permit) => permit.municipality.toLowerCase() === municipality.toLowerCase());
    const solar = records.filter((permit) => permit.permitType === "SOLAR");
    const roof = records.filter((permit) => permit.permitType === "ROOF");

    return {
      municipality,
      solarPermits30d: countRecent(solar, 30),
      solarPermits90d: countRecent(solar, 90),
      solarPermits365d: countRecent(solar, 365),
      roofPermits30d: countRecent(roof, 30),
      roofPermits90d: countRecent(roof, 90),
      roofPermits365d: countRecent(roof, 365),
      averageApprovalDays: averageApprovalDays(records),
      solarPermitDensity: solar.length / Math.max(1, records.length),
      recentContractors: uniqueStrings(records.map((permit) => permit.contractorName)),
    };
  }
}

export class PostgresSolarRepository implements SolarRepository {
  private propertiesUpdatedAtSupport: boolean | null = null;

  constructor(private readonly client: SqlClient) {}

  async upsertProperty(input: PropertyUpsertInput): Promise<Property> {
    const now = input.createdAt ?? new Date().toISOString();
    const supportsUpdatedAt = await this.supportsPropertiesUpdatedAt();
    const insertColumns = supportsUpdatedAt
      ? `id, normalized_address, street, city, county, state, postal_code, latitude, longitude, parcel_id, municipality, created_at, updated_at`
      : `id, normalized_address, street, city, county, state, postal_code, latitude, longitude, parcel_id, municipality, created_at`;
    const insertValues = supportsUpdatedAt
      ? `$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12, NOW()), COALESCE($13, NOW())`
      : `$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12, NOW())`;
    const updateClause = supportsUpdatedAt ? `,\n        updated_at = NOW()` : "";
    const returningColumns = supportsUpdatedAt
      ? `
        id,
        normalized_address AS "normalizedAddress",
        street,
        city,
        county,
        state,
        postal_code AS "postalCode",
        latitude,
        longitude,
        parcel_id AS "parcelId",
        municipality,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `
      : `
        id,
        normalized_address AS "normalizedAddress",
        street,
        city,
        county,
        state,
        postal_code AS "postalCode",
        latitude,
        longitude,
        parcel_id AS "parcelId",
        municipality,
        created_at AS "createdAt"
      `;
    const rows = await this.client.query<Property>(
      `
      INSERT INTO properties (
        ${insertColumns}
      ) VALUES (
        ${insertValues}
      )
      ON CONFLICT (id) DO UPDATE SET
        normalized_address = EXCLUDED.normalized_address,
        street = EXCLUDED.street,
        city = EXCLUDED.city,
        county = EXCLUDED.county,
        state = EXCLUDED.state,
        postal_code = EXCLUDED.postal_code,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        parcel_id = EXCLUDED.parcel_id,
        municipality = EXCLUDED.municipality${updateClause}
      RETURNING
        ${returningColumns}
      `,
      supportsUpdatedAt
        ? [
            input.id,
            input.normalizedAddress,
            input.street ?? null,
            input.city ?? null,
            input.county ?? null,
            input.state ?? null,
            input.postalCode ?? null,
            input.latitude ?? null,
            input.longitude ?? null,
            input.parcelId ?? null,
            input.municipality ?? null,
            input.createdAt ?? null,
            now,
          ]
        : [
            input.id,
            input.normalizedAddress,
            input.street ?? null,
            input.city ?? null,
            input.county ?? null,
            input.state ?? null,
            input.postalCode ?? null,
            input.latitude ?? null,
            input.longitude ?? null,
            input.parcelId ?? null,
            input.municipality ?? null,
            input.createdAt ?? null,
          ],
    );
    return normalizePropertyRow(rows.rows[0]);
  }

  async getPropertyById(id: string): Promise<Property | null> {
    const supportsUpdatedAt = await this.supportsPropertiesUpdatedAt();
    const rows = await this.client.query<Property>(
      `
      SELECT
        id,
        normalized_address AS "normalizedAddress",
        street,
        city,
        county,
        state,
        postal_code AS "postalCode",
        latitude,
        longitude,
        parcel_id AS "parcelId",
        municipality,
        created_at AS "createdAt",
        ${supportsUpdatedAt ? `updated_at AS "updatedAt"` : `created_at AS "updatedAt"`}
      FROM properties
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );
    return rows.rows.length > 0 ? normalizePropertyRow(rows.rows[0]) : null;
  }

  async listProperties(): Promise<Property[]> {
    const supportsUpdatedAt = await this.supportsPropertiesUpdatedAt();
    const rows = await this.client.query<Property>(
      `
      SELECT
        id,
        normalized_address AS "normalizedAddress",
        street,
        city,
        county,
        state,
        postal_code AS "postalCode",
        latitude,
        longitude,
        parcel_id AS "parcelId",
        municipality,
        created_at AS "createdAt",
        ${supportsUpdatedAt ? `updated_at AS "updatedAt"` : `created_at AS "updatedAt"`}
      FROM properties
      ORDER BY ${supportsUpdatedAt ? `updated_at DESC, created_at DESC` : `created_at DESC`}
      `,
    );
    return rows.rows.map(normalizePropertyRow);
  }

  async upsertPropertyDiscovery(input: PropertyDiscoveryUpsertInput): Promise<PropertyDiscoveryRecord> {
    const rows = await this.client.query<PropertyDiscoveryRecord>(
      `
      INSERT INTO property_discoveries (
        id, property_id, provider, source_record_id, source_url, retrieved_at, confidence, discovery_json, created_at
      ) VALUES ($1,$2,$3,$4,$5,COALESCE($6, NOW()),$7,$8,COALESCE($9, NOW()))
      ON CONFLICT (id) DO UPDATE SET
        provider = EXCLUDED.provider,
        source_record_id = EXCLUDED.source_record_id,
        source_url = EXCLUDED.source_url,
        retrieved_at = EXCLUDED.retrieved_at,
        confidence = EXCLUDED.confidence,
        discovery_json = EXCLUDED.discovery_json
      RETURNING
        id,
        property_id AS "propertyId",
        provider,
        source_record_id AS "sourceRecordId",
        source_url AS "sourceUrl",
        retrieved_at AS "retrievedAt",
        confidence,
        discovery_json AS "discoveryJson",
        created_at AS "createdAt"
      `,
      [
        input.id,
        input.propertyId,
        input.provider,
        input.sourceRecordId ?? null,
        input.sourceUrl ?? null,
        input.retrievedAt ?? null,
        input.confidence,
        JSON.stringify(input.discoveryJson),
        input.createdAt ?? null,
      ],
    );
    return {
      ...rows.rows[0],
      confidence: coerceNumber(rows.rows[0].confidence) ?? 0,
    };
  }

  private async supportsPropertiesUpdatedAt(): Promise<boolean> {
    if (this.propertiesUpdatedAtSupport != null) {
      return this.propertiesUpdatedAtSupport;
    }
    const rows = await this.client.query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'properties'
          AND column_name = 'updated_at'
      ) AS exists
      `,
    );
    this.propertiesUpdatedAtSupport = Boolean(rows.rows[0]?.exists);
    return this.propertiesUpdatedAtSupport;
  }

  async listPropertyDiscoveries(propertyId: string): Promise<PropertyDiscoveryRecord[]> {
    const rows = await this.client.query<PropertyDiscoveryRecord>(
      `
      SELECT
        id,
        property_id AS "propertyId",
        provider,
        source_record_id AS "sourceRecordId",
        source_url AS "sourceUrl",
        retrieved_at AS "retrievedAt",
        confidence,
        discovery_json AS "discoveryJson",
        created_at AS "createdAt"
      FROM property_discoveries
      WHERE property_id = $1
      ORDER BY retrieved_at DESC, created_at DESC
      `,
      [propertyId],
    );
    return rows.rows.map((row) => ({
      ...row,
      confidence: coerceNumber(row.confidence) ?? 0,
    }));
  }

  async getDiscoveryPropertyMetadata(propertyIds: string[]): Promise<Map<string, DiscoveryPropertyMetadata>> {
    const metadata = new Map<string, DiscoveryPropertyMetadata>();
    for (const propertyId of propertyIds) {
      metadata.set(propertyId, {
        latestDiscovery: null,
        leadOutcome: null,
        usageProfile: null,
        permits: [],
        propertySignals: [],
        opportunityAssessment: null,
        solarAssessment: null,
      });
    }
    if (propertyIds.length === 0) {
      return metadata;
    }

    const [discoveries, outcomes, usageProfiles, permits, signals, opportunities, assessments] = await Promise.all([
      this.client.query<PropertyDiscoveryRecord>(
        `
        SELECT DISTINCT ON (property_id)
          id,
          property_id AS "propertyId",
          provider,
          source_record_id AS "sourceRecordId",
          source_url AS "sourceUrl",
          retrieved_at AS "retrievedAt",
          confidence,
          discovery_json AS "discoveryJson",
          created_at AS "createdAt"
        FROM property_discoveries
        WHERE property_id = ANY($1::uuid[])
        ORDER BY property_id, retrieved_at DESC, created_at DESC
        `,
        [propertyIds],
      ),
      this.client.query<LeadOutcome>(
        `
        SELECT DISTINCT ON (property_id)
          id,
          property_id AS "propertyId",
          rep_id AS "repId",
          outcome,
          notes,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM lead_outcomes
        WHERE property_id = ANY($1::uuid[])
        ORDER BY property_id, updated_at DESC, created_at DESC
        `,
        [propertyIds],
      ),
      this.client.query<UsageProfile>(
        `
        SELECT DISTINCT ON (property_id)
          id,
          property_id AS "propertyId",
          source,
          annual_usage_kwh AS "annualUsageKwh",
          monthly_average_kwh AS "monthlyAverageKwh",
          peak_month_kwh AS "peakMonthKwh",
          monthly_bill_average AS "monthlyBillAverage",
          confidence,
          created_at AS "createdAt"
        FROM usage_profiles
        WHERE property_id = ANY($1::uuid[])
        ORDER BY property_id, created_at DESC
        `,
        [propertyIds],
      ),
      this.client.query<PermitRecord>(
        `
        SELECT
          id,
          property_id AS "propertyId",
          municipality,
          county,
          state,
          permit_number AS "permitNumber",
          permit_type AS "permitType",
          status,
          application_date AS "applicationDate",
          issued_date AS "issuedDate",
          contractor_name AS "contractorName",
          source_provider AS "sourceProvider",
          source_url AS "sourceUrl",
          confidence,
          retrieved_at AS "retrievedAt"
        FROM permit_records
        WHERE property_id = ANY($1::uuid[])
        ORDER BY property_id, COALESCE(issued_date, application_date, retrieved_at) DESC
        `,
        [propertyIds],
      ),
      this.client.query<PropertySignal>(
        `
        SELECT
          id,
          property_id AS "propertyId",
          signal_type AS "signalType",
          source,
          value_json AS "valueJson",
          confidence,
          observed_at AS "observedAt",
          expires_at AS "expiresAt"
        FROM property_signals
        WHERE property_id = ANY($1::uuid[])
        ORDER BY property_id, observed_at DESC
        `,
        [propertyIds],
      ),
      this.client.query<OpportunityAssessment>(
        `
        SELECT DISTINCT ON (property_id)
          id,
          property_id AS "propertyId",
          solar_fit_score AS "solarFitScore",
          usage_opportunity_score AS "usageOpportunityScore",
          system_size_score AS "systemSizeScore",
          permit_signal_score AS "permitSignalScore",
          field_priority_score AS "fieldPriorityScore",
          whale_score AS "whaleScore",
          overall_opportunity_score AS "overallOpportunityScore",
          confidence,
          score_version AS "scoreVersion",
          explanation_json AS "explanationJson",
          created_at AS "createdAt"
        FROM opportunity_assessments
        WHERE property_id = ANY($1::uuid[])
        ORDER BY property_id, created_at DESC
        `,
        [propertyIds],
      ),
      this.client.query<SolarAssessment>(
        `
        SELECT DISTINCT ON (property_id)
          id,
          property_id AS "propertyId",
          provider,
          provider_building_id AS "providerBuildingId",
          imagery_date AS "imageryDate",
          imagery_processed_date AS "imageryProcessedDate",
          imagery_quality AS "imageryQuality",
          roof_area_meters2 AS "roofAreaMeters2",
          ground_area_meters2 AS "groundAreaMeters2",
          max_array_area_meters2 AS "maxArrayAreaMeters2",
          max_array_panels_count AS "maxArrayPanelsCount",
          panel_capacity_watts AS "panelCapacityWatts",
          max_sunshine_hours_per_year AS "maxSunshineHoursPerYear",
          estimated_max_system_kw AS "estimatedMaxSystemKw",
          estimated_annual_production_kwh AS "estimatedAnnualProductionKwh",
          existing_solar_status AS "existingSolarStatus",
          existing_solar_confidence AS "existingSolarConfidence",
          roof_complexity_score AS "roofComplexityScore",
          shade_score AS "shadeScore",
          orientation_score AS "orientationScore",
          solar_fit_score AS "solarFitScore",
          solar_fit_confidence AS "solarFitConfidence",
          assessment_version AS "assessmentVersion",
          provider_payload_reference AS "providerPayloadReference",
          assessed_at AS "assessedAt",
          created_at AS "createdAt"
        FROM solar_assessments
        WHERE property_id = ANY($1::uuid[])
        ORDER BY property_id, assessed_at DESC, created_at DESC
        `,
        [propertyIds],
      ),
    ]);

    for (const row of discoveries.rows) {
      const item = metadata.get(row.propertyId);
      if (item) item.latestDiscovery = { ...row, confidence: coerceNumber(row.confidence) ?? 0 };
    }
    for (const row of outcomes.rows) {
      const item = metadata.get(row.propertyId);
      if (item) item.leadOutcome = normalizeLeadOutcomeRow(row);
    }
    for (const row of usageProfiles.rows) {
      const item = metadata.get(row.propertyId);
      if (item) item.usageProfile = normalizeUsageProfileRow(row);
    }
    for (const row of permits.rows) {
      const item = metadata.get(row.propertyId ?? "");
      if (item) item.permits.push({ ...row, confidence: coerceNumber(row.confidence) ?? 0 });
    }
    for (const row of signals.rows) {
      const item = metadata.get(row.propertyId);
      if (item) item.propertySignals.push({ ...row, confidence: coerceNumber(row.confidence) ?? 0 });
    }
    for (const row of opportunities.rows) {
      const item = metadata.get(row.propertyId);
      if (item) item.opportunityAssessment = normalizeOpportunityAssessmentRow(row);
    }
    for (const row of assessments.rows) {
      const item = metadata.get(row.propertyId);
      if (item) item.solarAssessment = normalizeSolarAssessmentRow(row);
    }
    return metadata;
  }

  async upsertSolarAssessment(input: SolarAssessmentUpsertInput): Promise<SolarAssessment> {
    const rows = await this.client.query<SolarAssessment>(
      `
      INSERT INTO solar_assessments (
        id, property_id, provider, provider_building_id, imagery_date, imagery_processed_date, imagery_quality,
        roof_area_meters2, ground_area_meters2, max_array_area_meters2, max_array_panels_count,
        panel_capacity_watts, max_sunshine_hours_per_year, estimated_max_system_kw,
        estimated_annual_production_kwh, existing_solar_status, existing_solar_confidence,
        roof_complexity_score, shade_score, orientation_score, solar_fit_score,
        solar_fit_confidence, assessment_version, provider_payload_reference, assessed_at, created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
        $22,$23,$24,COALESCE($25, NOW()), COALESCE($26, NOW())
      )
      ON CONFLICT (id) DO UPDATE SET
        provider = EXCLUDED.provider,
        provider_building_id = EXCLUDED.provider_building_id,
        imagery_date = EXCLUDED.imagery_date,
        imagery_processed_date = EXCLUDED.imagery_processed_date,
        imagery_quality = EXCLUDED.imagery_quality,
        roof_area_meters2 = EXCLUDED.roof_area_meters2,
        ground_area_meters2 = EXCLUDED.ground_area_meters2,
        max_array_area_meters2 = EXCLUDED.max_array_area_meters2,
        max_array_panels_count = EXCLUDED.max_array_panels_count,
        panel_capacity_watts = EXCLUDED.panel_capacity_watts,
        max_sunshine_hours_per_year = EXCLUDED.max_sunshine_hours_per_year,
        estimated_max_system_kw = EXCLUDED.estimated_max_system_kw,
        estimated_annual_production_kwh = EXCLUDED.estimated_annual_production_kwh,
        existing_solar_status = EXCLUDED.existing_solar_status,
        existing_solar_confidence = EXCLUDED.existing_solar_confidence,
        roof_complexity_score = EXCLUDED.roof_complexity_score,
        shade_score = EXCLUDED.shade_score,
        orientation_score = EXCLUDED.orientation_score,
        solar_fit_score = EXCLUDED.solar_fit_score,
        solar_fit_confidence = EXCLUDED.solar_fit_confidence,
        assessment_version = EXCLUDED.assessment_version,
        provider_payload_reference = EXCLUDED.provider_payload_reference,
        assessed_at = EXCLUDED.assessed_at
      RETURNING
        id,
        property_id AS "propertyId",
        provider,
        provider_building_id AS "providerBuildingId",
        imagery_date AS "imageryDate",
        imagery_processed_date AS "imageryProcessedDate",
        imagery_quality AS "imageryQuality",
        roof_area_meters2 AS "roofAreaMeters2",
        ground_area_meters2 AS "groundAreaMeters2",
        max_array_area_meters2 AS "maxArrayAreaMeters2",
        max_array_panels_count AS "maxArrayPanelsCount",
        panel_capacity_watts AS "panelCapacityWatts",
        max_sunshine_hours_per_year AS "maxSunshineHoursPerYear",
        estimated_max_system_kw AS "estimatedMaxSystemKw",
        estimated_annual_production_kwh AS "estimatedAnnualProductionKwh",
        existing_solar_status AS "existingSolarStatus",
        existing_solar_confidence AS "existingSolarConfidence",
        roof_complexity_score AS "roofComplexityScore",
        shade_score AS "shadeScore",
        orientation_score AS "orientationScore",
        solar_fit_score AS "solarFitScore",
        solar_fit_confidence AS "solarFitConfidence",
        assessment_version AS "assessmentVersion",
        provider_payload_reference AS "providerPayloadReference",
        assessed_at AS "assessedAt",
        created_at AS "createdAt"
      `,
      [
        input.id,
        input.propertyId,
        input.provider,
        input.providerBuildingId ?? null,
        input.imageryDate ?? null,
        input.imageryProcessedDate ?? null,
        input.imageryQuality ?? null,
        input.roofAreaMeters2 ?? null,
        input.groundAreaMeters2 ?? null,
        input.maxArrayAreaMeters2 ?? null,
        input.maxArrayPanelsCount ?? null,
        input.panelCapacityWatts ?? null,
        input.maxSunshineHoursPerYear ?? null,
        input.estimatedMaxSystemKw ?? null,
        input.estimatedAnnualProductionKwh ?? null,
        input.existingSolarStatus,
        input.existingSolarConfidence ?? null,
        input.roofComplexityScore ?? null,
        input.shadeScore ?? null,
        input.orientationScore ?? null,
        input.solarFitScore,
        input.solarFitConfidence,
        input.assessmentVersion,
        input.providerPayloadReference ?? null,
        input.assessedAt ?? null,
        input.createdAt ?? null,
      ],
    );
    return normalizeSolarAssessmentRow(rows.rows[0]);
  }

  async upsertSolarAssessmentAudit(input: SolarAssessmentAuditUpsertInput): Promise<SolarAssessmentAuditRecord> {
    const rows = await this.client.query<SolarAssessmentAuditRecord>(
      `
      INSERT INTO solar_assessment_audits (
        solar_assessment_id, audit_json, score_breakdown_json, created_at, updated_at
      ) VALUES ($1,$2,$3,COALESCE($4, NOW()), COALESCE($5, NOW()))
      ON CONFLICT (solar_assessment_id) DO UPDATE SET
        audit_json = EXCLUDED.audit_json,
        score_breakdown_json = EXCLUDED.score_breakdown_json,
        updated_at = NOW()
      RETURNING
        solar_assessment_id AS "solarAssessmentId",
        audit_json AS "auditJson",
        score_breakdown_json AS "scoreBreakdownJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [
        input.solarAssessmentId,
        JSON.stringify(input.auditJson),
        JSON.stringify(input.scoreBreakdownJson),
        input.createdAt ?? null,
        input.updatedAt ?? null,
      ],
    );
    return rows.rows[0];
  }

  async getSolarAssessmentAuditByAssessmentId(solarAssessmentId: string): Promise<SolarAssessmentAuditRecord | null> {
    const rows = await this.client.query<SolarAssessmentAuditRecord>(
      `
      SELECT
        solar_assessment_id AS "solarAssessmentId",
        audit_json AS "auditJson",
        score_breakdown_json AS "scoreBreakdownJson",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM solar_assessment_audits
      WHERE solar_assessment_id = $1
      LIMIT 1
      `,
      [solarAssessmentId],
    );
    return rows.rows.length > 0 ? rows.rows[0] : null;
  }

  async getSolarAssessmentByPropertyId(propertyId: string): Promise<SolarAssessment | null> {
    const rows = await this.client.query<SolarAssessment>(
      `
      SELECT
        id,
        property_id AS "propertyId",
        provider,
        provider_building_id AS "providerBuildingId",
        imagery_date AS "imageryDate",
        imagery_quality AS "imageryQuality",
        roof_area_meters2 AS "roofAreaMeters2",
        ground_area_meters2 AS "groundAreaMeters2",
        max_array_area_meters2 AS "maxArrayAreaMeters2",
        max_array_panels_count AS "maxArrayPanelsCount",
        panel_capacity_watts AS "panelCapacityWatts",
        max_sunshine_hours_per_year AS "maxSunshineHoursPerYear",
        estimated_max_system_kw AS "estimatedMaxSystemKw",
        estimated_annual_production_kwh AS "estimatedAnnualProductionKwh",
        existing_solar_status AS "existingSolarStatus",
        existing_solar_confidence AS "existingSolarConfidence",
        roof_complexity_score AS "roofComplexityScore",
        shade_score AS "shadeScore",
        orientation_score AS "orientationScore",
        solar_fit_score AS "solarFitScore",
        solar_fit_confidence AS "solarFitConfidence",
        assessment_version AS "assessmentVersion",
        provider_payload_reference AS "providerPayloadReference",
        assessed_at AS "assessedAt",
        created_at AS "createdAt"
      FROM solar_assessments
      WHERE property_id = $1
      ORDER BY assessed_at DESC, created_at DESC
      LIMIT 1
      `,
      [propertyId],
    );
    return rows.rows.length > 0 ? normalizeSolarAssessmentRow(rows.rows[0]) : null;
  }

  async replaceRoofSegments(solarAssessmentId: string, segments: RoofSegment[]): Promise<RoofSegment[]> {
    await this.client.query(`DELETE FROM roof_segments WHERE solar_assessment_id = $1`, [solarAssessmentId]);
    for (const segment of segments) {
      await this.client.query(
        `
        INSERT INTO roof_segments (
          id, solar_assessment_id, segment_index, area_meters2, pitch_degrees, azimuth_degrees,
          sunshine_hours, panels_count, yearly_energy_dc_kwh
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          segment.id,
          segment.solarAssessmentId,
          segment.segmentIndex,
          segment.areaMeters2 ?? null,
          segment.pitchDegrees ?? null,
          segment.azimuthDegrees ?? null,
          segment.sunshineHours ?? null,
          segment.panelsCount ?? null,
          segment.yearlyEnergyDcKwh ?? null,
        ],
      );
    }
    return segments;
  }

  async getRoofSegments(solarAssessmentId: string): Promise<RoofSegment[]> {
    const rows = await this.client.query<RoofSegment>(
      `
      SELECT
        id,
        solar_assessment_id AS "solarAssessmentId",
        segment_index AS "segmentIndex",
        area_meters2 AS "areaMeters2",
        pitch_degrees AS "pitchDegrees",
        azimuth_degrees AS "azimuthDegrees",
        sunshine_hours AS "sunshineHours",
        panels_count AS "panelsCount",
        yearly_energy_dc_kwh AS "yearlyEnergyDcKwh"
      FROM roof_segments
      WHERE solar_assessment_id = $1
      ORDER BY segment_index ASC
      `,
      [solarAssessmentId],
    );
    return rows.rows.map((row) => ({
      ...row,
      areaMeters2: coerceNumber(row.areaMeters2),
      pitchDegrees: coerceNumber(row.pitchDegrees),
      azimuthDegrees: coerceNumber(row.azimuthDegrees),
      sunshineHours: coerceNumber(row.sunshineHours),
      panelsCount: coerceInteger(row.panelsCount),
      yearlyEnergyDcKwh: coerceNumber(row.yearlyEnergyDcKwh),
    }));
  }

  async replacePropertySignals(propertyId: string, signals: PropertySignal[]): Promise<PropertySignal[]> {
    await this.client.query(`DELETE FROM property_signals WHERE property_id = $1`, [propertyId]);
    for (const signal of signals) {
      await this.client.query(
        `
        INSERT INTO property_signals (
          id, property_id, signal_type, source, value_json, confidence, observed_at, expires_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [
          signal.id,
          signal.propertyId,
          signal.signalType,
          signal.source,
          JSON.stringify(signal.valueJson),
          signal.confidence,
          signal.observedAt,
          signal.expiresAt ?? null,
        ],
      );
    }
    return signals;
  }

  async listPropertySignals(propertyId: string): Promise<PropertySignal[]> {
    const rows = await this.client.query<PropertySignal>(
      `
      SELECT
        id,
        property_id AS "propertyId",
        signal_type AS "signalType",
        source,
        value_json AS "valueJson",
        confidence,
        observed_at AS "observedAt",
        expires_at AS "expiresAt"
      FROM property_signals
      WHERE property_id = $1
      ORDER BY observed_at DESC
      `,
      [propertyId],
    );
    return rows.rows.map((row) => ({
      ...row,
      confidence: coerceNumber(row.confidence) ?? 0,
    }));
  }

  async upsertUsageProfile(input: UsageProfileUpsertInput): Promise<UsageProfile> {
    const rows = await this.client.query<UsageProfile>(
      `
      INSERT INTO usage_profiles (
        id, property_id, source, annual_usage_kwh, monthly_average_kwh, peak_month_kwh,
        monthly_bill_average, confidence, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9, NOW()))
      ON CONFLICT (id) DO UPDATE SET
        source = EXCLUDED.source,
        annual_usage_kwh = EXCLUDED.annual_usage_kwh,
        monthly_average_kwh = EXCLUDED.monthly_average_kwh,
        peak_month_kwh = EXCLUDED.peak_month_kwh,
        monthly_bill_average = EXCLUDED.monthly_bill_average,
        confidence = EXCLUDED.confidence
      RETURNING
        id,
        property_id AS "propertyId",
        source,
        annual_usage_kwh AS "annualUsageKwh",
        monthly_average_kwh AS "monthlyAverageKwh",
        peak_month_kwh AS "peakMonthKwh",
        monthly_bill_average AS "monthlyBillAverage",
        confidence,
        created_at AS "createdAt"
      `,
      [
        input.id,
        input.propertyId,
        input.source,
        input.annualUsageKwh ?? null,
        input.monthlyAverageKwh ?? null,
        input.peakMonthKwh ?? null,
        input.monthlyBillAverage ?? null,
        input.confidence,
        input.createdAt ?? null,
      ],
    );
    return normalizeUsageProfileRow(rows.rows[0]);
  }

  async getUsageProfileByPropertyId(propertyId: string): Promise<UsageProfile | null> {
    const rows = await this.client.query<UsageProfile>(
      `
      SELECT
        id,
        property_id AS "propertyId",
        source,
        annual_usage_kwh AS "annualUsageKwh",
        monthly_average_kwh AS "monthlyAverageKwh",
        peak_month_kwh AS "peakMonthKwh",
        monthly_bill_average AS "monthlyBillAverage",
        confidence,
        created_at AS "createdAt"
      FROM usage_profiles
      WHERE property_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [propertyId],
    );
    return rows.rows.length > 0 ? normalizeUsageProfileRow(rows.rows[0]) : null;
  }

  async replacePermitRecords(propertyId: string, records: PermitRecord[]): Promise<PermitRecord[]> {
    await this.client.query(`DELETE FROM permit_records WHERE property_id = $1`, [propertyId]);
    for (const record of records) {
      await this.client.query(
        `
        INSERT INTO permit_records (
          id, property_id, municipality, county, state, permit_number, permit_type, status,
          application_date, issued_date, contractor_name, source_provider, source_url, confidence, retrieved_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `,
        [
          record.id,
          record.propertyId ?? null,
          record.municipality,
          record.county,
          record.state,
          record.permitNumber ?? null,
          record.permitType,
          record.status,
          record.applicationDate ?? null,
          record.issuedDate ?? null,
          record.contractorName ?? null,
          record.sourceProvider,
          record.sourceUrl ?? null,
          record.confidence,
          record.retrievedAt,
        ],
      );
    }
    return records;
  }

  async upsertLeadOutcome(input: LeadOutcomeUpsertInput): Promise<LeadOutcome> {
    const rows = await this.client.query<LeadOutcome>(
      `
      INSERT INTO lead_outcomes (id, property_id, rep_id, outcome, notes, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,COALESCE($6, NOW()), NOW())
      ON CONFLICT (id) DO UPDATE SET
        rep_id = EXCLUDED.rep_id,
        outcome = EXCLUDED.outcome,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING
        id,
        property_id AS "propertyId",
        rep_id AS "repId",
        outcome,
        notes,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      `,
      [input.id, input.propertyId, input.repId ?? null, input.outcome, input.notes ?? null, input.createdAt ?? null],
    );
    return normalizeLeadOutcomeRow(rows.rows[0]);
  }

  async getLeadOutcomeByPropertyId(propertyId: string): Promise<LeadOutcome | null> {
    const rows = await this.client.query<LeadOutcome>(
      `
      SELECT
        id,
        property_id AS "propertyId",
        rep_id AS "repId",
        outcome,
        notes,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM lead_outcomes
      WHERE property_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [propertyId],
    );
    return rows.rows.length > 0 ? normalizeLeadOutcomeRow(rows.rows[0]) : null;
  }

  async listLeadOutcomes(): Promise<LeadOutcome[]> {
    const rows = await this.client.query<LeadOutcome>(
      `
      SELECT
        id,
        property_id AS "propertyId",
        rep_id AS "repId",
        outcome,
        notes,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM lead_outcomes
      ORDER BY updated_at DESC, created_at DESC
      `,
    );
    return rows.rows.map(normalizeLeadOutcomeRow);
  }

  async upsertOpportunityAssessment(input: OpportunityAssessmentUpsertInput): Promise<OpportunityAssessment> {
    const rows = await this.client.query<OpportunityAssessment>(
      `
      INSERT INTO opportunity_assessments (
        id, property_id, solar_fit_score, usage_opportunity_score, system_size_score,
        permit_signal_score, field_priority_score, whale_score, overall_opportunity_score,
        confidence, score_version, explanation_json, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13, NOW()))
      ON CONFLICT (id) DO UPDATE SET
        solar_fit_score = EXCLUDED.solar_fit_score,
        usage_opportunity_score = EXCLUDED.usage_opportunity_score,
        system_size_score = EXCLUDED.system_size_score,
        permit_signal_score = EXCLUDED.permit_signal_score,
        field_priority_score = EXCLUDED.field_priority_score,
        whale_score = EXCLUDED.whale_score,
        overall_opportunity_score = EXCLUDED.overall_opportunity_score,
        confidence = EXCLUDED.confidence,
        score_version = EXCLUDED.score_version,
        explanation_json = EXCLUDED.explanation_json
      RETURNING
        id,
        property_id AS "propertyId",
        solar_fit_score AS "solarFitScore",
        usage_opportunity_score AS "usageOpportunityScore",
        system_size_score AS "systemSizeScore",
        permit_signal_score AS "permitSignalScore",
        field_priority_score AS "fieldPriorityScore",
        whale_score AS "whaleScore",
        overall_opportunity_score AS "overallOpportunityScore",
        confidence,
        score_version AS "scoreVersion",
        explanation_json AS "explanationJson",
        created_at AS "createdAt"
      `,
      [
        input.id,
        input.propertyId,
        input.solarFitScore,
        input.usageOpportunityScore,
        input.systemSizeScore,
        input.permitSignalScore,
        input.fieldPriorityScore,
        input.whaleScore,
        input.overallOpportunityScore,
        input.confidence,
        input.scoreVersion,
        JSON.stringify(input.explanationJson),
        input.createdAt ?? null,
      ],
    );
    return normalizeOpportunityAssessmentRow(rows.rows[0]);
  }

  async getOpportunityAssessmentByPropertyId(propertyId: string): Promise<OpportunityAssessment | null> {
    const rows = await this.client.query<OpportunityAssessment>(
      `
      SELECT
        id,
        property_id AS "propertyId",
        solar_fit_score AS "solarFitScore",
        usage_opportunity_score AS "usageOpportunityScore",
        system_size_score AS "systemSizeScore",
        permit_signal_score AS "permitSignalScore",
        field_priority_score AS "fieldPriorityScore",
        whale_score AS "whaleScore",
        overall_opportunity_score AS "overallOpportunityScore",
        confidence,
        score_version AS "scoreVersion",
        explanation_json AS "explanationJson",
        created_at AS "createdAt"
      FROM opportunity_assessments
      WHERE property_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [propertyId],
    );
    return rows.rows.length > 0 ? normalizeOpportunityAssessmentRow(rows.rows[0]) : null;
  }

  async listPermits(propertyId: string): Promise<PermitRecord[]> {
    const rows = await this.client.query<PermitRecord>(
      `
      SELECT
        id,
        property_id AS "propertyId",
        municipality,
        county,
        state,
        permit_number AS "permitNumber",
        permit_type AS "permitType",
        status,
        application_date AS "applicationDate",
        issued_date AS "issuedDate",
        contractor_name AS "contractorName",
        source_provider AS "sourceProvider",
        source_url AS "sourceUrl",
        confidence,
        retrieved_at AS "retrievedAt"
      FROM permit_records
      WHERE property_id = $1
      ORDER BY COALESCE(issued_date, application_date, retrieved_at) DESC
      `,
      [propertyId],
    );
    return rows.rows;
  }

  async getPermitStats(municipality: string): Promise<PermitStatsResult> {
    const rows = await this.client.query<{
      permit_type: string;
      status: string;
      issued_date: string | null;
      application_date: string | null;
      contractor_name: string | null;
    }>(
      `
      SELECT permit_type, status, issued_date, application_date, contractor_name
      FROM permit_records
      WHERE LOWER(municipality) = LOWER($1)
      `,
      [municipality],
    );
    const records = rows.rows.map((row) => ({
      permitType: row.permit_type,
      status: row.status,
      issuedDate: row.issued_date,
      applicationDate: row.application_date,
      contractorName: row.contractor_name,
    })) as PermitRecord[];
    const solar = records.filter((permit) => permit.permitType === "SOLAR");
    const roof = records.filter((permit) => permit.permitType === "ROOF");
    return {
      municipality,
      solarPermits30d: countRecent(solar, 30),
      solarPermits90d: countRecent(solar, 90),
      solarPermits365d: countRecent(solar, 365),
      roofPermits30d: countRecent(roof, 30),
      roofPermits90d: countRecent(roof, 90),
      roofPermits365d: countRecent(roof, 365),
      averageApprovalDays: averageApprovalDays(records),
      solarPermitDensity: solar.length / Math.max(1, records.length),
      recentContractors: uniqueStrings(records.map((permit) => permit.contractorName)),
    };
  }
}

function normalizePropertyRow(row: Property): Property {
  return {
    ...row,
    latitude: coerceNumber(row.latitude),
    longitude: coerceNumber(row.longitude),
  };
}

function normalizeSolarAssessmentRow(row: SolarAssessment): SolarAssessment {
  return {
    ...row,
    roofAreaMeters2: coerceNumber(row.roofAreaMeters2),
    groundAreaMeters2: coerceNumber(row.groundAreaMeters2),
    maxArrayAreaMeters2: coerceNumber(row.maxArrayAreaMeters2),
    maxArrayPanelsCount: coerceInteger(row.maxArrayPanelsCount),
    panelCapacityWatts: coerceInteger(row.panelCapacityWatts),
    maxSunshineHoursPerYear: coerceNumber(row.maxSunshineHoursPerYear),
    estimatedMaxSystemKw: coerceNumber(row.estimatedMaxSystemKw),
    estimatedAnnualProductionKwh: coerceNumber(row.estimatedAnnualProductionKwh),
    existingSolarConfidence: coerceNumber(row.existingSolarConfidence),
    roofComplexityScore: coerceNumber(row.roofComplexityScore),
    shadeScore: coerceNumber(row.shadeScore),
    orientationScore: coerceNumber(row.orientationScore),
    solarFitScore: coerceNumber(row.solarFitScore) ?? 0,
    solarFitConfidence: coerceNumber(row.solarFitConfidence) ?? 0,
    imageryProcessedDate: typeof row.imageryProcessedDate === "string" ? row.imageryProcessedDate : null,
  };
}

function normalizeUsageProfileRow(row: UsageProfile): UsageProfile {
  return {
    ...row,
    annualUsageKwh: coerceNumber(row.annualUsageKwh),
    monthlyAverageKwh: coerceNumber(row.monthlyAverageKwh),
    peakMonthKwh: coerceNumber(row.peakMonthKwh),
    monthlyBillAverage: coerceNumber(row.monthlyBillAverage),
    confidence: coerceNumber(row.confidence) ?? 0,
  };
}

function normalizeLeadOutcomeRow(row: LeadOutcome): LeadOutcome {
  return {
    ...row,
    repId: row.repId ?? null,
    notes: row.notes ?? null,
    updatedAt: row.updatedAt ?? row.createdAt,
  };
}

function normalizeOpportunityAssessmentRow(row: OpportunityAssessment): OpportunityAssessment {
  return {
    ...row,
    solarFitScore: coerceNumber(row.solarFitScore) ?? 0,
    usageOpportunityScore: coerceNumber(row.usageOpportunityScore) ?? 0,
    systemSizeScore: coerceNumber(row.systemSizeScore) ?? 0,
    permitSignalScore: coerceNumber(row.permitSignalScore) ?? 0,
    fieldPriorityScore: coerceNumber(row.fieldPriorityScore) ?? 0,
    whaleScore: coerceNumber(row.whaleScore) ?? 0,
    overallOpportunityScore: coerceNumber(row.overallOpportunityScore) ?? 0,
    confidence: coerceNumber(row.confidence) ?? 0,
  };
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function coerceInteger(value: unknown): number | null {
  const numeric = coerceNumber(value);
  return numeric == null ? null : Math.trunc(numeric);
}

function countRecent(records: PermitRecord[], days: number): number {
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return records.filter((record) => {
    const value = record.issuedDate ?? record.applicationDate;
    return value ? new Date(value).getTime() >= threshold : false;
  }).length;
}

function averageApprovalDays(records: PermitRecord[]): number | null {
  const durations = records
    .filter((record) => record.applicationDate && record.issuedDate)
    .map((record) => {
      const start = new Date(record.applicationDate as string).getTime();
      const end = new Date(record.issuedDate as string).getTime();
      return Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
    });
  if (durations.length === 0) return null;
  return Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}
