import { GoogleGenerativeAI } from '@google/generative-ai'
import { type CtrfReport } from '../../types/ctrf'
import { type Arguments } from '../index'
import { saveUpdatedReport, stripAnsi } from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'

export async function gemini(
  systemPrompt: string,
  prompt: string,
  args: Arguments
): Promise<string | null> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '')
  const model = genAI.getGenerativeModel({ model: args.model ?? 'gemini-pro' })

  try {
    const combinedPrompt = `${systemPrompt}\n\n${stripAnsi(prompt)}`
    const result = await model.generateContent(combinedPrompt)
    const response = result.response
    const text = response.text()
    return text !== '' ? text : null
  } catch (error) {
    console.error(`Error invoking Gemini`, error)
    return null
  }
}

export async function geminiFailedTestSummary(
  report: CtrfReport,
  args: Arguments,
  file?: string,
  log = false
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

    let prompt = `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool:${
      report.results.tool.name
    }.\n\n Please provide a human-readable failure summary that explains why you think the test might have failed and ways to fix`
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
    const response = await gemini(systemPrompt, prompt, args)

    if (response != null) {
      test.ai = response
      messageCount++
      if (args.log === true && !logged) {
        console.log(
          '\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────'
        )
        console.log('✨ AI Test Reporter Summary')
        console.log(
          '─────────────────────────────────────────────────────────────────────────────────────────────────────────────\n'
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
    await generateConsolidatedSummary(report, 'gemini', args)
  }
  if (file !== undefined) {
    saveUpdatedReport(file, report)
  }
  return report
}
