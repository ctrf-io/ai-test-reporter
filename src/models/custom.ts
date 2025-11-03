import OpenAI from 'openai'
import { type CtrfReport } from '../../types/ctrf'
import { type Arguments } from '../index'
import { saveUpdatedReport, stripAnsi } from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'

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
  report: CtrfReport,
  args: Arguments,
  file?: string,
  log = false,
  customUrl?: string
): Promise<CtrfReport> {
  const failedTests = report.results.tests.filter(
    (test) => test.status === 'failed'
  )
  failedTests.forEach((test) => {
    if (test.extra != null) {
      delete test.extra
    }
  })

  let logged = false
  let messageCount = 0

  for (const test of failedTests) {
    if (args.maxMessages != null && messageCount >= args.maxMessages) {
      break
    }

    const prompt = `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool:${report.results.tool.name}.\n\n Please provide a human-readable failure summary that explains why you think the test might have failed and ways to fix`
    const systemPrompt =
      args.systemPrompt ?? FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT
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
        console.log(`❌ Failed Test: ${test.name}\n`)
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
