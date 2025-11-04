import OpenAI from 'openai'
import { type Report } from '../../types/ctrf'
import { type Arguments } from '../index'
import {
  saveUpdatedReport,
  stripAnsi,
  generateAssessmentPromptContext,
  getAssessmentIcon,
} from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'
import {
  filterTestsByAssessment,
  getAssessmentConfig,
  type AssessmentType,
} from '../assess'

export async function customService(
  systemPrompt: string,
  prompt: string,
  args: Arguments,
  customUrl?: string
): Promise<string | null> {
  const baseURL = customUrl ?? args.customUrl ?? process.env.AI_CTRF_CUSTOM_URL

  if (baseURL == null) {
    console.error(
      'Error: Custom URL is required. Please provide it via --url option, customUrl parameter, or AI_CTRF_CUSTOM_URL environment variable.'
    )
    return null
  }

  const apiKey =
    process.env.AI_CTRF_CUSTOM_API_KEY ??
    process.env.OPENAI_API_KEY ??
    'not-needed'

  const client = new OpenAI({
    apiKey,
    baseURL,
  })

  try {
    const response = await client.chat.completions.create({
      model: args.model ?? 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: stripAnsi(prompt) },
      ],
      max_tokens: args.maxTokens ?? null,
      frequency_penalty: args.frequencyPenalty,
      presence_penalty: args.presencePenalty,
      ...(args.temperature !== undefined
        ? { temperature: args.temperature }
        : {}),
      ...(args.topP !== undefined ? { top_p: args.topP } : {}),
    })

    return response.choices[0].message?.content ?? null
  } catch (error) {
    console.error(`Error invoking Custom API`, error)
    return null
  }
}

export async function customFailedTestSummary(
  report: Report,
  args: Arguments,
  file?: string,
  log = false,
  customUrl?: string
): Promise<Report> {
  const assessmentType: AssessmentType = args.assess ?? 'failed'
  const assessmentConfig = getAssessmentConfig(assessmentType)
  const testsToAnalyze = filterTestsByAssessment(
    report.results.tests,
    assessmentType
  )
  testsToAnalyze.forEach((test) => {
    if (test.extra != null) {
      delete test.extra
    }
  })

  let logged = false
  let messageCount = 0

  for (const test of testsToAnalyze) {
    if (args.maxMessages != null && messageCount >= args.maxMessages) {
      break
    }

    let prompt = generateAssessmentPromptContext(test, report, assessmentType)
    if (
      args.additionalPromptContext != null &&
      args.additionalPromptContext !== ''
    ) {
      prompt += `\n\nAdditional Context:\n${args.additionalPromptContext}`
    }
    let systemPrompt =
      args.systemPrompt ?? FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT
    if (
      args.additionalSystemPromptContext != null &&
      args.additionalSystemPromptContext !== ''
    ) {
      systemPrompt += `\n\n${args.additionalSystemPromptContext}`
    }
    const response = await customService(systemPrompt, prompt, args, customUrl)

    if (response != null) {
      test.ai = response
      messageCount++
      if (args.log === true && !logged) {
        console.log(
          `\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────`
        )
        console.log(`✨ AI Test Reporter Summary`)
        console.log(
          `─────────────────────────────────────────────────────────────────────────────────────────────────────────────\n`
        )
        logged = true
      }
      if (args.log === true) {
        const icon = getAssessmentIcon(assessmentType)
        console.log(`${icon} ${assessmentConfig.label}: ${test.name}
`)
        console.log(`${response}\n`)
      }
    }
  }
  if (args.consolidate === true) {
    await generateConsolidatedSummary(report, 'custom', args, customUrl)
  }
  if (file !== undefined) {
    saveUpdatedReport(file, report)
  }
  return report
}
