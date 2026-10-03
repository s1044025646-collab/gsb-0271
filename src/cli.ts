// CLI 入口：导入样本、计算距离、查看累计分布表、精确检验、D 分布、导出报告、启动服务。

import path from "node:path";
import { Store } from "./db.js";
import { ApiError, validateSample } from "./validate.js";
import { buildReport, computeDistance, computeDistribution, computeEcdf } from "./report.js";
import { startServer } from "./server.js";

const DB_PATH = process.env.KS_DB_PATH ?? path.join(process.cwd(), "data", "ks.db");

function parseList(s: string): number[] {
  return s.split(",").map((x) => Number(x.trim()));
}

function getArg(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function print(x: unknown): void {
  console.log(JSON.stringify(x, null, 2));
}

function requireSample(store: Store, idStr: string | undefined) {
  const id = Number(idStr);
  if (!idStr || !Number.isInteger(id)) {
    throw new ApiError("INVALID_INPUT", "请用 --id 指定样本 ID");
  }
  const s = store.getSample(id);
  if (!s) throw new ApiError("NOT_FOUND", `样本 ${id} 不存在`, 404);
  return s;
}

// 解析 --a/--b 直接输入，或 --id 从库中读取
function resolveGroups(store: Store, args: string[]): { name: string; a: number[]; b: number[] } {
  const aStr = getArg(args, "--a");
  const bStr = getArg(args, "--b");
  if (aStr !== undefined && bStr !== undefined) {
    const { a, b } = validateSample(parseList(aStr), parseList(bStr));
    return { name: getArg(args, "--name") ?? "临时样本", a, b };
  }
  const s = requireSample(store, getArg(args, "--id"));
  return { name: s.name, a: s.groupA, b: s.groupB };
}

const USAGE = `用法: node dist/cli.js <命令> [参数]
命令:
  import  --name 名称 --a 1,2,3 --b 4,5   导入样本（保留原始行顺序）
  list                                      列出全部样本
  distance (--id N | --a ... --b ...)       计算 KS 距离 D
  ecdf     (--id N | --a ... --b ...)       查看累计分布比较表
  test     (--id N | --a ... --b ...)       执行精确置换检验并保存报告
  dist     (--id N | --a ... --b ...)       查看 D 的精确计数分布
  report  --id R                            导出已冻结的分析报告
  serve   [--port P]                        启动 HTTP 服务（默认空闲端口）
  demo                                      运行内置小例子并演示重启后读取报告
数据文件: ${DB_PATH}（可用环境变量 KS_DB_PATH 覆盖）`;

export function runDemo(store: Store): void {
  const examples: { name: string; a: number[]; b: number[] }[] = [
    { name: "完全相同", a: [1, 2, 3], b: [1, 2, 3] },
    { name: "完全分离", a: [1, 2, 3], b: [10, 11, 12] },
    { name: "大量并列值", a: [0, 0, 5, 5], b: [0, 5, 5, 5] },
  ];
  for (const ex of examples) {
    const id = store.insertSample(ex.name, ex.a, ex.b);
    const report = buildReport(ex.name, ex.a, ex.b);
    const reportId = store.insertReport(id, report);
    console.log(`\n=== 示例「${ex.name}」 sampleId=${id} reportId=${reportId} ===`);
    console.log(`D = ${report.distance.maxNumerator}/${report.distance.denominator} ≈ ${report.distance.D}`);
    console.log(`p = ${report.test.pValue.reduced} ≈ ${report.test.pValue.decimal}` +
      `（尾部分配 ${report.test.tailCount} / 共 ${report.test.totalAssignments} 种）`);
  }
  const first = store.listSamples()[0];
  const frozen = store.latestReportForSample(first.id);
  console.log(`\n重启后可按样本 ID=${first.id} 复算，或直接读取冻结报告 ID=${frozen?.id}（见 report 命令）。`);
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || cmd === "help" || cmd === "--help") {
    console.log(USAGE);
    return;
  }
  const store = new Store(DB_PATH);
  let serving = false;
  try {
    switch (cmd) {
      case "import": {
        const { a, b } = validateSample(
          parseList(getArg(args, "--a") ?? ""),
          parseList(getArg(args, "--b") ?? ""),
        );
        const name = getArg(args, "--name") ?? "未命名样本";
        const id = store.insertSample(name, a, b);
        print({ id, name, groupA: a, groupB: b });
        break;
      }
      case "list":
        print(store.listSamples());
        break;
      case "distance": {
        const g = resolveGroups(store, args);
        print(computeDistance(g.name, g.a, g.b));
        break;
      }
      case "ecdf": {
        const g = resolveGroups(store, args);
        print(computeEcdf(g.name, g.a, g.b));
        break;
      }
      case "test": {
        const g = resolveGroups(store, args);
        const report = buildReport(g.name, g.a, g.b);
        let reportId: number | null = null;
        const idStr = getArg(args, "--id");
        if (idStr !== undefined) reportId = store.insertReport(Number(idStr), report);
        print({ reportId, ...report });
        break;
      }
      case "dist": {
        const g = resolveGroups(store, args);
        print(computeDistribution(g.name, g.a, g.b));
        break;
      }
      case "report": {
        const id = Number(getArg(args, "--id"));
        const row = Number.isInteger(id) ? store.getReport(id) : null;
        if (!row) throw new ApiError("NOT_FOUND", `报告 ${getArg(args, "--id")} 不存在`, 404);
        print(row);
        break;
      }
      case "serve": {
        const port = Number(getArg(args, "--port") ?? "0");
        const actual = await startServer(store, port);
        console.log(`KS 精确检验服务已启动: http://localhost:${actual}`);
        serving = true;
        return; // 保持进程运行，不关闭 store
      }
      case "demo":
        runDemo(store);
        break;
      default:
        console.error(`未知命令: ${cmd}\n\n${USAGE}`);
        process.exitCode = 2;
    }
  } finally {
    if (!serving) store.close();
  }
}

main().catch((err) => {
  if (err instanceof ApiError) {
    console.error(`错误 [${err.code}]: ${err.message}`);
    process.exitCode = 1;
  } else {
    console.error(err);
    process.exitCode = 1;
  }
});
