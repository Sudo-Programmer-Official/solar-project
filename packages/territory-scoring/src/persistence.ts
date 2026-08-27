import type { SqlClient } from "../../database/src/repository";
import type {
  AppointmentQueryResult,
  IntelligenceFilters,
  NormalizedAppointment,
  SalesRegion,
} from "@solar/analytics-contracts";
import { calculateMetrics, filterAppointments } from "./analytics";
import { deduplicateAppointments } from "./ingestion";
import { normalizeTerritoryLabel, territoryKey } from "@solar/geo-core";

export interface IntelligenceRepository {
  createUpload(input: UploadInsert): Promise<void>;
  getUploadByHash(fileSha256: string): Promise<UploadRecord | null>;
  insertAppointments(uploadId: string, appointments: NormalizedAppointment[]): Promise<{ insertedRows: number; duplicateRows: number }>;
  countAppointmentsForUpload(uploadId: string): Promise<number>;
  listAppointments(filters?: IntelligenceFilters): Promise<AppointmentQueryResult>;
  rebuildAnalytics(): Promise<void>;
}

export interface UploadRecord {
  id: string;
  filename: string;
  region: SalesRegion;
  status: string;
  parsedRows: number;
  insertedRows: number;
}

export interface UploadInsert {
  id: string;
  filename: string;
  region: SalesRegion;
  fileSha256: string;
  status?: "PROCESSING" | "COMPLETED";
  parsedRows: number;
  insertedRows: number;
  duplicateRows: number;
  diagnostics: unknown;
}

export class PostgresIntelligenceRepository implements IntelligenceRepository {
  constructor(private readonly client: SqlClient) {}

  async createUpload(input: UploadInsert): Promise<void> {
    await this.client.query(
      `
        INSERT INTO sales.uploads
          (id, filename, region, file_sha256, status, parsed_rows, inserted_rows, duplicate_rows, diagnostics_json)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        ON CONFLICT (file_sha256) DO UPDATE SET
          status = EXCLUDED.status,
          parsed_rows = EXCLUDED.parsed_rows,
          inserted_rows = EXCLUDED.inserted_rows,
          duplicate_rows = EXCLUDED.duplicate_rows,
          diagnostics_json = EXCLUDED.diagnostics_json
      `,
      [
        input.id,
        input.filename,
        input.region,
        input.fileSha256,
        input.status ?? "COMPLETED",
        input.parsedRows,
        input.insertedRows,
        input.duplicateRows,
        JSON.stringify(input.diagnostics ?? {}),
      ],
    );
  }

  async getUploadByHash(fileSha256: string): Promise<UploadRecord | null> {
    const result = await this.client.query<{ id: string; filename: string; region: SalesRegion; status: string; parsed_rows: number; inserted_rows: number }>(
      "SELECT id, filename, region, status, parsed_rows, inserted_rows FROM sales.uploads WHERE file_sha256 = $1",
      [fileSha256],
    );
    const row = result.rows[0];
    return row ? { id: row.id, filename: row.filename, region: row.region, status: row.status, parsedRows: Number(row.parsed_rows), insertedRows: Number(row.inserted_rows) } : null;
  }

  async insertAppointments(uploadId: string, appointments: NormalizedAppointment[]): Promise<{ insertedRows: number; duplicateRows: number }> {
    const deduplicated = deduplicateAppointments(appointments);
    let insertedRows = 0;
    for (let start = 0; start < deduplicated.appointments.length; start += 250) {
      const chunk = deduplicated.appointments.slice(start, start + 250);
      const params: unknown[] = [];
      const values = chunk.map((appointment, rowIndex) => {
        const offset = rowIndex * 27;
        params.push(
          appointment.id,
          uploadId,
          appointment.sourceFile,
          appointment.sourceSheet,
          appointment.sourceRow,
          appointment.sourceBlock,
          appointment.region,
          appointment.appointmentDate,
          appointment.appointmentTime,
          appointment.dateSet,
          appointment.customerName,
          appointment.phone,
          appointment.city,
          appointment.hood,
          appointment.street,
          appointment.latitude,
          appointment.longitude,
          appointment.setter,
          appointment.closer,
          appointment.confirmed,
          appointment.confirmedRaw,
          appointment.resultRaw,
          appointment.resultCategory,
          appointment.setterNotes,
          appointment.closerNotes,
          appointment.dedupeKey,
          JSON.stringify(appointment.raw),
        );
        const parameter = (index: number) => `$${offset + index}`;
        return `(${parameter(1)}, ${parameter(2)}, ${parameter(3)}, ${parameter(4)}, ${parameter(5)}, ${parameter(6)}, ${parameter(7)}, ${parameter(8)}::date, ${parameter(9)}, ${parameter(10)}::date, ${parameter(11)}, ${parameter(12)}, ${parameter(13)}, ${parameter(14)}, ${parameter(15)}, ${parameter(16)}, ${parameter(17)}, ${parameter(18)}, ${parameter(19)}, ${parameter(20)}, ${parameter(21)}, ${parameter(22)}, ${parameter(23)}, ${parameter(24)}, ${parameter(25)}, ${parameter(26)}, ${parameter(27)}::jsonb)`;
      });
      const result = await this.client.query(
        `
          INSERT INTO sales.appointments (
            id, upload_id, source_file, source_sheet, source_row, source_block, region,
            appointment_date, appointment_time, date_set, customer_name, phone, city, hood,
            street, latitude, longitude, setter, closer, confirmed, confirmed_raw, result_raw, result_category,
            setter_notes, closer_notes, dedupe_key, raw_record
          )
          VALUES ${values.join(",\n")}
          ON CONFLICT (dedupe_key) DO NOTHING
          RETURNING id
        `,
        params,
      );
      insertedRows += result.rows.length;
    }
    return {
      insertedRows,
      duplicateRows: appointments.length - insertedRows,
    };
  }

  async listAppointments(filters: IntelligenceFilters = {}): Promise<AppointmentQueryResult> {
    const { where, params } = buildFilters(filters);
    const result = await this.client.query<AppointmentRow>(
      `
        SELECT id, source_file, source_sheet, source_row, source_block, region,
               appointment_date, appointment_time, date_set, customer_name, phone,
               city, hood, street, latitude, longitude, setter, closer, confirmed, confirmed_raw, result_raw,
               result_category, setter_notes, closer_notes, dedupe_key, raw_record
        FROM sales.appointments
        WHERE ${where}
        ORDER BY appointment_date NULLS LAST, source_file, source_sheet, source_row
      `,
      params,
    );
    const appointments = result.rows.map(toAppointment);
    return { appointments, total: appointments.length };
  }

  async countAppointmentsForUpload(uploadId: string): Promise<number> {
    const result = await this.client.query<{ count: string }>("SELECT count(*)::text AS count FROM sales.appointments WHERE upload_id = $1", [uploadId]);
    return Number(result.rows[0]?.count ?? 0);
  }

  async rebuildAnalytics(): Promise<void> {
    const { appointments } = await this.listAppointments();
    const territoryDaily = new Map<string, NormalizedAppointment[]>();
    const repDaily = new Map<string, NormalizedAppointment[]>();
    const resultDaily = new Map<string, NormalizedAppointment[]>();
    for (const appointment of appointments) {
      if (!appointment.appointmentDate) continue;
      const date = appointment.appointmentDate;
      const territory = territoryKey(appointment.region, appointment.city, appointment.hood);
      add(territoryDaily, `${territory}|${date}`, appointment);
      if (appointment.setter) add(repDaily, `SETTER|${appointment.setter}|${date}|${appointment.region}`, appointment);
      if (appointment.closer) add(repDaily, `CLOSER|${appointment.closer}|${date}|${appointment.region}`, appointment);
      add(resultDaily, `${appointment.resultCategory}|${date}|${appointment.region}`, appointment);
    }

    const rebuild = async (client: SqlClient): Promise<void> => {
      await client.query("DELETE FROM analytics.territory_daily");
      await client.query("DELETE FROM analytics.rep_daily");
      await client.query("DELETE FROM analytics.result_daily");
      const territoryRows: unknown[][] = [];
      for (const [key, group] of territoryDaily) {
        const first = group[0]!;
        const date = first.appointmentDate!;
        const metrics = calculateMetrics(group);
        territoryRows.push([key.split("|")[0], date, first.region, first.city ?? "Unknown", first.hood, metrics.totalSets, metrics.confirmed, metrics.sits, metrics.closes, metrics.cancellationDq, metrics.didNotClose, metrics.creditFails, metrics.rescheduled, metrics.traceAppointmentIds]);
      }
      await insertBatches(client, territoryRows, `
        INSERT INTO analytics.territory_daily
          (territory_key, territory_date, region, city, hood, total_sets, confirmed, sits, closes,
           cancellation_dq, did_not_close, credit_fails, rescheduled, appointment_ids, rebuilt_at)
      `, { 2: "date", 14: "uuid[]" });

      const repRows: unknown[][] = [];
      for (const [key, group] of repDaily) {
        const [role, repName, date, region] = key.split("|");
        const metrics = calculateMetrics(group);
        repRows.push([role, repName, date, region, metrics.totalSets, metrics.confirmed, metrics.sits, metrics.closes, metrics.cancellationDq, metrics.didNotClose, metrics.creditFails, metrics.rescheduled, metrics.traceAppointmentIds]);
      }
      await insertBatches(client, repRows, `
        INSERT INTO analytics.rep_daily
          (role, rep_name, territory_date, region, total_sets, confirmed, sits, closes,
           cancellation_dq, did_not_close, credit_fails, rescheduled, appointment_ids, rebuilt_at)
      `, { 3: "date", 13: "uuid[]" });

      const resultRows: unknown[][] = [];
      for (const [key, group] of resultDaily) {
        const [resultCategory, date, region] = key.split("|");
        resultRows.push([resultCategory, date, region, group.length, group.map((appointment) => appointment.id)]);
      }
      await insertBatches(client, resultRows, `
        INSERT INTO analytics.result_daily (result_category, territory_date, region, total_records, appointment_ids, rebuilt_at)
      `, { 2: "date", 5: "uuid[]" });
    };

    if (this.client.transaction) {
      await this.client.transaction(rebuild);
      return;
    }

    await this.client.query("BEGIN");
    try {
      await rebuild(this.client);
      await this.client.query("COMMIT");
    } catch (error) {
      await this.client.query("ROLLBACK");
      throw error;
    }
  }
}

export class InMemoryIntelligenceRepository implements IntelligenceRepository {
  private readonly uploads = new Map<string, UploadRecord & { fileSha256: string }>();
  private readonly appointments = new Map<string, { uploadId: string; appointment: NormalizedAppointment }>();

  async createUpload(input: UploadInsert): Promise<void> {
    this.uploads.set(input.id, {
      id: input.id,
      filename: input.filename,
      region: input.region,
      status: input.status ?? "COMPLETED",
      parsedRows: input.parsedRows,
      insertedRows: input.insertedRows,
      fileSha256: input.fileSha256,
    });
  }

  async getUploadByHash(fileSha256: string): Promise<UploadRecord | null> {
    for (const upload of this.uploads.values()) {
      if (upload.fileSha256 === fileSha256) return upload;
    }
    return null;
  }

  async insertAppointments(uploadId: string, appointments: NormalizedAppointment[]): Promise<{ insertedRows: number; duplicateRows: number }> {
    const deduplicated = deduplicateAppointments(appointments);
    let insertedRows = 0;
    for (const appointment of deduplicated.appointments) {
      if (this.appointments.has(appointment.dedupeKey)) continue;
      this.appointments.set(appointment.dedupeKey, { uploadId, appointment });
      insertedRows += 1;
    }
    return { insertedRows, duplicateRows: appointments.length - insertedRows };
  }

  async countAppointmentsForUpload(uploadId: string): Promise<number> {
    return [...this.appointments.values()].filter((item) => item.uploadId === uploadId).length;
  }

  async listAppointments(filters: IntelligenceFilters = {}): Promise<AppointmentQueryResult> {
    const appointments = filterAppointments([...this.appointments.values()].map((item) => item.appointment), filters)
      .sort((a, b) => (a.appointmentDate ?? "9999-12-31").localeCompare(b.appointmentDate ?? "9999-12-31") || a.sourceFile.localeCompare(b.sourceFile) || a.sourceRow - b.sourceRow);
    return { appointments, total: appointments.length };
  }

  async rebuildAnalytics(): Promise<void> {
    // Analytics are rebuilt live from the normalized facts in development fallback mode.
  }
}

async function insertBatches(client: SqlClient, rows: unknown[][], insertSql: string, casts: Record<number, string>): Promise<void> {
  if (rows.length === 0) return;
  const width = rows[0]!.length;
  for (let start = 0; start < rows.length; start += 250) {
    const chunk = rows.slice(start, start + 250);
    const params = chunk.flat();
    const values = chunk.map((_row, rowIndex) => {
      const offset = rowIndex * width;
      return `(${Array.from({ length: width }, (_value, columnIndex) => {
        const parameter = `$${offset + columnIndex + 1}`;
        const cast = casts[columnIndex + 1];
        return cast ? `${parameter}::${cast}` : parameter;
      }).join(", ")}, NOW())`;
    });
    await client.query(`${insertSql} VALUES ${values.join(",\n")}`, params);
  }
}

interface AppointmentRow {
  id: string;
  source_file: string;
  source_sheet: string;
  source_row: number;
  source_block: number;
  region: SalesRegion;
  appointment_date: string | Date | null;
  appointment_time: string | null;
  date_set: string | Date | null;
  customer_name: string;
  phone: string | null;
  city: string | null;
  hood: string | null;
  street: string | null;
  latitude: number | null;
  longitude: number | null;
  setter: string | null;
  closer: string | null;
  confirmed: boolean | null;
  confirmed_raw: string | null;
  result_raw: string | null;
  result_category: NormalizedAppointment["resultCategory"];
  setter_notes: string | null;
  closer_notes: string | null;
  dedupe_key: string;
  raw_record: Record<string, unknown>;
}

function toAppointment(row: AppointmentRow): NormalizedAppointment {
  return {
    id: row.id,
    sourceFile: row.source_file,
    sourceSheet: row.source_sheet,
    sourceRow: row.source_row,
    sourceBlock: row.source_block,
    region: row.region,
    appointmentDate: toDateOnly(row.appointment_date),
    appointmentTime: row.appointment_time,
    dateSet: toDateOnly(row.date_set),
    customerName: row.customer_name,
    phone: row.phone,
    city: normalizeTerritoryLabel(row.city),
    hood: normalizeTerritoryLabel(row.hood),
    street: row.street,
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    setter: row.setter,
    closer: row.closer,
    confirmed: row.confirmed,
    confirmedRaw: row.confirmed_raw,
    resultRaw: row.result_raw,
    resultCategory: row.result_category,
    setterNotes: row.setter_notes,
    closerNotes: row.closer_notes,
    dedupeKey: row.dedupe_key,
    raw: row.raw_record ?? {},
  };
}

function add(map: Map<string, NormalizedAppointment[]>, key: string, appointment: NormalizedAppointment): void {
  const group = map.get(key) ?? [];
  group.push(appointment);
  map.set(key, group);
}

function toDateOnly(value: string | Date | null): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = String(value);
  const match = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  return match ? `${match[1]}-${match[2]!.padStart(2, "0")}-${match[3]!.padStart(2, "0")}` : null;
}

function buildFilters(filters: IntelligenceFilters): { where: string; params: unknown[] } {
  const conditions = ["TRUE"];
  const params: unknown[] = [];
  const addCondition = (sql: string, value: unknown) => {
    params.push(value);
    conditions.push(sql.replace("?", `$${params.length}`));
  };
  if (filters.from) addCondition("appointment_date >= ?::date", filters.from);
  if (filters.to) addCondition("appointment_date <= ?::date", filters.to);
  if (filters.region && filters.region !== "UNKNOWN") addCondition("region = ?", filters.region);
  if (filters.city) addCondition("LOWER(city) = LOWER(?)", filters.city);
  if (filters.hood) addCondition("LOWER(hood) = LOWER(?)", filters.hood);
  if (filters.setter) addCondition("LOWER(setter) = LOWER(?)", filters.setter);
  if (filters.closer) addCondition("LOWER(closer) = LOWER(?)", filters.closer);
  if (filters.result) addCondition("result_category = ?", filters.result);
  return { where: conditions.join(" AND "), params };
}
