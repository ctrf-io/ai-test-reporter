import type { Report } from '../../types/ctrf'
import type { Arguments } from '../index'
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

export async function ollama(
  systemPrompt: string,
  prompt: string,
  args: Arguments
): Promise<string | null> {
  const baseURL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

  try {
    const response = await fetch(`${baseURL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: args.model ?? 'llama2',
        prompt: `${systemPrompt}\n\n${stripAnsi(prompt)}`,
        stream: false,
      }),
    })

    const data = await response.json()
    return (data.response as string) ?? null
  } catch (error) {
    console.error('Error invoking Ollama', error)
    return null
  }
}

export async function ollamaFailedTestSummary(
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
    const response = await ollama(systemPrompt, prompt, args)

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
        console.log(`${icon} ${assessmentConfig.label}: ${test.name}
`)
        console.log(`${response}\n`)
      }
    }
  }
  if (args.consolidate === true) {
    await generateConsolidatedSummary(report, 'ollama', args)
  }
  if (file !== undefined) {
    saveUpdatedReport(file, report)
  }
  return report
}
