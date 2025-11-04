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
import {
  filterTestsByAssessment,
  getAssessmentConfig,
  type AssessmentType,
} from './assess'

export interface JsonSummaryResponse {
  summary: string
  code_issues: string
  timeout_issues: string
  application_issues: string
  recommendations: string
}

export async function generateJsonSummary(
  report: Report,
  model: string,
  args: Arguments,
  customUrl?: string
): Promise<JsonSummaryResponse | null> {
  const assessmentType: AssessmentType = args.assess ?? 'failed'
  const assessmentConfig = getAssessmentConfig(assessmentType)
  const testsToAnalyze = filterTestsByAssessment(
    report.results.tests,
    assessmentType
  )

  const testDetails: string[] = []
  let testCount = 0

  for (const test of testsToAnalyze) {
    if (args.maxMessages != null && testCount >= args.maxMessages) {
      break
    }

    let detail = `Test Name: ${test.name}\n`
    detail += `Status: ${test.status}\n`

    if (test.flaky === true) {
      detail += `Flaky: Yes\n`
      if (test.retries != null) {
        detail += `Retries: ${test.retries}\n`
      }
    }

    if (test.message != null && test.message.trim() !== '') {
      detail += `Message: ${test.message}\n`
    }

    if (test.trace != null && test.trace.trim() !== '') {
      detail += `Trace: ${test.trace}\n`
    }

    // Include insights data if available
    if (test.insights != null) {
      detail += `Insights:\n${JSON.stringify(test.insights, null, 2)}\n`
    }

    if (test.ai != null && test.ai.trim() !== '') {
      detail += `AI Summary: ${test.ai}\n`
    }

    testDetails.push(detail)
    testCount++
  }

  let systemPrompt = `You are a test analysis expert. Your task is to analyze tests and provide structured output in JSON format.

Assessment Context: ${assessmentConfig.description}
${assessmentConfig.systemPromptSuffix}

Avoid:
 - Including any code in your response.
 - Adding generic conclusions or advice such as "By following these steps..."

You must respond ONLY with valid JSON in the following structure:
{
  "summary": "High-level overview of the assessment",
  "code_issues": "Concise description of code-related issues that occurred",
  "timeout_issues": "Concise description of timeout and performance issues",
  "application_issues": "Concise description of application-level issues",
  "recommendations": "Concise recommendations for addressing the findings"
}

Guidelines:
- "summary": Provide a concise overview of the assessment findings
- "code_issues": Describe specific code-related problems (bugs, logic errors, assertion failures, etc.). If there are no code-related issues, use an empty string.
- "timeout_issues": Describe any timeout, performance, or timing-related issues. If there are no timeout-related issues, use an empty string.
- "application_issues": Describe application-level problems (configuration, environment, dependencies, flakiness, etc.). If there are no application-related issues, use an empty string.
- "recommendations": Provide actionable recommendations to address the findings. If there are no recommendations, use an empty string.

- Use bullet points for each issue or recommendation.
- Assess whether multiple points refer to the same method, function, or logical issue.
- If two or more points are related to the same method, function, or root cause, merge them into a single, cohesive bullet point that combines the relevant details.
- Avoid repetition or near-duplicate points — summarize them together under one clear, concise item.
- Ensure each bullet point represents a distinct, meaningful issue or recommendation.
- When referencing a method or function name, format it in **bold Markdown**
- Bullet points should be short and to the point.

Important:
- Each field should be a string
- If no issues exist for a category, use an empty string ""
- Keep descriptions clear and actionable
- Do not include code snippets
- Respond ONLY with the JSON object, no additional text`

  if (
    args.additionalSystemPromptContext != null &&
    args.additionalSystemPromptContext !== ''
  ) {
    systemPrompt += `\n\nAdditional Context:\n${args.additionalSystemPromptContext}`
  }

  let analysisPrompt = `Analyze the following tests and provide a structured JSON response.

Assessment Type: ${assessmentConfig.label}
Test Environment: ${report.results.environment != null ? JSON.stringify(report.results.environment) : 'Not specified'}
Test Tool: ${report.results.tool.name}
Total Tests in Suite: ${report.results.tests.length}
Tests Being Assessed: ${testsToAnalyze.length}
${testCount < testsToAnalyze.length ? `\nNote: Showing ${testCount} of ${testsToAnalyze.length} tests to stay within token limits.\n` : ''}
Test Details:
${testDetails.join('\n')}

Provide your analysis in the specified JSON format.`

  if (
    args.additionalPromptContext != null &&
    args.additionalPromptContext !== ''
  ) {
    analysisPrompt += `\n\nAdditional Context:\n${args.additionalPromptContext}`
  }

  let jsonResponse = ''

  if (model === 'openai') {
    jsonResponse = (await openAI(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'claude') {
    jsonResponse = (await claudeAI(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'azure') {
    jsonResponse = (await azureOpenAI(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'grok') {
    jsonResponse = (await grokAI(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'deepseek') {
    jsonResponse = (await deepseekAI(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'gemini') {
    jsonResponse = (await gemini(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'perplexity') {
    jsonResponse = (await perplexity(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'openrouter') {
    jsonResponse = (await openRouter(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'bedrock') {
    jsonResponse = (await bedrock(systemPrompt, analysisPrompt, args)) ?? ''
  } else if (model === 'custom') {
    jsonResponse =
      (await customService(systemPrompt, analysisPrompt, args, customUrl)) ?? ''
  }

  if (jsonResponse === '') {
    console.error('Failed to generate JSON summary: empty response from model')
    return null
  }

  try {
    let cleanedResponse = jsonResponse.trim()

    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse
        .replace(/^```json\n?/, '')
        .replace(/\n?```$/, '')
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse
        .replace(/^```\n?/, '')
        .replace(/\n?```$/, '')
    }

    const parsedResponse: JsonSummaryResponse = JSON.parse(cleanedResponse)

    if (
      typeof parsedResponse.summary !== 'string' ||
      typeof parsedResponse.code_issues !== 'string' ||
      typeof parsedResponse.timeout_issues !== 'string' ||
      typeof parsedResponse.application_issues !== 'string' ||
      typeof parsedResponse.recommendations !== 'string'
    ) {
      throw new Error('Invalid JSON structure returned from model')
    }

    if (args.log === true) {
      console.log(
        `\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────\n`
      )
      console.log(`📊 Structured Analysis Summary:\n`)
      console.log(`📝 Summary:\n${parsedResponse.summary}\n`)

      if (parsedResponse.code_issues.trim() !== '') {
        console.log(`🐛 Code Issues:\n${parsedResponse.code_issues}\n`)
      }

      if (parsedResponse.timeout_issues.trim() !== '') {
        console.log(`⏱️  Timeout Issues:\n${parsedResponse.timeout_issues}\n`)
      }

      if (parsedResponse.application_issues.trim() !== '') {
        console.log(
          `⚙️  Application Issues:\n${parsedResponse.application_issues}\n`
        )
      }

      if (parsedResponse.recommendations.trim() !== '') {
        console.log(`💡 Recommendations:\n${parsedResponse.recommendations}\n`)
      }
    }

    return parsedResponse
  } catch (error) {
    console.error('Failed to parse JSON response from model:', error)
    console.error('Raw response:', jsonResponse)
    return null
  }
}
