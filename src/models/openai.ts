import OpenAI from "openai";
import { CtrfReport } from "../../types/ctrf";
import { Arguments } from "../index";
import { saveUpdatedReport, stripAnsi } from "../common";

export async function openAI(systemPrompt: string, prompt: string, args: Arguments): Promise<string | null> {
    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const response = await client.chat.completions.create({
            model: args.model || "gpt-4o",
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
        console.error(`Error invoking OpenAI`, error);
        return null; 
    }
}

export async function openAIFailedTestSummary(report: CtrfReport, file: string, args: Arguments) {
    const failedTests = report.results.tests.filter(test => test.status === 'failed');

    let logged = false;
    for (const test of failedTests) {
        const prompt = `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool:${report.results.tool.name}.\n\n Please provide a human-readable failure summary that explains why you think the test might have failed and ways to fix`;
        const systemPrompt = args.systemPrompt || ""
        const response = await openAI(systemPrompt, prompt, args);

        if (response) {
            test.ai = response;
            if (args.log && !logged) {
                console.log(`\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────`);
                console.log(`✨ AI Test Reporter Summary`);
                console.log(`─────────────────────────────────────────────────────────────────────────────────────────────────────────────\n`);
                logged = true;
            }
            console.log(`❌ Failed Test: ${test.name}\n`)
            console.log(`${response}\n`);
        }
    }
    saveUpdatedReport(file, report);
}
