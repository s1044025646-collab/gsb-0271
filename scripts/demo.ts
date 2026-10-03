/**
 * 演示脚本：导入三个小例子（完全相同 / 完全分离 / 大量并列值），
 * 执行精确置换检验并导出报告，然后关闭并重新打开数据库，
 * 展示重启后读取冻结报告。
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { Store } from "../src/db";
import { KsService } from "../src/service";
const dbFile = path.join(process.cwd(), "data", "demo.sqlite");
if (fs.existsSync(dbFile)) fs.rmSync(dbFile);
const examples: { name: string; a: number[]; b: number[] }[] = [
  { name: "完全相同", a: [5, 5], b: [5, 5] },
  { name: "完全分离", a: [1, 2], b: [3, 4] },
  { name: "大量并列值", a: [1, 1, 2], b: [1, 2, 2] },
];
const store = new Store(dbFile);
const service = new KsService(store);
const analysisIds: number[] = [];
for (const ex of examples) {
  const { id } = service.importDataset(ex.name, ex.a, ex.b);
  const { result } = service.distance(id);
  const { result: perm, analysisId } = service.permutationTest(id);
  analysisIds.push(analysisId);
  console.log(`\n=== ${ex.name} (数据集 #${id}) ===`);
  console.log(
    `D = ${result.dNumerator}/${result.dDenominator} ≈ ${result.d.toFixed(4)}，` +
      `p = ${perm.pValue.reducedNumerator}/${perm.pValue.reducedDenominator} ≈ ${perm.pValue.decimal.toFixed(4)}，` +
      `总分配数 ${perm.totalAssignments}`
  );
}
const { report, analysisId } = service.exportReport(3);
const reportPath = path.join(process.cwd(), "data", "demo-report.md");
fs.writeFileSync(reportPath, report, "utf-8");
console.log(`\n报告已导出: ${reportPath} (分析 #${analysisId})`);
store.close();
console.log("\n--- 模拟重启后读取冻结报告 ---");
const store2 = new Store(dbFile);
for (const id of analysisIds) {
  const frozen = store2.getAnalysis(id);
  const r = frozen.result as { observedD: number; pValue: { decimal: number } };
  console.log(
    `分析 #${id} [${frozen.algo_version}] D=${r.observedD.toFixed(4)} p=${r.pValue.decimal.toFixed(4)}`
  );
}
store2.close();
console.log("演示完成。");
