import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
	},
	format: ["esm"],
	dts: {
		// tsup injects baseUrl; this compatibility option applies only to its TS 6 API build.
		compilerOptions: { ignoreDeprecations: "6.0" },
		entry: {
			index: "src/index.ts",
		},
	},
	clean: true,
	shims: true,
	splitting: false,
	outDir: "dist",
});
