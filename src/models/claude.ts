import { CtrfReport } from "../../types/ctrf";
import { Arguments } from "../index";
import { saveUpdatedReport, stripAnsi } from "../common";
import { Anthropic } from "@anthropic-ai/sdk";

export async function claudeSummary(report: CtrfReport, file: string, args: Arguments) {
    const client = new Anthropic({
        apiKey: process.env['ANTHROPIC_API_KEY'],
    });

    const failedTests = report.results.tests.filter(test => test.status === 'failed');

    for (const test of failedTests) {

        const systemPrompt = args.systemPrompt || "";
        const prompt = `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool:${report.results.tool.name}.\n\n Please provide a human-readable failure summary that explains why you think the test might have failed and ways to fix`;

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

            if (aiResponse) {
                test.ai = aiResponse;
                if (args.log) {
                    console.log(`AI summary for test: ${test.name}\n`, aiResponse);
                }
            }
        } catch (error) {
            console.error(`Error generating summary for test ${test.name}:`, error);
            test.ai = 'Failed to generate summary due to an error.';
        }
    }

    saveUpdatedReport(file, report);
}
