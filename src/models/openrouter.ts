import OpenAI from "openai";
import { CtrfReport } from "../../types/ctrf";
import { Arguments } from "../index";
import { saveUpdatedReport, stripAnsi } from "../common";
import { generateConsolidatedSummary } from "../consolidated-summary";
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from "../constants";

export async function openRouter(systemPrompt: string, prompt: string, args: Arguments): Promise<string | null> {
    const client = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
            "HTTP-Referer": process.env.OPENROUTER_REFERER || "http://localhost:3000",
            "X-Title": "AI Test Reporter"
        }
    });

    try {
        const response = await client.chat.completions.create({
            model: args.model || 'openai/gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: stripAnsi(prompt) }
            ],
            max_tokens: args.maxTokens || undefined,
            temperature: args.temperature || undefined,
            ...(args.frequencyPenalty !== undefined && { frequency_penalty: args.frequencyPenalty }),
            ...(args.presencePenalty !== undefined && { presence_penalty: args.presencePenalty }),
            ...(args.topP !== undefined && { top_p: args.topP })
        });

        if (!response?.choices?.[0]?.message?.content) {
            throw new Error(`OpenRouter response is missing expected content structure: ${JSON.stringify(response, null, 2)}`);
        }

        return response.choices[0].message.content;
    } catch (error: unknown) {
        console.error(`Error invoking OpenRouter`, error);
        return null;
    }
}

export async function openRouterFailedTestSummary(report: CtrfReport, args: Arguments, file?: string, log = false): Promise<CtrfReport> {
    const failedTests = report.results.tests.filter(test => test.status === 'failed');
    failedTests.forEach(test => {
        if (test.extra) {
            delete test.extra;
        }
    });

    let logged = false;
    let messageCount = 0;

    for (const test of failedTests) {
        if (args.maxMessages && messageCount >= args.maxMessages) {
            break;
        }

        const prompt = `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool:${report.results.tool.name}.\n\n Please provide a human-readable failure summary that explains why you think the test might have failed and ways to fix`;
        const systemPrompt = args.systemPrompt || FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT;
        const response = await openRouter(systemPrompt, prompt, args);

        if (response) {
            test.ai = response;
            messageCount++;
            if (args.log && !logged) {
                console.log(`\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────`);
                console.log(`✨ AI Test Reporter Summary`);
                console.log(`─────────────────────────────────────────────────────────────────────────────────────────────────────────────\n`);
                logged = true;
            }
            if (args.log) {
                console.log(`❌ Failed Test: ${test.name}\n`)
                console.log(`${response}\n`);
            }
        }
    }
    if (args.consolidate) {
        await generateConsolidatedSummary(report, "openrouter", args)
    }
    if (file) {
        saveUpdatedReport(file, report);
    }
    return report;
} 