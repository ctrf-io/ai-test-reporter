import { bedrock, bedrockFailedTestSummary } from './bedrock'
import type { CtrfReport, CtrfTest } from '../../types/ctrf'
import type { Arguments } from '../index'
import { saveUpdatedReport, stripAnsi } from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'

// Mock the AWS SDK
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  InvokeModelCommand: jest.fn().mockImplementation((input) => input),
}))

// Mock other dependencies
jest.mock('../common', () => {
  const originalModule = jest.requireActual('../common')
  return {
    saveUpdatedReport: jest.fn(),
    stripAnsi: jest.fn((str: string) => {
      // Simulate actual stripAnsi behavior by removing ANSI codes
      return typeof str === 'string' ? str.replace(/\x1b\[[0-9;]*m/g, '') : str
    }),
  }
})

jest.mock('../consolidated-summary', () => ({
  generateConsolidatedSummary: jest.fn(),
}))

// Mock console methods
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

describe('bedrock', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    jest.clearAllMocks()
    jest.resetModules()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('should return null when AWS credentials are not set', async () => {
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY

    const result = await bedrock('system prompt', 'user prompt', { _: [] } as Arguments)

    expect(result).toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AWS credentials not found. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.'
    )
  })

  it('should return null when either access key or secret key is missing', async () => {
    delete process.env.AWS_ACCESS_KEY_ID
    process.env.AWS_SECRET_ACCESS_KEY = 'secret'

    const result = await bedrock('system prompt', 'user prompt', { _: [] } as Arguments)

    expect(result).toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AWS credentials not found. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.'
    )
  })

  it('should call AWS Bedrock with correct parameters', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'
    process.env.AWS_REGION = 'us-east-1'

    // Import the mocked classes
    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI response' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    const args = {
      model: 'anthropic.claude-3-sonnet-20240620-v1:0',
      maxTokens: 2000,
      temperature: 0.7,
      topP: 0.9,
      _: []
    } as Arguments

    const result = await bedrock('system prompt', 'user prompt', args)

    expect(BedrockRuntimeClient).toHaveBeenCalledWith({
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'access_key',
        secretAccessKey: 'secret_key',
      },
    })

    expect(InvokeModelCommand).toHaveBeenCalledWith({
      modelId: 'anthropic.claude-3-sonnet-20240620-v1:0',
      body: expect.any(String),
      contentType: 'application/json',
      accept: 'application/json',
    })

    // Verify the body contains the expected parameters
    const bodyArg = (InvokeModelCommand as any).mock.calls[0][0].body
    const parsedBody = JSON.parse(bodyArg)
    expect(parsedBody).toEqual({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2000,
      system: 'system prompt',
      messages: [
        {
          role: 'user',
          content: 'user prompt',
        },
      ],
      temperature: 0.7,
      top_p: 0.9,
    })

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(result).toBe('AI response')
  })

  it('should use default model when no model is provided', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI response' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    await bedrock('system prompt', 'user prompt', { _: [] } as Arguments)

    const bodyArg = (InvokeModelCommand as any).mock.calls[0][0]
    expect(bodyArg.modelId).toBe('anthropic.claude-3-5-sonnet-20240620-v1:0')
  })

  it('should use default max tokens when no maxTokens is provided', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI response' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    await bedrock('system prompt', 'user prompt', { _: [] } as Arguments)

    const bodyArg = (InvokeModelCommand as any).mock.calls[0][0].body
    const parsedBody = JSON.parse(bodyArg)
    expect(parsedBody.max_tokens).toBe(4000)
  })

  it('should handle missing response content gracefully', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: []
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    const result = await bedrock('system prompt', 'user prompt', { _: [] } as Arguments)

    expect(result).toBeNull()
  })

  it('should handle malformed response body gracefully', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode('invalid json'),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    const result = await bedrock('system prompt', 'user prompt', { _: [] } as Arguments)

    expect(result).toBeNull()
  })

  it('should handle AWS SDK errors gracefully', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockRejectedValue(new Error('AWS Error'))
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    const result = await bedrock('system prompt', 'user prompt', { _: [] } as Arguments)

    expect(result).toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error invoking Bedrock:', expect.any(Error))
  })

  it('should include session token when provided', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'
    process.env.AWS_SESSION_TOKEN = 'session_token'

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI response' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    await bedrock('system prompt', 'user prompt', { _: [] } as Arguments)

    expect(BedrockRuntimeClient).toHaveBeenCalledWith({
      region: 'us-west-2', // default region
      credentials: {
        accessKeyId: 'access_key',
        secretAccessKey: 'secret_key',
        sessionToken: 'session_token',
      },
    })
  })

  it('should use default region when AWS_REGION is not set', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'
    delete process.env.AWS_REGION

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI response' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    await bedrock('system prompt', 'user prompt', { _: [] } as Arguments)

    expect(BedrockRuntimeClient).toHaveBeenCalledWith({
      region: 'us-west-2', // default region
      credentials: {
        accessKeyId: 'access_key',
        secretAccessKey: 'secret_key',
      },
    })
  })

  it('should strip ANSI codes from the prompt', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI response' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    await bedrock('system prompt', '\x1b[31mred text\x1b[0m', { _: [] } as Arguments)

    const bodyArg = (InvokeModelCommand as any).mock.calls[0][0].body
    const parsedBody = JSON.parse(bodyArg)
    // The content should be stripped of ANSI codes in the actual body
    expect(parsedBody.messages[0].content).toBe('red text') // ANSI codes should be stripped
  })
})

describe('bedrockFailedTestSummary', () => {
  let report: CtrfReport
  let args: Arguments

  beforeEach(() => {
    report = {
      results: {
        tool: {
          name: 'test-tool',
        },
        summary: {
          tests: 3,
          passed: 1,
          failed: 2,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 1000,
        },
        tests: [
          {
            name: 'Passed Test',
            status: 'passed',
            duration: 100,
          } as CtrfTest,
          {
            name: 'Failed Test 1',
            status: 'failed',
            duration: 200,
            extra: { some: 'data' },
          } as CtrfTest,
          {
            name: 'Failed Test 2',
            status: 'failed',
            duration: 300,
            extra: { more: 'info' },
          } as CtrfTest,
        ],
      },
    }

    args = {
      model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      maxTokens: 4000,
      _: []
    } as Arguments

    jest.clearAllMocks()
  })

  it('should process only failed tests and add AI summaries', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI summary for failed test' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    const result = await bedrockFailedTestSummary(report, args)

    // Check that only failed tests were processed
    expect(result.results.tests[0].status).toBe('passed')
    expect(result.results.tests[1].status).toBe('failed')
    expect(result.results.tests[1].ai).toBe('AI summary for failed test')
    expect(result.results.tests[2].status).toBe('failed')
    expect(result.results.tests[2].ai).toBe('AI summary for failed test')

    // Check that extra property was deleted from failed tests
    expect((result.results.tests[1] as any).extra).toBeUndefined()
    expect((result.results.tests[2] as any).extra).toBeUndefined()
  })

  it('should respect maxMessages limit', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI summary' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    args.maxMessages = 1
    const result = await bedrockFailedTestSummary(report, args)

    // Only the first failed test should have an AI summary
    expect(result.results.tests[1].ai).toBe('AI summary')
    expect((result.results.tests[2] as any).ai).toBeUndefined()
  })

  it('should use default system prompt when none is provided', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI summary' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    await bedrockFailedTestSummary(report, { ...args, systemPrompt: undefined })

    const bodyArg = (InvokeModelCommand as any).mock.calls[0][0].body
    const parsedBody = JSON.parse(bodyArg)
    expect(parsedBody.system).toBe(FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT)
  })

  it('should use provided system prompt when available', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI summary' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    const customSystemPrompt = 'Custom system prompt'
    await bedrockFailedTestSummary(report, { ...args, systemPrompt: customSystemPrompt })

    const bodyArg = (InvokeModelCommand as any).mock.calls[0][0].body
    const parsedBody = JSON.parse(bodyArg)
    expect(parsedBody.system).toBe(customSystemPrompt)
  })

  it('should use additional system prompt context when provided', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI summary' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    const additionalContext = 'Additional context here'
    await bedrockFailedTestSummary(report, { 
      ...args, 
      systemPrompt: 'Base system prompt',
      additionalSystemPromptContext: additionalContext 
    })

    const bodyArg = (InvokeModelCommand as any).mock.calls[0][0].body
    const parsedBody = JSON.parse(bodyArg)
    expect(parsedBody.system).toBe('Base system prompt\n\nAdditional context here')
  })

  it('should add additional prompt context when provided', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI summary' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    const additionalContext = 'Additional prompt context'
    await bedrockFailedTestSummary(report, { 
      ...args, 
      additionalPromptContext: additionalContext 
    })

    const bodyArg = (InvokeModelCommand as any).mock.calls[0][0].body
    const parsedBody = JSON.parse(bodyArg)
    expect(parsedBody.messages[0].content).toContain(`\n\nAdditional Context:\n${additionalContext}`)
  })

  it('should call generateConsolidatedSummary when consolidate is true', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI summary' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    await bedrockFailedTestSummary(report, { ...args, consolidate: true })

    expect(generateConsolidatedSummary).toHaveBeenCalledWith(report, 'bedrock', { ...args, consolidate: true })
  })

  it('should not call generateConsolidatedSummary when consolidate is false', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI summary' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    await bedrockFailedTestSummary(report, { ...args, consolidate: false })

    expect(generateConsolidatedSummary).not.toHaveBeenCalled()
  })

  it('should call saveUpdatedReport when file is provided', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI summary' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    const filePath = 'test-report.json'
    await bedrockFailedTestSummary(report, args, filePath)

    expect(saveUpdatedReport).toHaveBeenCalledWith(filePath, report)
  })

  it('should log to console when log option is enabled', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI summary for test' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    await bedrockFailedTestSummary(report, { ...args, log: true })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────'
    )
    expect(consoleLogSpy).toHaveBeenCalledWith('✨ AI Test Reporter Summary')
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '─────────────────────────────────────────────────────────────────────────────────────────────────────────────\n'
    )
  })

  it('should not log to console when log option is disabled', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'access_key'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret_key'

    const { BedrockRuntimeClient } = await import('@aws-sdk/client-bedrock-runtime')
    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        content: [{ text: 'AI summary for test' }]
      })),
    })
    ;(BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }))

    await bedrockFailedTestSummary(report, { ...args, log: false })

    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      '\n─────────────────────────────────────────────────────────────────────────────────────────────────────────────'
    )
  })
})