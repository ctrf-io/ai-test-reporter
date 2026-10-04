import fs from "node:fs";
import http2 from "node:http2";
import { Readable } from "node:stream";
import { NodeHttp2Handler } from "@smithy/node-http-handler";
import os from "node:os";
import path from "node:path";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Arguments } from "../src/index";
import { openAI, openAIFailedTestSummary } from "../src/models/openai";
import { azureOpenAI } from "../src/models/azure-openai";
import { customService } from "../src/models/custom";
import { mistralAI } from "../src/models/mistral";
import { grokAI } from "../src/models/grok";
import { deepseekAI } from "../src/models/deepseek";
import { perplexity } from "../src/models/perplexity";
import { openRouter } from "../src/models/openrouter";
import { claudeAI } from "../src/models/claude";
import { gemini } from "../src/models/gemini";
import { bedrock } from "../src/models/bedrock";
import { ollama } from "../src/models/ollama";
import { generateJsonSummary } from "../src/json-summary";
import type { CtrfReport } from "../types/ctrf";

// Synthetic wire fixtures, following the official contracts listed in
// tests/README.md. No provider SDK or SDK method is mocked.
const chatResponse = (
	content: string | null = "Check the expected value.",
) => ({
	id: "chatcmpl-offline",
	object: "chat.completion",
	created: 1720000000,
	model: "fixture-model",
	choices: [
		{
			index: 0,
			message: { role: "assistant", content, refusal: null },
			finish_reason: "stop",
			logprobs: null,
		},
	],
	usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
});
const claudeResponse = () => ({
	id: "msg_offline",
	type: "message",
	role: "assistant",
	model: "fixture-model",
	content: [{ type: "text", text: "Check the expected value." }],
	stop_reason: "end_turn",
	stop_sequence: null,
	usage: { input_tokens: 12, output_tokens: 6 },
});
const args: Arguments = {
	_: [],
	model: "fixture-model",
	maxTokens: 64,
	temperature: 0.2,
	frequencyPenalty: 0,
	presencePenalty: 0,
};
const report = (): CtrfReport & {
	reportFormat: string;
	specVersion: string;
} => ({
	reportFormat: "CTRF",
	specVersion: "0.1.0",
	results: {
		tool: { name: "vitest" },
		summary: {
			tests: 3,
			passed: 1,
			failed: 2,
			skipped: 0,
			pending: 0,
			other: 0,
			start: 1,
			stop: 2,
		},
		tests: [
			{
				name: "first failure",
				status: "failed",
				duration: 1,
				message: "expected true",
				extra: { ticket: "KEEP-123" },
			},
			{ name: "passes", status: "passed", duration: 2 },
			{ name: "second failure", status: "failed", duration: 3 },
		],
	},
});

beforeEach(() => {
	nock.disableNetConnect();
	for (const key of [
		"OPENAI_API_KEY",
		"ANTHROPIC_API_KEY",
		"GOOGLE_API_KEY",
		"MISTRAL_API_KEY",
		"GROK_API_KEY",
		"DEEPSEEK_API_KEY",
		"PERPLEXITY_API_KEY",
		"OPENROUTER_API_KEY",
		"AZURE_OPENAI_API_KEY",
		"AI_CTRF_CUSTOM_API_KEY",
	])
		vi.stubEnv(key, "offline-dummy-key");
	vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://offline-azure.example");
	vi.stubEnv("AZURE_OPENAI_DEPLOYMENT_NAME", "fixture-deployment");
	vi.stubEnv("AI_CTRF_CUSTOM_URL", "https://offline-custom.example/v1");
	vi.stubEnv("GROK_API_BASE_URL", "https://api.x.ai/v1");
	vi.stubEnv("DEEPSEEK_API_BASE_URL", "https://api.deepseek.com/v1");
	vi.stubEnv("OPENROUTER_REFERER", "https://offline.example");
	vi.stubEnv("OLLAMA_BASE_URL", "http://offline-ollama.example:11434");
	vi.stubEnv("AWS_ACCESS_KEY_ID", "offline-access-key");
	vi.stubEnv("AWS_SECRET_ACCESS_KEY", "offline-secret-key");
	vi.stubEnv("AWS_SESSION_TOKEN", "offline-session-token");
	vi.stubEnv("AWS_REGION", "us-west-2");
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(http2, "connect").mockImplementation(() => {
		throw new Error("Unmocked HTTP/2 connections are blocked");
	});
});
afterEach(() => {
	const pending = nock.pendingMocks();
	nock.cleanAll();
	nock.enableNetConnect();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
	expect(pending, "Every expected HTTP request must be consumed").toEqual([]);
});

const chatProviders = [
	{
		name: "OpenAI",
		url: "https://api.openai.com",
		route: "/v1/chat/completions",
		invoke: openAI,
	},
	{
		name: "Azure",
		url: "https://offline-azure.example",
		route: "/openai/deployments/fixture-deployment/chat/completions",
		invoke: azureOpenAI,
	},
	{
		name: "Mistral",
		url: "https://api.mistral.ai",
		route: "/v1/chat/completions",
		invoke: mistralAI,
	},
	{
		name: "Grok",
		url: "https://api.x.ai",
		route: "/v1/chat/completions",
		invoke: grokAI,
	},
	{
		name: "DeepSeek",
		url: "https://api.deepseek.com",
		route: "/v1/chat/completions",
		invoke: deepseekAI,
	},
	{
		name: "Perplexity",
		url: "https://api.perplexity.ai",
		route: "/chat/completions",
		invoke: perplexity,
	},
	{
		name: "OpenRouter",
		url: "https://openrouter.ai",
		route: "/api/v1/chat/completions",
		invoke: openRouter,
	},
	{
		name: "Custom",
		url: "https://offline-custom.example",
		route: "/v1/chat/completions",
		invoke: customService,
	},
];

describe.each(chatProviders)(
	"$name wire contract",
	({ name, url, route, invoke }) => {
		const intercept = () => {
			const scope = nock(url).matchHeader(
				name === "Azure" ? "api-key" : "authorization",
				name === "Azure" ? "offline-dummy-key" : "Bearer offline-dummy-key",
			);
			if (name === "OpenRouter")
				scope
					.matchHeader("http-referer", "https://offline.example")
					.matchHeader("x-title", "AI Test Reporter");
			const request = scope.post(route, (body: Record<string, unknown>) => {
				expect(body).toMatchObject({
					model: name === "Azure" ? "fixture-deployment" : "fixture-model",
					max_tokens: 64,
					temperature: 0.2,
					messages: [
						{ role: "system", content: "Explain failure" },
						{ role: "user", content: "failed assertion" },
					],
				});
				return true;
			});
			return name === "Azure"
				? request.query({ "api-version": "2024-05-01-preview" })
				: request;
		};
		it("serializes options and parses an assistant response with the real SDK", async () => {
			intercept().reply(200, chatResponse());
			expect(
				await invoke(
					"Explain failure",
					"\u001b[31mfailed assertion\u001b[39m",
					args,
				),
			).toBe("Check the expected value.");
		});
		it("returns null when the assistant has no textual content", async () => {
			intercept().reply(200, chatResponse(null));
			expect(
				await invoke("Explain failure", "failed assertion", args),
			).toBeNull();
		});
		it("handles an API authentication error without throwing", async () => {
			intercept().reply(401, {
				error: {
					message: "Invalid dummy key",
					type: "authentication_error",
					code: "invalid_api_key",
				},
			});
			expect(
				await invoke("Explain failure", "failed assertion", args),
			).toBeNull();
			expect(console.error).toHaveBeenCalled();
		});
	},
);

describe("other provider wire contracts", () => {
	it("parses Anthropic text blocks and ignores thinking blocks", async () => {
		const response = claudeResponse();
		const scope = nock("https://api.anthropic.com")
			.matchHeader("x-api-key", "offline-dummy-key")
			.matchHeader("anthropic-version", "2023-06-01")
			.post("/v1/messages", {
				model: "fixture-model",
				max_tokens: 64,
				temperature: 0.2,
				system: "Explain failure",
				messages: [{ role: "user", content: "failed assertion" }],
			})
			.reply(200, {
				...response,
				content: [
					{
						type: "thinking",
						thinking: "private reasoning",
						signature: "fixture",
					},
					...response.content,
					{ type: "text", text: "Then rerun." },
				],
			});
		expect(
			await claudeAI(
				"Explain failure",
				"\u001b[31mfailed assertion\u001b[39m",
				args,
			),
		).toBe("Check the expected value. Then rerun.");
		expect(scope.isDone()).toBe(true);
	});
	it("handles Anthropic errors", async () => {
		nock("https://api.anthropic.com")
			.post("/v1/messages")
			.reply(400, {
				type: "error",
				error: { type: "invalid_request_error", message: "Invalid request" },
				request_id: "req_offline",
			});
		expect(await claudeAI("system", "prompt", args)).toBeNull();
	});
	it("parses Gemini candidates with the real Google SDK", async () => {
		nock("https://generativelanguage.googleapis.com")
			.matchHeader("x-goog-api-key", "offline-dummy-key")
			.post("/v1beta/models/fixture-model:generateContent", {
				generationConfig: {},
				safetySettings: [],
				contents: [
					{
						role: "user",
						parts: [{ text: "Explain failure\n\nfailed assertion" }],
					},
				],
			})
			.reply(200, {
				candidates: [
					{
						content: {
							role: "model",
							parts: [{ text: "Check the expected value." }],
						},
						finishReason: "STOP",
						index: 0,
					},
				],
				usageMetadata: {
					promptTokenCount: 12,
					candidatesTokenCount: 6,
					totalTokenCount: 18,
				},
			});
		expect(
			await gemini(
				"Explain failure",
				"\u001b[31mfailed assertion\u001b[39m",
				args,
			),
		).toBe("Check the expected value.");
	});
	it("handles Gemini safety-blocked content", async () => {
		nock("https://generativelanguage.googleapis.com")
			.post("/v1beta/models/fixture-model:generateContent")
			.reply(200, { promptFeedback: { blockReason: "SAFETY" } });
		expect(await gemini("system", "prompt", args)).toBeNull();
	});
	it("signs and parses Bedrock InvokeModel using the real AWS SDK", async () => {
		// Bedrock uses HTTP/2, which Nock does not intercept. Substitute only
		// its wire transport; command serialization, signing and decoding run.
		const transport = vi
			.spyOn(NodeHttp2Handler.prototype, "handle")
			.mockImplementation(async (request) => {
				expect(request.hostname).toBe(
					"bedrock-runtime.us-west-2.amazonaws.com",
				);
				expect(request.path).toBe("/model/fixture-model/invoke");
				expect(request.method).toBe("POST");
				expect(request.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 /);
				expect(request.headers["x-amz-security-token"]).toBe(
					"offline-session-token",
				);
				expect(JSON.parse(request.body as string)).toEqual({
					anthropic_version: "bedrock-2023-05-31",
					max_tokens: 64,
					system: "Explain failure",
					messages: [{ role: "user", content: "failed assertion" }],
					temperature: 0.2,
				});
				return {
					response: {
						statusCode: 200,
						headers: { "content-type": "application/json" },
						body: Readable.from([JSON.stringify(claudeResponse())]),
					},
				};
			});
		expect(
			await bedrock(
				"Explain failure",
				"\u001b[31mfailed assertion\u001b[39m",
				args,
			),
		).toBe("Check the expected value.");
		expect(transport).toHaveBeenCalledOnce();
	});
	it("handles Bedrock service errors", async () => {
		const transport = vi
			.spyOn(NodeHttp2Handler.prototype, "handle")
			.mockResolvedValue({
				response: {
					statusCode: 400,
					headers: {
						"x-amzn-errortype": "ValidationException",
						"content-type": "application/json",
					},
					body: Readable.from([JSON.stringify({ message: "Invalid model" })]),
				},
			});
		expect(await bedrock("system", "prompt", args)).toBeNull();
		expect(transport).toHaveBeenCalledOnce();
		expect(console.error).toHaveBeenCalled();
	});
	it("parses Ollama non-streaming generation", async () => {
		nock("http://offline-ollama.example:11434")
			.post("/api/generate", {
				model: "fixture-model",
				prompt: "Explain failure\n\nfailed assertion",
				stream: false,
			})
			.reply(200, {
				model: "fixture-model",
				created_at: "2026-10-04T00:00:00Z",
				response: "Check the expected value.",
				done: true,
				done_reason: "stop",
			});
		expect(
			await ollama(
				"Explain failure",
				"\u001b[31mfailed assertion\u001b[39m",
				args,
			),
		).toBe("Check the expected value.");
	});
	it("blocks unexpected outbound requests", async () => {
		await expect(fetch("https://unmocked.example/provider")).rejects.toThrow();
	});
});

describe("AI report behavior through the real OpenAI SDK", () => {
	it("writes summaries, enforces the message limit, and consolidates", async () => {
		const input = report();
		const before = structuredClone(input);
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ai-contract-"));
		const file = path.join(directory, "report.json");
		nock("https://api.openai.com")
			.post("/v1/chat/completions")
			.reply(200, chatResponse("Individual summary"))
			.post(
				"/v1/chat/completions",
				(body: { messages: { content: string }[] }) =>
					body.messages.some((message) =>
						message.content.includes("Individual summary"),
					),
			)
			.reply(200, chatResponse("Overall summary"));
		try {
			await openAIFailedTestSummary(
				input,
				{ ...args, maxMessages: 1, consolidate: true, log: false },
				file,
			);
			expect(input.results.tests[0].ai).toBe("Individual summary");
			expect(input.results.tests[1]).toEqual(before.results.tests[1]);
			expect(input.results.tests[2].ai).toBeUndefined();
			expect(input.results.summary).toEqual(before.results.summary);
			expect(input.results.extra?.ai).toBe("Overall summary");
			expect(JSON.parse(fs.readFileSync(file, "utf8"))).toEqual(input);
		} finally {
			fs.rmSync(directory, { recursive: true });
		}
	});
	it("retries a rate-limit response through the real OpenAI SDK", async () => {
		nock("https://api.openai.com")
			.post("/v1/chat/completions")
			.reply(
				429,
				{ error: { message: "Rate limited", type: "rate_limit_error" } },
				{ "retry-after-ms": "1" },
			)
			.post("/v1/chat/completions")
			.reply(200, chatResponse("Recovered"));
		expect(await openAI("system", "prompt", args)).toBe("Recovered");
	});
	it("keeps failed API requests from adding fabricated summaries", async () => {
		const input = report();
		nock("https://api.openai.com")
			.post("/v1/chat/completions")
			.twice()
			.reply(401, {
				error: { message: "Invalid key", type: "authentication_error" },
			});
		await openAIFailedTestSummary(input, { ...args, consolidate: false });
		expect(input.results.tests.every((test) => test.ai === undefined)).toBe(
			true,
		);
		expect(input.results.summary.failed).toBe(2);
	});
	it("parses structured JSON analysis inside Markdown fences", async () => {
		const analysis = {
			summary: "Failure",
			code_issues: "Assertion",
			timeout_issues: "",
			application_issues: "",
			recommendations: "Fix assertion",
		};
		nock("https://api.openai.com")
			.post("/v1/chat/completions")
			.reply(
				200,
				chatResponse(
					`\u0060\u0060\u0060json\n${JSON.stringify(analysis)}\n\u0060\u0060\u0060`,
				),
			);
		expect(await generateJsonSummary(report(), "openai", args)).toEqual(
			analysis,
		);
	});
	it.each(["not JSON", JSON.stringify({ summary: 123 })])(
		"rejects malformed structured analysis: %s",
		async (content) => {
			nock("https://api.openai.com")
				.post("/v1/chat/completions")
				.reply(200, chatResponse(content));
			expect(await generateJsonSummary(report(), "openai", args)).toBeNull();
		},
	);
});
