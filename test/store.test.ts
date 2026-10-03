import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Store, ALGO_VERSION } from "../src/db";
import { KsService } from "../src/service";

function tmpDb(): string {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "ks-test-")),
    "test.sqlite"
  );
}

test("重启后可按原样本复算，冻结报告不变", () => {
  const file = tmpDb();
  let analysisId: number;
  let datasetId: number;
  {
    const store = new Store(file);
    const service = new KsService(store);
    const imp = service.importDataset("演示", [1, 1, 2], [1, 2, 2]);
    datasetId = imp.id;
    analysisId = service.permutationTest(datasetId).analysisId;
    store.close();
  }
  // 模拟重启：重新打开同一个 SQLite 文件
  {
    const store = new Store(file);
    const service = new KsService(store);
    const frozen = store.getAnalysis(analysisId);
    assert.equal(frozen.algo_version, ALGO_VERSION);
    const recomputed = service.permutationTest(datasetId).result;
    const saved = frozen.result as typeof recomputed;
    assert.equal(saved.observedDNumerator, recomputed.observedDNumerator);
    assert.equal(saved.tailCount, recomputed.tailCount);
    assert.equal(saved.totalAssignments, recomputed.totalAssignments);
    // 原始行顺序保留
    const { a, b } = store.getDataset(datasetId);
    assert.deepEqual(a, [1, 1, 2]);
    assert.deepEqual(b, [1, 2, 2]);
    store.close();
  }
});

test("不存在的数据集与分析报告返回 NOT_FOUND", () => {
  const store = new Store(tmpDb());
  assert.throws(() => store.getDataset(999), /不存在/);
  assert.throws(() => store.getAnalysis(999), /不存在/);
  store.close();
});
