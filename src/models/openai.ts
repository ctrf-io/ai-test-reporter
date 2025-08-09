import OpenAI from 'openai'
import { type CtrfReport } from '../../types/ctrf'
import { type Arguments } from '../index'
import { stripAnsi } from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'

export async function openAI(
  systemPrompt: string,
  prompt: string,
  args: Arguments
): Promise<string | null> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
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
    console.error(`Error invoking OpenAI`, error)
    return null
  }
}

export async function openAIFailedTestSummary(
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

    // const prompt = generateFailedTestPrompt(test, report);
    const prompt = `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool:${report.results.tool.name}.\n\n Please provide a human-readable failure summary that explains why you think the test might have failed and ways to fix`
    const systemPrompt =
      args.systemPrompt ?? FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT
    const response = await openAI(systemPrompt, prompt, args)

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
    await generateConsolidatedSummary(report, 'openai', args)
  }
  return report
}
