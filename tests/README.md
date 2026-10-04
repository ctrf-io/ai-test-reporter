# Offline provider contract tests

Run `npm test` (builds the CLI first), or `npm run all` for the complete checks.
`npm run test:types` type-checks test code as well as the application.

These tests require no accounts, real API keys, running Ollama instance, or paid
requests. They set synthetic credentials locally and restore the environment.
The CLI child receives a minimal environment without user credentials.

The installed OpenAI, Anthropic, Google, and AWS SDKs remain real. Nock intercepts
HTTP requests and supplies synthetic JSON responses. Bedrock's default transport
uses HTTP/2, unsupported by Nock, so only `NodeHttp2Handler.handle` is replaced:
command serialization, AWS signing, service error decoding, and body decoding
still run. Nock blocks unmocked HTTP/1 and fetch requests; a separate HTTP/2 guard
blocks unmocked connections. Expected requests must be consumed. Tests explicitly
check that an unregistered URL cannot be contacted.

Coverage includes all 12 adapters: OpenAI, Azure, Anthropic, Gemini, Bedrock,
Mistral, Grok, DeepSeek, Perplexity, OpenRouter, custom services, and Ollama.
Assertions cover endpoint/authentication, prompt/options serialization, response
extraction, representative API errors, null assistant content, Gemini safety
blocks, Anthropic mixed content blocks, OpenAI rate-limit retry, message limits,
consolidation, report persistence, and structured JSON analysis. A separate test
launches the built CLI with an offline custom endpoint and checks all three
requests (individual summary, consolidation, JSON analysis).

## Fixture sources

Synthetic fixtures follow the non-streaming contract fields consumed by these
adapters, checked against official references on 2026-10-04:

- [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat)
- [Anthropic Messages response and stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons)
- [Gemini GenerateContent](https://ai.google.dev/api/generate-content)
- [Bedrock Anthropic Messages request/response](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html)
- [Mistral Chat](https://docs.mistral.ai/api)
- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)
- [Grok OpenAI-compatible Chat interface](https://docs.x.ai/developers/rest-api-reference/inference/chat)
- [OpenRouter response contract](https://openrouter.ai/docs/api_reference/overview)
- [Perplexity Sonar migration reference](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview)
- [Ollama Generate](https://docs.ollama.com/api/generate)

Azure tests verify this application's existing deployment URL and
`2024-05-01-preview` query using the installed AzureOpenAI SDK, with the shared
Chat Completions response shape. Custom services are tested against the
OpenAI-compatible contract they are expected to implement. These are focused
regression fixtures, not exhaustive provider schema validators or confirmation
that every model accepts every option. Dummy model names deliberately avoid
asserting current model availability. Fixtures should be reviewed when an SDK
upgrade or provider contract change is proposed.

## Known limits

Offline tests establish SDK/application compatibility for the exercised contracts;
they do not verify live service availability, actual authentication, model access,
or generated answer quality. No live test is required by this suite.

The current CLI prints its save notification even with `--log false`; the CLI
test extracts the following JSON rather than treating stdout as pure JSON.
Failed-test processing also currently removes existing test `extra` metadata.
Those behaviors predate this test change and need separate fixes; this suite
checks preservation of passed tests, outcome counts, and the report version.
