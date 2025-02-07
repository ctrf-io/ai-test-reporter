# AI Test Reporter

Generate AI test summaries using leading AI models from OpenAI and Anthropic Claude. Integrate with Developer tooling to provide AI summaries where you need them.

<div align="center">
<div style="padding: 1.5rem; border-radius: 8px; margin: 1rem 0; border: 1px solid #30363d;">
<span style="font-size: 23px;">💚</span>
<h3 style="margin: 1rem 0;">CTRF tooling is open source and free to use</h3>
<p style="font-size: 16px;">You can support the project with a follow and a star</p>

<div style="margin-top: 1.5rem;">
<a href="https://github.com/ctrf-io/ai-test-reporter">
<img src="https://img.shields.io/github/stars/ctrf-io/ai-test-reporter?style=for-the-badge&color=2ea043" alt="GitHub stars">
</a>
<a href="https://github.com/ctrf-io">
<img src="https://img.shields.io/github/followers/ctrf-io?style=for-the-badge&color=2ea043" alt="GitHub followers">
</a>
</div>
</div>

<p style="font-size: 14px; margin: 1rem 0;">
Maintained by <a href="https://github.com/ma11hewthomas">Matthew Thomas</a><br/>
Contributions are very welcome! <br/>
Explore more <a href="https://www.ctrf.io/integrations">integrations</a>
</p>
</div>

## Key Features

- Generate human-readable AI summaries for failed tests
- Use your own AI model, with support for OpenAI, Anthropic Claude and more soon
- Compatible with all major testing frameworks through standardized CTRF reports.
- Integrates AI with various CI/CD and developer tools.
- Customizable parameters like system prompt, model, temperature, max tokens, and more.
- Log AI generated summaries to the console.

![stdout](assets/stdout.png)

## Usage

Generate a CTRF report using your testing framework. [CTRF reporters](https://github.com/orgs/ctrf-io/repositories) are available for most testing frameworks and easy to install.

**No CTRF reporter? No problem!**

Use [junit-to-ctrf](https://github.com/ctrf-io/junit-to-ctrf) to convert a JUnit report to CTRF

## OpenAI

Run the following command:

```bash
npx ai-ctrf openai <path-to-ctrf-report>
```

An AI summary for each failed test will be added to your test report.

The package interacts with the OpenAI API, you must set `OPENAI_API_KEY` environment variable.

You will be responsible for any charges incurred from using your selected OpenAI model. Make sure you are aware of the associated cost.

A message is sent to OpenAI for each failed test.

### Options

`--model`: OpenAI model to use (default: gpt-3.5-turbo).

`--systemPrompt`: Custom system prompt to guide the AI response.

`--frequencyPenalty`: OpenAI frequency penalty parameter (default: 0).

`--maxTokens`: Maximum number of tokens for the response.

`--presencePenalty`: OpenAI presence penalty parameter (default: 0).

`--temperature`: Sampling temperature (conflicts with topP).

`--topP`: Top-p sampling parameter (conflicts with temperature).

`--log`: Whether to log the AI responses to the console (default: true).

`--maxMessages`: Limit the number of failing tests to send for summarization in the LLM request. This helps avoid overwhelming the model when dealing with reports that have many failing tests. (default: 10)

`consolidate`: Consolidate and summarize multiple AI summaries into a higher-level overview (default: true)

## Azure OpenAI

Run the following command:

```bash
npx ai-ctrf azure-openai <path-to-ctrf-report>
```

An AI summary for each failed test will be added to your test report.

The package interacts with the Azure OpenAI API, you must set `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, and `AZURE_OPENAI_DEPLOYMENT_NAME` environment variable or provide them as arguments.

You will be responsible for any charges incurred from using your selected Azure OpenAI model. Make sure you are aware of the associated cost.

A message is sent to Azure OpenAI for each failed test.

### Options

`--model`: OpenAI model to use (default: gpt-3.5-turbo).

`--systemPrompt`: Custom system prompt to guide the AI response.

`--frequencyPenalty`: OpenAI frequency penalty parameter (default: 0).

`--maxTokens`: Maximum number of tokens for the response.

`--presencePenalty`: OpenAI presence penalty parameter (default: 0).

`--temperature`: Sampling temperature (conflicts with topP).

`--topP`: Top-p sampling parameter (conflicts with temperature).

`--log`: Whether to log the AI responses to the console (default: true).

`--maxMessages`: Limit the number of failing tests to send for summarization in the LLM request. This helps avoid overwhelming the model when dealing with reports that have many failing tests. (default: 10)

`consolidate`: Consolidate and summarize multiple AI summaries into a higher-level overview (default: true)

## Claude

Run the following command:

```bash
npx ai-ctrf claude <path-to-ctrf-report>
```

An AI summary for each failed test will be added to your test report.

The package interacts with the Anthropic API, you must set `ANTHROPIC_API_KEY` environment variable.

You will be responsible for any charges incurred from using your selected Claude model. Make sure you are aware of the associated costs.

A message is sent to Claude for each failed test.

### Claude Options

`--model`: Claude model to use (default: claude-3-5-sonnet-20240620).

`--systemPrompt`: Custom system prompt to guide the AI response.

`--maxTokens`: Maximum number of tokens for the response.

`--temperature`: Sampling temperature.

`--log`: Whether to log the AI responses to the console (default: true).

`--maxMessages`: Limit the number of failing tests to send for summarization in the LLM request. This helps avoid overwhelming the model when dealing with reports that have many failing tests. (default: 10)

`consolidate`: Consolidate and summarize multiple AI summaries into a higher-level overview (default: true)

## Grok

Run the following command:

```bash
npx ai-ctrf grok <path-to-ctrf-report>
```


An AI summary for each failed test will be added to your test report.

The package interacts with the Grok API, you must set `GROK_API_KEY` and optionally `GROK_API_BASE_URL` environment variables.

You will be responsible for any charges incurred from using Grok. Make sure you are aware of the associated costs.

A message is sent to Grok for each failed test.

### Grok Options

`--model`: Grok model to use (default: grok-1).

`--systemPrompt`: Custom system prompt to guide the AI response.

`--maxTokens`: Maximum number of tokens for the response.

`--temperature`: Sampling temperature.

`--log`: Whether to log the AI responses to the console (default: true).

`--maxMessages`: Limit the number of failing tests to send for summarization in the LLM request. This helps avoid overwhelming the model when dealing with reports that have many failing tests. (default: 10)

`consolidate`: Consolidate and summarize multiple AI summaries into a higher-level overview (default: true)

## DeepSeek

Run the following command:

```bash
npx ai-ctrf deepseek <path-to-ctrf-report>
```

An AI summary for each failed test will be added to your test report.

The package interacts with the DeepSeek API, you must set `DEEPSEEK_API_KEY` and optionally `DEEPSEEK_API_BASE_URL` environment variables.

You will be responsible for any charges incurred from using DeepSeek. Make sure you are aware of the associated costs.

A message is sent to DeepSeek for each failed test.

### DeepSeek Options

`--model`: DeepSeek model to use (default: deepseek-coder).

`--systemPrompt`: Custom system prompt to guide the AI response.

`--maxTokens`: Maximum number of tokens for the response.

`--temperature`: Sampling temperature.

`--log`: Whether to log the AI responses to the console (default: true).

`--maxMessages`: Limit the number of failing tests to send for summarization in the LLM request. This helps avoid overwhelming the model when dealing with reports that have many failing tests. (default: 10)

`consolidate`: Consolidate and summarize multiple AI summaries into a higher-level overview (default: true)

## CTRF Report Example

``` json
{
  "results": {
    "tool": {
      "name": "AnyFramework"
    },
    "summary": {
      "tests": 1,
      "passed": 0,
      "failed": 1,
      "pending": 0,
      "skipped": 0,
      "other": 1,
      "start": 1722511783500,
      "stop": 1722511804528
    },
    "tests": [
        {
            "name": "should display profile information",
            "status": "failed",
            "duration": 800,
            "message": "Assertion Failure: profile mismatch",
            "trace": "ProfileTest.js:45...",
            "ai": "The test failed because there was a profile mismatch at line 45 of the ProfileTest.js file. To resolve this issue,   review the code at line 45 to ensure that the expected profile information matches the actual data being displayed. Check for any discrepancies and make necessary adjustments to align the expected and actual profile information."
        },
    ]
  }
}
```

## Standard Output

![stdout](assets/stdout.png)

## GitHub Actions Integration

View AI summaries in directly in the Github Actions workflow:

![Github](assets/github.png)

Add a Pull Request comment with your AI summary:

![Github](assets/github-pr.png)

## Slack Integration

Send a Slack message with your AI test summary:

![Slack](assets/slack.png)

## Support Us

If you find this project useful, consider giving it a GitHub star ⭐ It means a lot to us.
