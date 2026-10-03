import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Store } from "../src/db.js";
import { createServer } from "../src/server.js";
import { validateSample, ApiError } from "../src/validate.js";
import { AddressInfo } from "node:net";
import { Server } from "node:http";

let dir: string;
let dbPath: string;
let server: Server;
let store: Store;
let base: string;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "ks-test-"));
  dbPath = path.join(dir, "test.db");
  store = new Store(dbPath);
  server = createServer(store);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("校验：空组、超上限、非安全整数均报错", () => {
  assert.throws(() => validateSample([], [1]), (e: ApiError) => e.code === "EMPTY_GROUP");
  assert.throws(
    () => validateSample(new Array(9).fill(1), new Array(8).fill(2)),
    (e: ApiError) => e.code === "TOO_MANY_OBSERVATIONS",
  );
  assert.throws(
    () => validateSample([1.5], [2]),
    (e: ApiError) => e.code === "NOT_SAFE_INTEGER",
  );
});

test("API 全流程：导入→距离→累计表→检验→分布→报告", async () => {
  const created = await fetch(`${base}/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "api示例", groupA: [1, 2], groupB: [3, 4] }),
  }).then((r) => r.json());
  assert.equal(created.id, 1);

  const dist = await fetch(`${base}/samples/1/distance`).then((r) => r.json());
  assert.equal(dist.D, 1);

  const ecdf = await fetch(`${base}/samples/1/ecdf`).then((r) => r.json());
  assert.equal(ecdf.table.length, 4);

  const testRes = await fetch(`${base}/samples/1/test`, { method: "POST" }).then((r) => r.json());
  assert.equal(testRes.test.pValue.reduced, "1/3");
  assert.equal(testRes.reportId, 1);
  assert.ok(testRes.interpretation.assumption.includes("可交换"));

  const d = await fetch(`${base}/samples/1/distribution`).then((r) => r.json());
  assert.equal(d.totalAssignments, "6");

  const report = await fetch(`${base}/reports/1`).then((r) => r.json());
  assert.equal(report.report.test.pValue.reduced, "1/3");
});

test("API 错误码：超上限返回 TOO_MANY_OBSERVATIONS，未知样本 404", async () => {
  const r1 = await fetch(`${base}/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupA: new Array(10).fill(1), groupB: new Array(7).fill(2) }),
  });
  assert.equal(r1.status, 400);
  assert.equal((await r1.json()).error.code, "TOO_MANY_OBSERVATIONS");

  const r2 = await fetch(`${base}/samples/999`);
  assert.equal(r2.status, 404);
  assert.equal((await r2.json()).error.code, "NOT_FOUND");
});

test("重启后按原样本复算并读取冻结报告", async () => {
  // 用同一个库文件重新打开（模拟重启）
  const store2 = new Store(dbPath);
  const sample = store2.getSample(1);
  assert.ok(sample);
  assert.deepEqual(sample.groupA, [1, 2]);
  const frozen = store2.latestReportForSample(1);
  assert.ok(frozen);
  const report = frozen.report as { test: { pValue: { reduced: string } } };
  assert.equal(report.test.pValue.reduced, "1/3");
  store2.close();
});
