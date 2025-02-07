import { CtrfReport } from "../../types/ctrf";
import { Arguments } from "../index";
import { saveUpdatedReport, stripAnsi } from "../common";
import { generateConsolidatedSummary } from "../consolidated-summary";
import OpenAI from "openai";

export async function grokAI(systemPrompt: string, prompt: string, args: Arguments): Promise<string | null> {
    const client = new OpenAI({
        apiKey: process.env.GROK_API_KEY,
        baseURL: process.env.GROK_API_BASE_URL || 'https://api.x.ai/v1',
    });

    try {
        const response = await client.chat.completions.create({
            model: args.model || "grok-2-latest",
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: stripAnsi(prompt) }
            ],
            max_tokens: args.maxTokens || null,
            frequency_penalty: args.frequencyPenalty,
            presence_penalty: args.presencePenalty,
            ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
            ...(args.topP !== undefined ? { top_p: args.topP } : {}),
        });

        return response.choices[0].message?.content || null;
    } catch (error) {
        console.error(`Error invoking Grok`, error);
        return null;
    }
}

export async function grokFailedTestSummary(report: CtrfReport, file: string, args: Arguments): Promise<CtrfReport> {
    const failedTests = report.results.tests.filter(test => test.status === 'failed');

    let logged = false;
    let messageCount = 0;

    for (const test of failedTests) {
        if (args.maxMessages && messageCount >= args.maxMessages) {
            break;
        }

        const prompt = `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool:${report.results.tool.name}.\n\n Please provide a human-readable failure summary that explains why you think the test might have failed and ways to fix`;
        const systemPrompt = args.systemPrompt || ""
        const response = await grokAI(systemPrompt, prompt, args);

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
        await generateConsolidatedSummary(report, file, "grok", args)
    }
    saveUpdatedReport(file, report);
    return report;
}
