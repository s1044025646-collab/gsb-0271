// HTTP API（node:http，无外部依赖）。端口可配置，默认 0 表示选择空闲端口。

import http from "node:http";
import { AddressInfo } from "node:net";
import { Store } from "./db.js";
import { ApiError, validateSample } from "./validate.js";
import { buildReport, computeDistance, computeDistribution, computeEcdf } from "./report.js";

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(json);
}

function sendError(res: http.ServerResponse, err: unknown): void {
  if (err instanceof ApiError) {
    send(res, err.status, { error: { code: err.code, message: err.message } });
  } else {
    send(res, 500, { error: { code: "INTERNAL", message: String(err) } });
  }
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError("INVALID_INPUT", "请求体不是合法 JSON");
  }
}

export function createServer(store: Store): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const parts = url.pathname.split("/").filter(Boolean);
      const method = req.method ?? "GET";

      // POST /samples  {name?, groupA: [...], groupB: [...]}
      if (method === "POST" && parts[0] === "samples" && parts.length === 1) {
        const body = (await readBody(req)) as Record<string, unknown>;
        const { a, b } = validateSample(body.groupA, body.groupB);
        const name = typeof body.name === "string" && body.name ? body.name : "未命名样本";
        const id = store.insertSample(name, a, b);
        send(res, 201, { id, name, groupA: a, groupB: b });
        return;
      }

      // GET /samples
      if (method === "GET" && parts[0] === "samples" && parts.length === 1) {
        send(res, 200, { samples: store.listSamples() });
        return;
      }

      if (parts[0] === "samples" && parts.length >= 2) {
        const id = Number(parts[1]);
        const sample = Number.isInteger(id) ? store.getSample(id) : null;
        if (!sample) throw new ApiError("NOT_FOUND", `样本 ${parts[1]} 不存在`, 404);

        // GET /samples/:id
        if (method === "GET" && parts.length === 2) {
          send(res, 200, sample);
          return;
        }
        // GET /samples/:id/distance
        if (method === "GET" && parts[2] === "distance") {
          send(res, 200, computeDistance(sample.name, sample.groupA, sample.groupB));
          return;
        }
        // GET /samples/:id/ecdf
        if (method === "GET" && parts[2] === "ecdf") {
          send(res, 200, computeEcdf(sample.name, sample.groupA, sample.groupB));
          return;
        }
        // POST /samples/:id/test  执行精确检验并保存报告
        if (method === "POST" && parts[2] === "test") {
          const report = buildReport(sample.name, sample.groupA, sample.groupB);
          const reportId = store.insertReport(sample.id, report);
          send(res, 200, { reportId, ...report });
          return;
        }
        // GET /samples/:id/distribution
        if (method === "GET" && parts[2] === "distribution") {
          send(res, 200, computeDistribution(sample.name, sample.groupA, sample.groupB));
          return;
        }
      }

      // GET /reports/:id  导出冻结报告
      if (method === "GET" && parts[0] === "reports" && parts.length === 2) {
        const id = Number(parts[1]);
        const row = Number.isInteger(id) ? store.getReport(id) : null;
        if (!row) throw new ApiError("NOT_FOUND", `报告 ${parts[1]} 不存在`, 404);
        send(res, 200, row);
        return;
      }

      throw new ApiError("NOT_FOUND", `未知路由: ${method} ${url.pathname}`, 404);
    } catch (err) {
      sendError(res, err);
    }
  });
}

export function startServer(store: Store, port: number): Promise<number> {
  const server = createServer(store);
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, () => {
      const addr = server.address() as AddressInfo;
      resolve(addr.port);
    });
  });
}
