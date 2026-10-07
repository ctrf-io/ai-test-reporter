import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { saveUpdatedReport, validateCtrfFile } from "../src/common";
const identityReport = () => ({
	reportFormat: "CTRF",
	specVersion: "0.1.0",
	reportId: "11111111-1111-4111-8111-111111111111",
	runId: "run",
	results: {
		tool: { name: "fixture" },
		environment: { shardId: "one" },
		summary: {
			tests: 1,
			passed: 1,
			failed: 0,
			skipped: 0,
			pending: 0,
			other: 0,
			start: 1,
			stop: 2,
		},
		tests: [
			{
				name: "same",
				testId: "logical",
				executionId: "execution",
				status: "passed",
				duration: 1,
				retries: 1,
				flaky: true,
				retryAttempts: [
					{
						attempt: 1,
						attemptId: "attempt",
						status: "failed",
						attachments: [
							{
								name: "log",
								path: "prior.txt",
								contentType: "text/plain",
								attachmentId: "prior-ref",
							},
						],
					},
				],
				attachments: [
					{
						name: "log",
						path: "final.txt",
						contentType: "text/plain",
						attachmentId: "final-ref",
					},
				],
			},
		],
	},
});

describe("derived artifact identity", () => {
	it("renews only the artifact ID when content changes, retaining all nested identities", () => {
		const directory = fs.mkdtempSync(
			path.join(os.tmpdir(), "ctrf-ai-identity-"),
		);
		try {
			const input = identityReport();
			const filename = path.join(directory, "report.json");
			fs.writeFileSync(filename, JSON.stringify(input));
			const updated = {
				...input,
				results: { ...input.results, extra: { aiSummary: "new content" } },
			};
			saveUpdatedReport(filename, updated as never);
			const derived = validateCtrfFile(filename);
			expect(derived?.reportId).not.toBe(input.reportId);
			expect(derived?.runId).toBe(input.runId);
			expect(derived?.results.tests).toEqual(input.results.tests);
			saveUpdatedReport(filename, derived as never);
			expect(validateCtrfFile(filename)?.reportId).toBe(derived?.reportId);
		} finally {
			fs.rmSync(directory, { recursive: true, force: true });
		}
	});
});
