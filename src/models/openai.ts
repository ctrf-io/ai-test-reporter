import OpenAI from "openai";
import { CtrfReport } from "../../types/ctrf";
import { Arguments } from "../index";
import { saveUpdatedReport } from "../common";

export async function openAISummary(report: CtrfReport, file: string, args: Arguments) {
    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    const failedTests = report.results.tests.filter(test => test.status === 'failed');

    for (const test of failedTests) {

        const systemPrompt = args.systemPrompt || "";

        const prompt = `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool:${report.results.tool.name}.\n\n Please provide a human-readable failure summary that identifies the cause and suggests ways to fix`;

        try {
            const response = await client.chat.completions.create({
                model: args.model || "gpt-3.5-turbo",
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                max_tokens: args.maxTokens || null,
                frequency_penalty: args.frequencyPenalty,
                presence_penalty: args.presencePenalty,
                ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
                ...(args.topP !== undefined ? { top_p: args.topP } : {}),
            });

            const aiResponse = response.choices[0].message?.content;

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