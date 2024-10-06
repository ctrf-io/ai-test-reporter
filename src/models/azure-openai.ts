import { AzureOpenAI } from "openai";
import { CtrfReport } from "../../types/ctrf";
import { Arguments } from "../index";
import { saveUpdatedReport, stripAnsi } from "../common";

export async function azureOpenAI(systemPrompt: string, prompt: string, args: Arguments): Promise<string | null> {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const deployment = args.deploymentId || process.env.AZURE_OPENAI_DEPLOYMENT_NAME;

    if (!apiKey || !endpoint || !deployment) {
        console.error('Missing Azure OpenAI configuration. Please set AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT_NAME environment variables or provide them as arguments.');
        return null;
    }

    const client = new AzureOpenAI({ endpoint, apiKey, deployment });

    try {
        const response = await client.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: stripAnsi(prompt) },
            ],
            max_tokens: args.maxTokens || null,
            frequency_penalty: args.frequencyPenalty,
            presence_penalty: args.presencePenalty,
            ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
            ...(args.topP !== undefined ? { top_p: args.topP } : {}),
        });

        return response.choices[0]?.message?.content || null;
    } catch (error) {
        console.error(`Error invoking Azure OpenAI`, error);
        return null;
    }
}

export async function azureFailedTestSummary(report: CtrfReport, file: string, args: Arguments) {
    const failedTests = report.results.tests.filter(test => test.status === 'failed');

    let logged = false;
    for (const test of failedTests) {
        const prompt = `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool: ${report.results.tool.name}.\n\nPlease provide a human-readable failure summary that explains why you think the test might have failed and ways to fix it.`;
        const systemPrompt = args.systemPrompt || ""
        const response = await azureOpenAI(systemPrompt, prompt, args);

        if (response) {
            test.ai = response;
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
