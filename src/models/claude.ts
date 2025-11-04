import { type Report } from '../../types/ctrf'
import { type Arguments } from '../index'
import {
  saveUpdatedReport,
  stripAnsi,
  generateAssessmentPromptContext,
  getAssessmentIcon,
} from '../common'
import { Anthropic } from '@anthropic-ai/sdk'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'
import {
  filterTestsByAssessment,
  getAssessmentConfig,
  type AssessmentType,
} from '../assess'
export async function claudeAI(
  systemPrompt: string,
  prompt: string,
  args: Arguments
): Promise<string | null> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  try {
    const response = await client.messages.create({
      system: systemPrompt,
      messages: [{ role: 'user', content: stripAnsi(prompt) }],
      max_tokens: args.maxTokens ?? 300,
      model: args.model ?? 'claude-3-5-sonnet-20240620',
      temperature: args.temperature ?? 1,
    })

    const aiResponseArray = response.content
    const aiResponse = aiResponseArray
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join(' ')

    return aiResponse !== '' ? aiResponse : null
  } catch (error) {
    console.error(`Error invoking Claude AI`, error)
    return null
  }
}

export async function claudeFailedTestSummary(
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
    const response = await claudeAI(systemPrompt, prompt, args)

    if (response != null) {
      test.ai = response
      messageCount++
      if (args.log === true && !logged) {
        console.log(
          `\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────`
        )
        console.log(`✨ AI Test Reporter Summary - ${assessmentConfig.label}`)
        console.log(
          `─────────────────────────────────────────────────────────────────────────────────────────────────────────────\n`
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
    await generateConsolidatedSummary(report, 'claude', args)
  }
  if (file !== undefined) {
    saveUpdatedReport(file, report)
  }
  return report
}
