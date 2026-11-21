import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validate } from "ctrf";
import {
	validateCtrfFile,
	saveUpdatedReport,
	generateFailedTestPrompt,
} from "../src/common";

it("preserves CTRF 0.3.0 diagnostics, provenance and retry worker metadata", () => {
	const input = JSON.parse(
		fs.readFileSync(
			new URL("./fixtures/ctrf-0.3.0.json", import.meta.url),
			"utf8",
		),
	);
	expect(validate(input).valid).toBe(true);
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ctrf-compat-"));
	try {
		const file = path.join(directory, "report.json");
		fs.writeFileSync(file, JSON.stringify(input));
		const parsed = validateCtrfFile(file);
		expect(parsed).toEqual(input);
		if (!parsed) throw new Error("Expected parsed report");
		expect(generateFailedTestPrompt(parsed.results.tests[0], parsed)).toContain(
			"final assertion",
		);
		saveUpdatedReport(file, parsed);
		expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(input);
	} finally {
		fs.rmSync(directory, { recursive: true, force: true });
	}
});
