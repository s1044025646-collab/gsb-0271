// SQLite 持久化：保存两组原始观测、算法版本与分析报告。

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

export const ALGO_VERSION = "ks-exact-v1";

export interface SampleRow {
  id: number;
  name: string;
  groupA: number[];
  groupB: number[];
  algoVersion: string;
  createdAt: string;
}

export class Store {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        group_a TEXT NOT NULL,
        group_b TEXT NOT NULL,
        algo_version TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sample_id INTEGER NOT NULL REFERENCES samples(id),
        algo_version TEXT NOT NULL,
        report_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  close(): void {
    this.db.close();
  }

  insertSample(name: string, a: number[], b: number[]): number {
    const stmt = this.db.prepare(
      "INSERT INTO samples (name, group_a, group_b, algo_version, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    const r = stmt.run(name, JSON.stringify(a), JSON.stringify(b), ALGO_VERSION, new Date().toISOString());
    return Number(r.lastInsertRowid);
  }

  getSample(id: number): SampleRow | null {
    const row = this.db.prepare("SELECT * FROM samples WHERE id = ?").get(id) as
      | { id: number; name: string; group_a: string; group_b: string; algo_version: string; created_at: string }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      groupA: JSON.parse(row.group_a),
      groupB: JSON.parse(row.group_b),
      algoVersion: row.algo_version,
      createdAt: row.created_at,
    };
  }

  listSamples(): SampleRow[] {
    const rows = this.db.prepare("SELECT * FROM samples ORDER BY id").all() as unknown as {
      id: number; name: string; group_a: string; group_b: string; algo_version: string; created_at: string;
    }[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      groupA: JSON.parse(row.group_a),
      groupB: JSON.parse(row.group_b),
      algoVersion: row.algo_version,
      createdAt: row.created_at,
    }));
  }

  insertReport(sampleId: number, report: unknown): number {
    const stmt = this.db.prepare(
      "INSERT INTO reports (sample_id, algo_version, report_json, created_at) VALUES (?, ?, ?, ?)",
    );
    const r = stmt.run(sampleId, ALGO_VERSION, JSON.stringify(report), new Date().toISOString());
    return Number(r.lastInsertRowid);
  }

  getReport(id: number): { id: number; sampleId: number; algoVersion: string; report: unknown; createdAt: string } | null {
    const row = this.db.prepare("SELECT * FROM reports WHERE id = ?").get(id) as
      | { id: number; sample_id: number; algo_version: string; report_json: string; created_at: string }
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      sampleId: row.sample_id,
      algoVersion: row.algo_version,
      report: JSON.parse(row.report_json),
      createdAt: row.created_at,
    };
  }

  latestReportForSample(sampleId: number): { id: number; report: unknown } | null {
    const row = this.db.prepare(
      "SELECT id, report_json FROM reports WHERE sample_id = ? ORDER BY id DESC LIMIT 1",
    ).get(sampleId) as { id: number; report_json: string } | undefined;
    if (!row) return null;
    return { id: row.id, report: JSON.parse(row.report_json) };
  }
}
