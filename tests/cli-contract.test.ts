import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("runs the built CLI offline through custom endpoint, consolidation and JSON analysis", async () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ai-cli-contract-"));
	const file = path.join(directory, "report.json");
	const input = {
		reportFormat: "CTRF",
		specVersion: "0.1.0",
		results: {
			tool: { name: "vitest" },
			summary: {
				tests: 2,
				passed: 1,
				failed: 1,
				skipped: 0,
				pending: 0,
				other: 0,
				start: 1,
				stop: 2,
			},
			tests: [
				{ name: "fails", status: "failed", duration: 1 },
				{ name: "passes", status: "passed", duration: 2 },
			],
		},
	};
	fs.writeFileSync(file, JSON.stringify(input));
	try {
		// A minimal environment keeps local user credentials out of the child.
		const { stdout, stderr } = await promisify(execFile)(
			process.execPath,
			[
				"--import",
				path.resolve("tests/fixtures/offline-cli.mjs"),
				path.resolve("dist/index.js"),
				"custom",
				file,
				"--url",
				"https://offline-custom.example/v1",
				"--model",
				"fixture-model",
				"--log",
				"false",
				"--consolidate",
				"true",
				"--json-analysis",
			],
			{
				env: { PATH: process.env.PATH, HOME: directory, NO_PROXY: "*" },
				timeout: 10000,
			},
		);
		expect(stderr).toBe("");
		// The current CLI always prints its save notification, even with --log false.
		expect(stdout).toContain("Updated report saved to ");
		expect(JSON.parse(stdout.slice(stdout.indexOf("{")))).toMatchObject({
			summary: "Fixture failure",
			recommendations: "Fix the assertion",
		});
		const output = JSON.parse(fs.readFileSync(file, "utf8"));
		expect(output.results.tests[0].ai).toBe("Individual summary");
		expect(output.results.tests[1]).toEqual(input.results.tests[1]);
		expect(output.results.extra.ai).toBe("Overall summary");
		expect(output.results.summary).toEqual(input.results.summary);
		expect(output.specVersion).toBe("0.1.0");
	} finally {
		fs.rmSync(directory, { recursive: true });
	}
});
