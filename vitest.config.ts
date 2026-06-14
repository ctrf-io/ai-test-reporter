import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		include: ["tests/**/*.test.ts"],
		exclude: ["node_modules/**", "dist/**", "coverage/**", "ctrf/**"],
		reporters: ["default", "@d2t/vitest-ctrf-json-reporter"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			exclude: ["dist/**", "coverage/**", "ctrf/**"],
			reporter: ["text", "json", "lcov"],
		},
	},
});
