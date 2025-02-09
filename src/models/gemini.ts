import { GoogleGenerativeAI } from "@google/generative-ai";
import { CtrfReport } from "../../types/ctrf";
import { Arguments } from "../index";
import { saveUpdatedReport, stripAnsi } from "../common";
import { generateConsolidatedSummary } from "../consolidated-summary";
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from "../constants";

export async function gemini(systemPrompt: string, prompt: string, args: Arguments): Promise<string | null> {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: args.model || "gemini-pro" });

    try {
        const combinedPrompt = `${systemPrompt}\n\n${stripAnsi(prompt)}`;
        const result = await model.generateContent(combinedPrompt);
        const response = await result.response;
        return response.text() || null;
    } catch (error) {
        console.error(`Error invoking Gemini`, error);
        return null;
    }
}

export async function geminiFailedTestSummary(report: CtrfReport, args: Arguments, file?: string, log = false): Promise<CtrfReport> {
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
        const response = await gemini(systemPrompt, prompt, args);

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
        await generateConsolidatedSummary(report, "gemini", args)
    }
    if (file) {
        saveUpdatedReport(file, report);
    }
    return report;
} 