import { type CtrfReport } from '../types/ctrf'
import { type Arguments } from './index'
import { openAI } from './models/openai'
import { claudeAI } from './models/claude'
import { azureOpenAI } from './models/azure-openai'
import { grokAI } from './models/grok'
import { deepseekAI } from './models/deepseek'
import { gemini } from './models/gemini'
import { perplexity } from './models/perplexity'
import { openRouter } from './models/openrouter'
import { bedrock } from './models/bedrock'
import { customService } from './models/custom'
// import { CONSOLIDATED_SUMMARY_SYSTEM_PROMPT } from "./constants";

export async function generateConsolidatedSummary(
  report: CtrfReport,
  model: string,
  args: Arguments,
  customUrl?: string
): Promise<void> {
  const failedTests = report.results.tests.filter(
    (test) => test.status === 'failed'
  )
  const aiSummaries: string[] = []

  for (const test of failedTests) {
    if (test.ai != null && test.ai.trim() !== '') {
      aiSummaries.push(`Test Name: ${test.name}\nAI Summary: ${test.ai}\n`)
    }
  }

  let systemPrompt = `You are tasked with summarizing the results of a test run that contains test failures. Your goal is to provide a concise, high-level overview of what went wrong in the test run. Focus on identifying patterns or root causes that might explain why these tests failed. Keep the summary brief and informative, without repeating the test details or providing step-by-step instructions. Avoid unnecessary verbosity and focus on delivering actionable insights.   
                Avoid:
                 - Including any code in your response.
                 - Adding generic conclusions or advice such as "By following these steps..."
                 - headings, bullet points, or special formatting.`
  if (
    args.additionalSystemPromptContext != null &&
    args.additionalSystemPromptContext !== ''
  ) {
    systemPrompt += `\n\n${args.additionalSystemPromptContext}`
  }
  let consolidatedPrompt = `The following tests failed in the suite:\n\n${aiSummaries.join('\n')}\n\nA total of ${failedTests.length} tests failed in this test suite. Please provide a high-level summary of what went wrong across the suite and suggest what might be the root causes or patterns.`
  if (
    args.additionalPromptContext != null &&
    args.additionalPromptContext !== ''
  ) {
    consolidatedPrompt += `\n\nAdditional Context:\n${args.additionalPromptContext}`
  }

  //     const systemPrompt = CONSOLIDATED_SUMMARY_SYSTEM_PROMPT;
  //     const consolidatedPrompt = `Analyze these ${failedTests.length} test failures from our test suite:

  // Test Environment: ${report.results.environment || 'Not specified'}
  // Test Tool: ${report.results.tool.name}
  // Total Tests Run: ${report.results.tests.length}
  // Failed Tests: ${failedTests.length}

  // Failed Test Details:
  // ${aiSummaries.join("\n")}

  // Key Questions to Address:
  // 1. What patterns or common themes exist across these failures?
  // 3. Is there evidence of a broader system change causing these failures?
  // 4. How should I prioritize the issues to address based on the failure patterns?

  // Please provide a high-level analysis of the test suite failures, focusing on systemic issues and patterns.`;

  let consolidatedSummary = ''

  if (model === 'openai') {
    consolidatedSummary =
      (await openAI(systemPrompt, consolidatedPrompt, args)) ?? ''
  } else if (model === 'claude') {
    consolidatedSummary =
      (await claudeAI(systemPrompt, consolidatedPrompt, args)) ?? ''
  } else if (model === 'azure') {
    consolidatedSummary =
      (await azureOpenAI(systemPrompt, consolidatedPrompt, args)) ?? ''
  } else if (model === 'grok') {
    consolidatedSummary =
      (await grokAI(systemPrompt, consolidatedPrompt, args)) ?? ''
  } else if (model === 'deepseek') {
    consolidatedSummary =
      (await deepseekAI(systemPrompt, consolidatedPrompt, args)) ?? ''
  } else if (model === 'gemini') {
    consolidatedSummary =
      (await gemini(systemPrompt, consolidatedPrompt, args)) ?? ''
  } else if (model === 'perplexity') {
    consolidatedSummary =
      (await perplexity(systemPrompt, consolidatedPrompt, args)) ?? ''
  } else if (model === 'openrouter') {
    consolidatedSummary =
      (await openRouter(systemPrompt, consolidatedPrompt, args)) ?? ''
  } else if (model === 'bedrock') {
    consolidatedSummary =
      (await bedrock(systemPrompt, consolidatedPrompt, args)) ?? ''
  } else if (model === 'custom') {
    consolidatedSummary =
      (await customService(
        systemPrompt,
        consolidatedPrompt,
        args,
        customUrl
      )) ?? ''
  }

  if (consolidatedSummary !== '') {
    if (args.log === true) {
      console.log(
        `\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────\n`
      )
      console.log(`📝 Overall Summary:\n`)
      console.log(`${consolidatedSummary}\n`)
    }
    report.results.extra = report.results.extra ?? {}
    report.results.extra.ai = consolidatedSummary
  }
}
