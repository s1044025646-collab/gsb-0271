import { Store } from "./db";
import { validateSamples } from "./validate";
import { ksDistance, KsResult } from "./ks";
import { exactPermutationTest, PermutationResult } from "./permutation";
import { renderReport } from "./report";

export class KsService {
  constructor(private store: Store) {}

  importDataset(name: string, a: unknown, b: unknown) {
    if (typeof name !== "string" || name.trim() === "") {
      name = "未命名数据集";
    }
    const v = validateSamples(a, b);
    const id = this.store.createDataset(name, v.a, v.b);
    return { id, name, n: v.a.length, m: v.b.length };
  }

  distance(datasetId: number): { result: KsResult; analysisId: number } {
    const { a, b } = this.store.getDataset(datasetId);
    const result = ksDistance(a, b);
    const analysisId = this.store.saveAnalysis(datasetId, "distance", result);
    return { result, analysisId };
  }

  ecdf(datasetId: number) {
    const { a, b } = this.store.getDataset(datasetId);
    return ksDistance(a, b).table;
  }

  permutationTest(datasetId: number): {
    result: PermutationResult;
    analysisId: number;
  } {
    const { a, b } = this.store.getDataset(datasetId);
    const result = exactPermutationTest(a, b);
    const analysisId = this.store.saveAnalysis(
      datasetId,
      "permutation-test",
      result
    );
    return { result, analysisId };
  }

  distribution(datasetId: number) {
    const { a, b } = this.store.getDataset(datasetId);
    const result = exactPermutationTest(a, b);
    return {
      totalAssignments: result.totalAssignments,
      distribution: result.distribution,
      distributionSumOk: result.distributionSumOk,
    };
  }

  exportReport(datasetId: number): { report: string; analysisId: number } {
    const { dataset, a, b } = this.store.getDataset(datasetId);
    const ks = ksDistance(a, b);
    const perm = exactPermutationTest(a, b);
    const report = renderReport(datasetId, dataset.name, a, b, ks, perm);
    const analysisId = this.store.saveAnalysis(datasetId, "report", {
      ks,
      perm,
      report,
    });
    return { report, analysisId };
  }
}
