import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
	},
	format: ["esm"],
	dts: {
		entry: {
			index: "src/index.ts",
		},
	},
	clean: true,
	shims: true,
	splitting: false,
	outDir: "dist",
});
