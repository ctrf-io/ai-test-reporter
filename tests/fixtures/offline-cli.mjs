import http2 from "node:http2";
import nock from "nock";

// Preloaded only by cli-contract.test.ts. Never reads real credentials.
nock.disableNetConnect();
http2.connect = () => {
	throw new Error("Unmocked HTTP/2 is blocked");
};
process.env.AI_CTRF_CUSTOM_API_KEY = "offline-dummy-key";
const response = (content) => ({
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
const analysis = {
	summary: "Fixture failure",
	code_issues: "Assertion mismatch",
	timeout_issues: "",
	application_issues: "",
	recommendations: "Fix the assertion",
};
nock("https://offline-custom.example")
	.matchHeader("authorization", "Bearer offline-dummy-key")
	.post(
		"/v1/chat/completions",
		(body) =>
			body.model === "fixture-model" &&
			body.messages.some((message) => message.content.includes("fails")),
	)
	.reply(200, response("Individual summary"))
	.post("/v1/chat/completions", (body) =>
		body.messages.some((message) =>
			message.content.includes("Individual summary"),
		),
	)
	.reply(200, response("Overall summary"))
	.post("/v1/chat/completions", (body) =>
		body.messages.some((message) =>
			message.content.includes("Failed Test Details"),
		),
	)
	.reply(200, response(JSON.stringify(analysis)));
process.on("exit", () => {
	if (!nock.isDone()) {
		console.error("Unconsumed CLI wire fixtures");
		process.exitCode = 1;
	}
});
