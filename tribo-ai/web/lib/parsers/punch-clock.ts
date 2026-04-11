/**
 * Punch-clock import parsers
 *
 * Parses CSV/XLSX files exported from Brazilian time tracking systems.
 * Normalizes them to the shared `ParsedAttendance` format.
 *
 * Supported formats (MVP):
 * - Tangerino
 * - Pontomais
 * - Secullum
 * - Ahgora
 * - Generic (column mapping)
 */

import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { AttendanceType } from "@prisma/client";

// -------------------------------------------------------------
// Shared normalized format
// -------------------------------------------------------------

export interface ParsedAttendance {
  employeeIdentifier: string; // email, matrícula ou nome (tenant decide qual usar)
  employeeIdentifierType: "email" | "employee_id" | "name";
  date: Date; // apenas data, sem hora (UTC-3 BRT)
  type: AttendanceType;
  minutesWorked?: number;
  notes?: string;
}

export interface ParseResult {
  records: ParsedAttendance[];
  errors: ParseError[];
  source: string;
  totalRows: number;
  successRows: number;
}

export interface ParseError {
  row: number;
  message: string;
  raw?: unknown;
}

// -------------------------------------------------------------
// Main parser dispatcher
// -------------------------------------------------------------

export async function parsePunchClockFile(
  file: Buffer,
  format: "tangerino" | "pontomais" | "secullum" | "ahgora" | "generic",
  filename: string,
): Promise<ParseResult> {
  const rows = await readFileAsRows(file, filename);

  switch (format) {
    case "tangerino":
      return parseTangerino(rows);
    case "pontomais":
      return parsePontomais(rows);
    case "secullum":
      return parseSecullum(rows);
    case "ahgora":
      return parseAhgora(rows);
    case "generic":
      return parseGeneric(rows);
    default:
      throw new Error(`Formato não suportado: ${format}`);
  }
}

// -------------------------------------------------------------
// File reading (CSV or XLSX → rows)
// -------------------------------------------------------------

async function readFileAsRows(
  file: Buffer,
  filename: string,
): Promise<Record<string, string>[]> {
  if (filename.toLowerCase().endsWith(".csv")) {
    const text = file.toString("utf-8");
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    return parsed.data;
  }

  if (filename.toLowerCase().match(/\.xlsx?$/)) {
    const wb = XLSX.read(file, { type: "buffer" });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, {
      raw: false,
      defval: "",
    });
  }

  throw new Error("Formato de arquivo não suportado. Use CSV ou XLSX.");
}

// -------------------------------------------------------------
// Format-specific parsers
// -------------------------------------------------------------

/**
 * TANGERINO
 * Colunas esperadas: "Colaborador", "E-mail", "Data", "Status", "Horas Trabalhadas"
 * Status possíveis: "Presente", "Férias", "Atestado", "Falta", "Folga", "Home Office"
 */
function parseTangerino(rows: Record<string, string>[]): ParseResult {
  const result: ParseResult = {
    records: [],
    errors: [],
    source: "tangerino",
    totalRows: rows.length,
    successRows: 0,
  };

  rows.forEach((row, idx) => {
    try {
      const email = row["E-mail"]?.trim() || row["Email"]?.trim();
      const dateStr = row["Data"]?.trim();
      const status = row["Status"]?.trim() || "";
      const hours = row["Horas Trabalhadas"]?.trim();

      if (!email || !dateStr) {
        throw new Error("E-mail ou Data ausentes");
      }

      result.records.push({
        employeeIdentifier: email,
        employeeIdentifierType: "email",
        date: parseBrDate(dateStr),
        type: mapTangerinoStatus(status),
        minutesWorked: hours ? parseHoursToMinutes(hours) : undefined,
      });
      result.successRows++;
    } catch (err) {
      result.errors.push({
        row: idx + 2, // +1 header, +1 0-based
        message: err instanceof Error ? err.message : "Erro desconhecido",
        raw: row,
      });
    }
  });

  return result;
}

function mapTangerinoStatus(status: string): AttendanceType {
  const normalized = status.toLowerCase().trim();
  const map: Record<string, AttendanceType> = {
    presente: "PRESENT",
    trabalhado: "PRESENT",
    "home office": "REMOTE",
    "home-office": "REMOTE",
    remoto: "REMOTE",
    "férias": "VACATION",
    ferias: "VACATION",
    atestado: "SICK_LEAVE",
    licença: "SICK_LEAVE",
    licenca: "SICK_LEAVE",
    "licença maternidade": "MATERNITY",
    "licenca maternidade": "MATERNITY",
    "licença paternidade": "PATERNITY",
    "licenca paternidade": "PATERNITY",
    falta: "ABSENT",
    ausente: "ABSENT",
    folga: "HOLIDAY",
    feriado: "HOLIDAY",
    parcial: "PARTIAL",
    atraso: "PARTIAL",
  };
  return map[normalized] ?? "PRESENT";
}

/**
 * PONTOMAIS
 * Colunas: "Nome", "Matrícula", "Data", "Tipo", "Duração"
 */
function parsePontomais(rows: Record<string, string>[]): ParseResult {
  const result: ParseResult = {
    records: [],
    errors: [],
    source: "pontomais",
    totalRows: rows.length,
    successRows: 0,
  };

  rows.forEach((row, idx) => {
    try {
      const matricula = row["Matrícula"]?.trim() || row["Matricula"]?.trim();
      const nome = row["Nome"]?.trim();
      const dateStr = row["Data"]?.trim();
      const tipo = row["Tipo"]?.trim() || "";
      const duracao = row["Duração"]?.trim() || row["Duracao"]?.trim();

      if ((!matricula && !nome) || !dateStr) {
        throw new Error("Identificador ou data ausentes");
      }

      result.records.push({
        employeeIdentifier: matricula || nome || "",
        employeeIdentifierType: matricula ? "employee_id" : "name",
        date: parseBrDate(dateStr),
        type: mapPontomaisType(tipo),
        minutesWorked: duracao ? parseHoursToMinutes(duracao) : undefined,
      });
      result.successRows++;
    } catch (err) {
      result.errors.push({
        row: idx + 2,
        message: err instanceof Error ? err.message : "Erro desconhecido",
        raw: row,
      });
    }
  });

  return result;
}

function mapPontomaisType(t: string): AttendanceType {
  const n = t.toLowerCase();
  if (n.includes("férias") || n.includes("ferias")) return "VACATION";
  if (n.includes("atestado") || n.includes("médico") || n.includes("medico")) return "SICK_LEAVE";
  if (n.includes("maternidade")) return "MATERNITY";
  if (n.includes("paternidade")) return "PATERNITY";
  if (n.includes("falta")) return "ABSENT";
  if (n.includes("feriado") || n.includes("folga")) return "HOLIDAY";
  if (n.includes("home") || n.includes("remoto")) return "REMOTE";
  if (n.includes("parcial") || n.includes("atraso")) return "PARTIAL";
  return "PRESENT";
}

/**
 * SECULLUM
 * Colunas: "Funcionário", "CPF", "Data", "Ocorrência", "HE"
 */
function parseSecullum(rows: Record<string, string>[]): ParseResult {
  const result: ParseResult = {
    records: [],
    errors: [],
    source: "secullum",
    totalRows: rows.length,
    successRows: 0,
  };

  rows.forEach((row, idx) => {
    try {
      const nome = row["Funcionário"]?.trim() || row["Funcionario"]?.trim();
      const dateStr = row["Data"]?.trim();
      const ocorrencia = row["Ocorrência"]?.trim() || row["Ocorrencia"]?.trim() || "";

      if (!nome || !dateStr) {
        throw new Error("Funcionário ou Data ausentes");
      }

      result.records.push({
        employeeIdentifier: nome,
        employeeIdentifierType: "name",
        date: parseBrDate(dateStr),
        type: mapSecullumOcorrencia(ocorrencia),
      });
      result.successRows++;
    } catch (err) {
      result.errors.push({
        row: idx + 2,
        message: err instanceof Error ? err.message : "Erro desconhecido",
        raw: row,
      });
    }
  });

  return result;
}

function mapSecullumOcorrencia(o: string): AttendanceType {
  const n = o.toLowerCase();
  if (!n || n === "normal" || n === "ok") return "PRESENT";
  if (n.includes("férias") || n.includes("ferias")) return "VACATION";
  if (n.includes("atestado")) return "SICK_LEAVE";
  if (n.includes("maternidade")) return "MATERNITY";
  if (n.includes("paternidade")) return "PATERNITY";
  if (n.includes("falta") || n.includes("ausência") || n.includes("ausencia")) return "ABSENT";
  if (n.includes("feriado")) return "HOLIDAY";
  if (n.includes("home") || n.includes("remoto")) return "REMOTE";
  return "PARTIAL";
}

/**
 * AHGORA
 * Colunas: "Nome", "Data Ref", "Situação", "Horas"
 */
function parseAhgora(rows: Record<string, string>[]): ParseResult {
  const result: ParseResult = {
    records: [],
    errors: [],
    source: "ahgora",
    totalRows: rows.length,
    successRows: 0,
  };

  rows.forEach((row, idx) => {
    try {
      const nome = row["Nome"]?.trim();
      const dateStr = row["Data Ref"]?.trim() || row["Data"]?.trim();
      const situacao = row["Situação"]?.trim() || row["Situacao"]?.trim() || "";
      const horas = row["Horas"]?.trim();

      if (!nome || !dateStr) {
        throw new Error("Nome ou Data ausentes");
      }

      result.records.push({
        employeeIdentifier: nome,
        employeeIdentifierType: "name",
        date: parseBrDate(dateStr),
        type: mapAhgoraSituacao(situacao),
        minutesWorked: horas ? parseHoursToMinutes(horas) : undefined,
      });
      result.successRows++;
    } catch (err) {
      result.errors.push({
        row: idx + 2,
        message: err instanceof Error ? err.message : "Erro desconhecido",
        raw: row,
      });
    }
  });

  return result;
}

function mapAhgoraSituacao(s: string): AttendanceType {
  // Reutiliza lógica do Secullum que é similar
  return mapSecullumOcorrencia(s);
}

/**
 * GENERIC
 * Qualquer CSV/XLSX — usa IA (em produção) para mapear colunas.
 * No MVP, aceita mapping explícito de colunas.
 */
function parseGeneric(rows: Record<string, string>[]): ParseResult {
  const result: ParseResult = {
    records: [],
    errors: [],
    source: "csv_generic",
    totalRows: rows.length,
    successRows: 0,
  };

  // Tenta detectar colunas por heurística
  const firstRow = rows[0] ?? {};
  const columns = Object.keys(firstRow);

  const emailCol = columns.find((c) => /email|e-mail/i.test(c));
  const nameCol = columns.find((c) => /nome|name|colaborador|funcionario|funcionário/i.test(c));
  const dateCol = columns.find((c) => /data|date/i.test(c));
  const statusCol = columns.find(
    (c) => /status|tipo|situa[çc][aã]o|ocorr[eê]ncia/i.test(c),
  );

  if (!dateCol || (!emailCol && !nameCol)) {
    result.errors.push({
      row: 0,
      message:
        "Não foi possível detectar colunas obrigatórias (Data + Nome/Email). Use mapping manual.",
    });
    return result;
  }

  rows.forEach((row, idx) => {
    try {
      const identifier = emailCol ? row[emailCol] : row[nameCol!];
      const dateStr = row[dateCol];
      const status = statusCol ? row[statusCol] : "";

      if (!identifier || !dateStr) {
        throw new Error("Identificador ou data ausentes");
      }

      result.records.push({
        employeeIdentifier: identifier.trim(),
        employeeIdentifierType: emailCol ? "email" : "name",
        date: parseBrDate(dateStr),
        type: mapGenericStatus(status),
      });
      result.successRows++;
    } catch (err) {
      result.errors.push({
        row: idx + 2,
        message: err instanceof Error ? err.message : "Erro desconhecido",
        raw: row,
      });
    }
  });

  return result;
}

function mapGenericStatus(s: string): AttendanceType {
  return mapTangerinoStatus(s);
}

// -------------------------------------------------------------
// Utilities
// -------------------------------------------------------------

/**
 * Parse a Brazilian date in format DD/MM/YYYY or YYYY-MM-DD.
 * Returns Date at midnight BRT (UTC-3).
 */
export function parseBrDate(input: string): Date {
  const cleaned = input.trim();

  // Try DD/MM/YYYY
  const brMatch = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    // Create at 03:00 UTC = 00:00 BRT
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 3));
  }

  // Try ISO YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 3));
  }

  throw new Error(`Data em formato inválido: "${input}". Use DD/MM/YYYY ou YYYY-MM-DD.`);
}

/**
 * Parse duration strings like "08:30", "8.5h", "510min" into minutes.
 */
export function parseHoursToMinutes(input: string): number {
  const cleaned = input.trim().toLowerCase();

  // HH:MM
  const hhmm = cleaned.match(/^(\d+):(\d{2})$/);
  if (hhmm) {
    return Number(hhmm[1]) * 60 + Number(hhmm[2]);
  }

  // N.N h
  const decimalH = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*h?$/);
  if (decimalH) {
    return Math.round(Number(decimalH[1].replace(",", ".")) * 60);
  }

  // Nmin
  const mins = cleaned.match(/^(\d+)\s*min$/);
  if (mins) {
    return Number(mins[1]);
  }

  return 0;
}
