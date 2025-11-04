import { type Report } from '../types/ctrf'
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
import { saveUpdatedReport } from './common'

/**
 * Analyzes report-level insights and adds the analysis to report.results.extra.aiInsights
 */
export async function analyzeReportInsights(
  report: Report,
  model: string,
  args: Arguments,
  customUrl?: string,
  file?: string
): Promise<void> {
  // Check if report has insights data
  if (report.insights == null) {
    if (args.log === true) {
      console.log(
        '\nℹ️  No report-level insights data found. Skipping report insights analysis.'
      )
    }
    return
  }

  const systemPrompt = `You are analyzing test suite insights. Identify significant trends, regressions, or improvements. Highlight areas of concern and provide actionable recommendations. Be concise and focus on what matters most.${args.additionalSystemPromptContext != null ? `\n\n${args.additionalSystemPromptContext}` : ''}`

  let analysisPrompt = `Test Tool: ${report.results.tool.name}
Tests: ${report.results.summary.passed} passed, ${report.results.summary.failed} failed, ${report.results.summary.skipped} skipped (${report.results.tests.length} total)

Insights:
${JSON.stringify(report.insights, null, 2)}`

  if (
    args.additionalPromptContext != null &&
    args.additionalPromptContext !== ''
  ) {
    analysisPrompt += `\n\nAdditional Context:\n${args.additionalPromptContext}`
  }

  let insightsAnalysis = ''

  if (model === 'openai') {
    insightsAnalysis = (await openAI(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'claude') {
    insightsAnalysis =
      (await claudeAI(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'azure') {
    insightsAnalysis =
      (await azureOpenAI(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'grok') {
    insightsAnalysis = (await grokAI(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'deepseek') {
    insightsAnalysis =
      (await deepseekAI(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'gemini') {
    insightsAnalysis = (await gemini(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'perplexity') {
    insightsAnalysis =
      (await perplexity(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'openrouter') {
    insightsAnalysis =
      (await openRouter(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'bedrock') {
    insightsAnalysis = (await bedrock(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'custom') {
    insightsAnalysis =
      (await customService(systemPrompt, analysisPrompt, args, customUrl)) ?? ''
  }

  if (insightsAnalysis !== '') {
    if (args.log === true) {
      console.log(
        `\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────\n`
      )
      console.log(`📊 Report Insights Analysis:\n`)
      console.log(`${insightsAnalysis}\n`)
    }

    // Store the analysis in report.results.extra.aiInsights
    report.results.extra = report.results.extra ?? {}
    report.results.extra.aiInsights = insightsAnalysis

    // Save the updated report to file
    if (file !== undefined) {
      saveUpdatedReport(file, report)
    }
  }
}
