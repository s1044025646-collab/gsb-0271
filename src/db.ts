import { DatabaseSync } from "node:sqlite";
import * as path from "node:path";
import * as fs from "node:fs";
import { ApiError } from "./errors";

export const ALGO_VERSION = "ks-exact-v1";

export interface DatasetRow {
  id: number;
  name: string;
  created_at: string;
}

export interface ObservationRow {
  group_label: string;
  row_order: number;
  value: number;
}

export class Store {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const dataDir = path.join(process.cwd(), "data");
    fs.mkdirSync(dataDir, { recursive: true });
    const file = dbPath ?? path.join(dataDir, "ks.sqlite");
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS datasets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS observations (
        dataset_id INTEGER NOT NULL REFERENCES datasets(id),
        group_label TEXT NOT NULL CHECK (group_label IN ('A','B')),
        row_order INTEGER NOT NULL,
        value INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_obs_dataset ON observations(dataset_id);
      CREATE TABLE IF NOT EXISTS analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dataset_id INTEGER NOT NULL REFERENCES datasets(id),
        algo_version TEXT NOT NULL,
        kind TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  createDataset(name: string, a: number[], b: number[]): number {
    const insertDataset = this.db.prepare(
      "INSERT INTO datasets (name) VALUES (?)"
    );
    const insertObs = this.db.prepare(
      "INSERT INTO observations (dataset_id, group_label, row_order, value) VALUES (?, ?, ?, ?)"
    );
    const result = insertDataset.run(name);
    const id = Number(result.lastInsertRowid);
    a.forEach((v, i) => insertObs.run(id, "A", i, v));
    b.forEach((v, i) => insertObs.run(id, "B", i, v));
    return id;
  }

  getDataset(id: number): { dataset: DatasetRow; a: number[]; b: number[] } {
    const dataset = this.db
      .prepare("SELECT * FROM datasets WHERE id = ?")
      .get(id) as DatasetRow | undefined;
    if (!dataset) {
      throw new ApiError("NOT_FOUND", `数据集 ${id} 不存在`, 404);
    }
    const rows = this.db
      .prepare(
        "SELECT group_label, row_order, value FROM observations WHERE dataset_id = ? ORDER BY group_label, row_order"
      )
      .all(id) as unknown as ObservationRow[];
    const a = rows.filter((r) => r.group_label === "A").map((r) => r.value);
    const b = rows.filter((r) => r.group_label === "B").map((r) => r.value);
    return { dataset, a, b };
  }

  listDatasets(): DatasetRow[] {
    return this.db
      .prepare("SELECT * FROM datasets ORDER BY id")
      .all() as unknown as DatasetRow[];
  }

  saveAnalysis(datasetId: number, kind: string, result: unknown): number {
    const r = this.db
      .prepare(
        "INSERT INTO analyses (dataset_id, algo_version, kind, result_json) VALUES (?, ?, ?, ?)"
      )
      .run(datasetId, ALGO_VERSION, kind, JSON.stringify(result));
    return Number(r.lastInsertRowid);
  }

  getAnalysis(id: number): {
    id: number;
    dataset_id: number;
    algo_version: string;
    kind: string;
    result: unknown;
    created_at: string;
  } {
    const row = this.db
      .prepare("SELECT * FROM analyses WHERE id = ?")
      .get(id) as
      | {
          id: number;
          dataset_id: number;
          algo_version: string;
          kind: string;
          result_json: string;
          created_at: string;
        }
      | undefined;
    if (!row) {
      throw new ApiError("NOT_FOUND", `分析报告 ${id} 不存在`, 404);
    }
    return {
      id: row.id,
      dataset_id: row.dataset_id,
      algo_version: row.algo_version,
      kind: row.kind,
      result: JSON.parse(row.result_json),
      created_at: row.created_at,
    };
  }

  close(): void {
    this.db.close();
  }
}
