import { AzureOpenAI } from "openai";
import { CtrfReport } from "../../types/ctrf";
import { Arguments } from "../index";
import { saveUpdatedReport, stripAnsi } from "../common";

export async function azureOpenAISummary(report: CtrfReport, file: string, args: Arguments) {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = args.deploymentId || process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

    if (!apiKey || !endpoint || !deployment) {
        console.error('Missing Azure OpenAI configuration. Please set AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT_NAME environment variables or provide them as arguments.');
        return;
    }

    const client = new AzureOpenAI({ endpoint, apiKey, deployment });

    const failedTests = report.results.tests.filter(test => test.status === 'failed');

    for (const test of failedTests) {

        const systemPrompt = args.systemPrompt || "";

        const prompt = `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool: ${report.results.tool.name}.\n\nPlease provide a human-readable failure summary that explains why you think the test might have failed and ways to fix it.`;

        try {
            const response = await client.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    {
                        role: "user",
                        content: stripAnsi(prompt),
                    },
                ],
                max_tokens: args.maxTokens || null,
                frequency_penalty: args.frequencyPenalty,
                presence_penalty: args.presencePenalty,
                ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
                ...(args.topP !== undefined ? { top_p: args.topP } : {}),
            });

            const aiResponse = response.choices[0]?.message?.content;

            if (aiResponse) {
                test.ai = aiResponse;
                if (args.log) {
                    console.log(`\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────`);
                    console.log(`✨ AI Test Reporter Summary`);
                    console.log(`─────────────────────────────────────────────────────────────────────────────────────────────────────────────\n`);
                    console.log(`❌ Failed Test: ${test.name}\n`)
                    console.log(`${aiResponse}\n`);                }
            }
        } catch (error) {
            console.error(`Error generating summary for test ${test.name}:`, error);
            test.ai = 'Failed to generate summary due to an error.';
        }
    }

    saveUpdatedReport(file, report);
}
