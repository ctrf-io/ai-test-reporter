import { CtrfReport } from "../../types/ctrf";
import { Arguments } from "../index";
import { saveUpdatedReport, stripAnsi } from "../common";
import { Anthropic } from "@anthropic-ai/sdk";

export async function claudeAI(systemPrompt: string, prompt: string, args: Arguments): Promise<string | null> {
    const client = new Anthropic({
        apiKey: process.env['ANTHROPIC_API_KEY'],
    });

    try {
        const response = await client.messages.create({
            system: systemPrompt,
            messages: [
                { role: 'user', content: stripAnsi(prompt) },
            ],
            max_tokens: args.maxTokens || 300,
            model: args.model || "claude-3-5-sonnet-20240620",
            temperature: args.temperature || 1
        });

        const aiResponseArray = response.content;
        const aiResponse = aiResponseArray
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join(' ');

        return aiResponse || null;
    } catch (error) {
        console.error(`Error invoking Claude AI`, error);
        return null;
    }
}

export async function claudeFailedTestSummary(report: CtrfReport, file: string, args: Arguments) {
    const failedTests = report.results.tests.filter(test => test.status === 'failed');

    let logged = false;
    let messageCount = 0;

    for (const test of failedTests) {
        if (args.maxMessages && messageCount >= args.maxMessages) {
            break;
        }

        const prompt = `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool:${report.results.tool.name}.\n\n Please provide a human-readable failure summary that explains why you think the test might have failed and ways to fix`;
        const systemPrompt = args.systemPrompt || ""
        const response = await claudeAI(systemPrompt, prompt, args);

        if (response) {
            test.ai = response;
            messageCount++;
            if (args.log && !logged) {
                console.log(`\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────`);
                console.log(`✨ AI Test Reporter Summary`);
                console.log(`─────────────────────────────────────────────────────────────────────────────────────────────────────────────\n`);
                logged = true;
            }
            console.log(`❌ Failed Test: ${test.name}\n`);
            console.log(`${response}\n`);
        }
    }

    saveUpdatedReport(file, report);
}
