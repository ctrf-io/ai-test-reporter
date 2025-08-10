import type { CtrfReport } from '../../types/ctrf'
import type { Arguments } from '../index'
import { stripAnsi } from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'

export async function bedrock(
  systemPrompt: string,
  prompt: string,
  args: Arguments
): Promise<string | null> {
  const region = process.env.AWS_REGION ?? 'us-west-2'
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const sessionToken = process.env.AWS_SESSION_TOKEN

  if (accessKeyId == null || secretAccessKey == null) {
    console.error(
      'AWS credentials not found. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.'
    )
    return null
  }

  try {
    // Import AWS SDK dynamically
    const { BedrockRuntimeClient, InvokeModelCommand } = await import(
      '@aws-sdk/client-bedrock-runtime'
    )

    const client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken != null && { sessionToken }),
      },
    })

    const modelId = args.model ?? 'anthropic.claude-3-5-sonnet-20240620-v1:0'

    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: args.maxTokens ?? 4000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: stripAnsi(prompt),
        },
      ],
      ...(args.temperature != null && { temperature: args.temperature }),
      ...(args.topP != null && { top_p: args.topP }),
    })

    const command = new InvokeModelCommand({
      modelId,
      body,
      contentType: 'application/json',
      accept: 'application/json',
    })

    const response = await client.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))

    if (responseBody.content?.[0]?.text != null) {
      return responseBody.content[0].text
    }

    return null
  } catch (error) {
    console.error('Error invoking Bedrock:', error)
    return null
  }
}

export async function bedrockFailedTestSummary(
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

    const prompt = `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool:${
      report.results.tool.name
    }.\n\n Please provide a human-readable failure summary that explains why you think the test might have failed and ways to fix`
    const systemPrompt =
      args.systemPrompt ?? FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT
    const response = await bedrock(systemPrompt, prompt, args)

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
    await generateConsolidatedSummary(report, 'bedrock', args)
  }
  return report
}
