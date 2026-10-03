import { Store } from "./db";
import { KsService } from "./service";
import { startServer } from "./server";

function parseSamples(args: string[]): { a: number[]; b: number[] } {
  const ai = args.indexOf("--a");
  const bi = args.indexOf("--b");
  if (ai < 0 || bi < 0) {
    throw new Error("需要 --a \"1,2,3\" --b \"4,5\" 参数");
  }
  const parse = (s: string | undefined): number[] =>
    (s ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x !== "")
      .map((x) => Number(x));
  return { a: parse(args[ai + 1]), b: parse(args[bi + 1]) };
}

function printJson(x: unknown): void {
  console.log(JSON.stringify(x, null, 2));
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const store = new Store();
  const service = new KsService(store);

  try {
    switch (command) {
      case "import": {
        const ni = rest.indexOf("--name");
        const name = ni >= 0 ? rest[ni + 1] : "未命名数据集";
        const { a, b } = parseSamples(rest);
        printJson(service.importDataset(name, a, b));
        break;
      }
      case "list":
        printJson(store.listDatasets());
        break;
      case "show":
        printJson(store.getDataset(Number(rest[0])));
        break;
      case "distance":
        printJson(service.distance(Number(rest[0])).result);
        break;
      case "ecdf":
        printJson(service.ecdf(Number(rest[0])));
        break;
      case "test":
        printJson(service.permutationTest(Number(rest[0])).result);
        break;
      case "dist":
        printJson(service.distribution(Number(rest[0])));
        break;
      case "report":
        console.log(service.exportReport(Number(rest[0])).report);
        break;
      case "analysis":
        printJson(store.getAnalysis(Number(rest[0])));
        break;
      case "serve": {
        const pi = rest.indexOf("--port");
        const port = pi >= 0 ? Number(rest[pi + 1]) : undefined;
        const { port: actual } = await startServer(port);
        console.log(`KS 精确检验服务已启动: http://localhost:${actual}`);
        return; // 保持进程运行
      }
      default:
        console.log(`用法: node dist/src/cli.js <命令> [参数]
命令:
  import --name 名称 --a "1,2,3" --b "4,5"   导入样本
  list                                        列出数据集
  show <id>                                   查看数据集
  distance <id>                               计算 KS 距离
  ecdf <id>                                   查看累计分布表
  test <id>                                   执行精确置换检验
  dist <id>                                   查看 D 的计数分布
  report <id>                                 导出 Markdown 报告
  analysis <id>                               查看已保存的分析报告
  serve [--port N]                            启动 HTTP 服务（默认空闲端口）`);
    }
  } finally {
    if (command !== "serve") store.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
