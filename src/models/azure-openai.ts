import { AzureOpenAI } from 'openai'
import { type CtrfReport } from '../../types/ctrf'
import { type Arguments } from '../index'
import { saveUpdatedReport, stripAnsi } from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'
export async function azureOpenAI(
  systemPrompt: string,
  prompt: string,
  args: Arguments
): Promise<string | null> {
  const apiKey = process.env.AZURE_OPENAI_API_KEY
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT
  const deployment =
    args.deploymentId ?? process.env.AZURE_OPENAI_DEPLOYMENT_NAME

  if (
    apiKey == null ||
    apiKey === '' ||
    endpoint == null ||
    endpoint === '' ||
    deployment == null ||
    deployment === ''
  ) {
    console.error(
      'Missing Azure OpenAI configuration. Please set AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT_NAME environment variables or provide them as arguments.'
    )
    return null
  }

  const client = new AzureOpenAI({
    apiKey,
    endpoint,
    apiVersion: '2024-05-01-preview',
  })

  try {
    const response = await client.chat.completions.create({
      model: deployment,
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
    console.error(`Error invoking Azure OpenAI`, error)
    return null
  }
}

export async function azureOpenAIFailedTestSummary(
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
    const response = await azureOpenAI(systemPrompt, prompt, args)

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
    await generateConsolidatedSummary(report, 'azure', args)
  }
  if (file !== undefined) {
    saveUpdatedReport(file, report)
  }
  return report
}
