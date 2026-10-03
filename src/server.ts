import * as http from "node:http";
import { Store } from "./db";
import { KsService } from "./service";
import { ApiError } from "./errors";

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        reject(new ApiError("INVALID_INPUT", "请求体不是合法 JSON"));
      }
    });
    req.on("error", reject);
  });
}

function parseId(segment: string | undefined): number {
  const id = Number(segment);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError("INVALID_INPUT", `非法的 id: ${segment ?? "(空)"}`);
  }
  return id;
}

export function createServer(service: KsService, store: Store): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const parts = url.pathname.split("/").filter(Boolean);
      const method = req.method ?? "GET";

      if (method === "GET" && parts.length === 0) {
        return sendJson(res, 200, {
          service: "ks-exact-backend",
          endpoints: [
            "POST /datasets {name, groupA:[], groupB:[]}",
            "GET /datasets",
            "GET /datasets/:id",
            "POST /datasets/:id/distance",
            "GET /datasets/:id/ecdf",
            "POST /datasets/:id/permutation-test",
            "GET /datasets/:id/distribution",
            "POST /datasets/:id/report",
            "GET /analyses/:id",
          ],
        });
      }

      if (method === "POST" && parts[0] === "datasets" && parts.length === 1) {
        const body = (await readBody(req)) as Record<string, unknown>;
        return sendJson(
          res,
          201,
          service.importDataset(body.name as string, body.groupA, body.groupB)
        );
      }

      if (method === "GET" && parts[0] === "datasets" && parts.length === 1) {
        return sendJson(res, 200, store.listDatasets());
      }

      if (parts[0] === "datasets" && parts.length >= 2) {
        const id = parseId(parts[1]);
        const action = parts[2];
        if (method === "GET" && !action) {
          return sendJson(res, 200, store.getDataset(id));
        }
        if (method === "POST" && action === "distance") {
          return sendJson(res, 200, service.distance(id));
        }
        if (method === "GET" && action === "ecdf") {
          return sendJson(res, 200, service.ecdf(id));
        }
        if (method === "POST" && action === "permutation-test") {
          return sendJson(res, 200, service.permutationTest(id));
        }
        if (method === "GET" && action === "distribution") {
          return sendJson(res, 200, service.distribution(id));
        }
        if (method === "POST" && action === "report") {
          const { report, analysisId } = service.exportReport(id);
          res.writeHead(200, { "Content-Type": "text/markdown; charset=utf-8" });
          res.end(`<!-- analysisId: ${analysisId} -->\n` + report);
          return;
        }
      }

      if (method === "GET" && parts[0] === "analyses" && parts.length === 2) {
        return sendJson(res, 200, store.getAnalysis(parseId(parts[1])));
      }

      throw new ApiError("NOT_FOUND", `未匹配的路由: ${method} ${url.pathname}`, 404);
    } catch (err) {
      if (err instanceof ApiError) {
        return sendJson(res, err.status, { error: { code: err.code, message: err.message } });
      }
      return sendJson(res, 500, {
        error: { code: "INTERNAL", message: String(err) },
      });
    }
  });
}

export async function startServer(
  port?: number
): Promise<{ server: http.Server; port: number }> {
  const store = new Store();
  const service = new KsService(store);
  const server = createServer(service, store);
  const requested = port ?? (process.env.PORT ? Number(process.env.PORT) : 0);
  await new Promise<void>((resolve) => server.listen(requested, resolve));
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : requested;
  return { server, port: actualPort };
}

if (require.main === module) {
  startServer().then(({ port }) => {
    console.log(`KS 精确检验服务已启动: http://localhost:${port}`);
  });
}
