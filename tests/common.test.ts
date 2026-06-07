import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	generateFailedTestPrompt,
	saveUpdatedReport,
	stripAnsi,
	validateCtrfFile,
} from "../src/common";

const createReport = () => ({
	results: {
		tool: {
			name: "vitest",
		},
		summary: {
			tests: 1,
			passed: 0,
			failed: 1,
			skipped: 0,
			pending: 0,
			other: 0,
			start: 1,
			stop: 2,
		},
		environment: {
			appName: "api",
		},
		tests: [
			{
				name: "fails",
				status: "failed",
				duration: 1,
				message: "\u001b[31mexpected true to be false\u001b[39m",
			},
		],
	},
});

describe("common CTRF helpers", () => {
	it("validates and saves CTRF reports", () => {
		const filePath = path.join(os.tmpdir(), `ai-ctrf-${Date.now()}.json`);
		const report = createReport();

		saveUpdatedReport(filePath, report as never);

		expect(validateCtrfFile(filePath)).toEqual(report);
	});

	it("returns null for invalid CTRF content", () => {
		const filePath = path.join(
			os.tmpdir(),
			`ai-ctrf-invalid-${Date.now()}.json`,
		);
		fs.writeFileSync(filePath, JSON.stringify({ results: {} }));

		expect(validateCtrfFile(filePath)).toBeNull();
	});

	it("strips ANSI escape codes from model prompt input", () => {
		expect(stripAnsi("\u001b[31mfailed\u001b[39m")).toBe("failed");
	});

	it("builds a failed test prompt with tool and environment context", () => {
		const report = createReport();
		const prompt = generateFailedTestPrompt(
			report.results.tests[0],
			report as never,
		);

		expect(prompt).toContain("Test Name: fails");
		expect(prompt).toContain("Test Tool: vitest");
		expect(prompt).toContain("Environment:");
		expect(prompt).toContain("expected true to be false");
	});
});
