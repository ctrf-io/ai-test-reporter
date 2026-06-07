import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		reporters: ["default", "@d2t/vitest-ctrf-json-reporter"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "lcov"],
		},
	},
});
