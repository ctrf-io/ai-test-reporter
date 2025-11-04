import { type Report } from '../../types/ctrf'
import { type Arguments } from '../index'
import {
  saveUpdatedReport,
  stripAnsi,
  generateAssessmentPromptContext,
  getAssessmentIcon,
} from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import OpenAI from 'openai'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'
import {
  filterTestsByAssessment,
  getAssessmentConfig,
  type AssessmentType,
} from '../assess'

export async function grokAI(
  systemPrompt: string,
  prompt: string,
  args: Arguments
): Promise<string | null> {
  const client = new OpenAI({
    apiKey: process.env.GROK_API_KEY,
    baseURL: process.env.GROK_API_BASE_URL ?? 'https://api.x.ai/v1',
  })

  try {
    const response = await client.chat.completions.create({
      model: args.model ?? 'grok-beta',
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
    console.error(`Error invoking Grok`, error)
    return null
  }
}

export async function grokFailedTestSummary(
  report: Report,
  args: Arguments,
  file?: string,
  log = false
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
    const response = await grokAI(systemPrompt, prompt, args)

    if (response != null) {
      test.ai = response
      messageCount++
      if (args.log === true && !logged) {
        console.log(
          '\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────'
        )
        console.log(`✨ AI Test Reporter Summary - ${assessmentConfig.label}`)
        console.log(
          '─────────────────────────────────────────────────────────────────────────────────────────────────────────────\n'
        )
        logged = true
      }
      if (args.log === true) {
        const icon = getAssessmentIcon(assessmentType)
        console.log(`${icon} ${assessmentConfig.label}: ${test.name}\n`)
        console.log(`${response}\n`)
      }
    }
  }
  if (args.consolidate === true) {
    await generateConsolidatedSummary(report, 'grok', args)
  }
  if (file !== undefined) {
    saveUpdatedReport(file, report)
  }

  return report
}
