// Mock the Anthropic module before any imports
const mockMessagesCreate = jest.fn()
const mockAnthropicClient = {
  messages: {
    create: mockMessagesCreate,
  },
}

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    Anthropic: jest.fn(() => mockAnthropicClient),
  }
})

// Now import after the mock
import { claudeFailedTestSummary, claudeAI } from './claude'
import { CtrfReport, CtrfTest } from '../../types/ctrf'
import { Arguments } from '../index'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { saveUpdatedReport, stripAnsi } from '../common'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'

// Mock other dependencies
jest.mock('../common', () => {
  const stripAnsi = jest.fn((str) => {
    // Simple implementation to remove ANSI codes for testing
    return str.replace(/\x1b\[[0-9;]*m/g, '')
  });

  return {
    saveUpdatedReport: jest.fn(),
    stripAnsi,
  }
})

jest.mock('../consolidated-summary', () => ({
  generateConsolidatedSummary: jest.fn(),
}))

describe('claudeFailedTestSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createMockTest = (overrides: Partial<CtrfTest>): CtrfTest => ({
    name: 'Test Name',
    status: 'failed',
    duration: 100,
    ...overrides,
  })

  it('should process failed tests and add AI summaries', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'AI analysis of failed test',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 3,
          passed: 1,
          failed: 2,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 100,
        },
        tests: [
          createMockTest({
            name: 'Test 1',
            status: 'failed',
            message: 'Error occurred',
            extra: { some: 'data' },
          }),
          createMockTest({
            name: 'Test 2',
            status: 'passed', // Should be skipped
            message: 'Passed',
          }),
          createMockTest({
            name: 'Test 3',
            status: 'failed',
            message: 'Another error',
            extra: { other: 'data' },
          }),
        ],
      },
    }

    const args: Arguments = { _: [] }

    const result = await claudeFailedTestSummary(mockReport, args)

    // Check that only failed tests were processed
    expect(result.results.tests[0].ai).toBe('AI analysis of failed test')
    expect(result.results.tests[1].ai).toBeUndefined() // Passed test should not have AI summary
    expect(result.results.tests[2].ai).toBe('AI analysis of failed test')

    // Verify Anthropic API was called for each failed test (2 calls)
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2)
  })

  it('should respect maxMessages limit', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'AI analysis',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 3,
          passed: 0,
          failed: 3,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 100,
        },
        tests: [
          createMockTest({
            name: 'Test 1',
            status: 'failed',
            message: 'Error 1',
          }),
          createMockTest({
            name: 'Test 2',
            status: 'failed',
            message: 'Error 2',
          }),
          createMockTest({
            name: 'Test 3',
            status: 'failed',
            message: 'Error 3',
          }),
        ],
      },
    }

    const args: Arguments = {
      _: [],
      maxMessages: 2, // Should only process first 2 failed tests
    }

    await claudeFailedTestSummary(mockReport, args)

    // Verify Anthropic API was called only twice (for first 2 failed tests)
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2)
  })

  it('should process additional prompt context when provided', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'AI analysis with context',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 100,
        },
        tests: [
          createMockTest({
            name: 'Test 1',
            status: 'failed',
            message: 'Error occurred',
          }),
        ],
      },
    }

    const args: Arguments = {
      _: [],
      additionalPromptContext: 'Additional context for the AI',
    }

    await claudeFailedTestSummary(mockReport, args)

    // Verify that Anthropic was called with the additional context in the prompt
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining(
              'Additional Context:\nAdditional context for the AI'
            ),
          }),
        ]),
      })
    )
  })

  it('should process additional system prompt context when provided', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'AI analysis with system context',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 100,
        },
        tests: [
          createMockTest({
            name: 'Test 1',
            status: 'failed',
            message: 'Error occurred',
          }),
        ],
      },
    }

    const args: Arguments = {
      _: [],
      additionalSystemPromptContext: 'Additional system context',
    }

    await claudeFailedTestSummary(mockReport, args)

    // Verify that Anthropic was called with the additional system context
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining('Additional system context'),
      })
    )
  })

  it('should handle undefined response from claudeAI gracefully', async () => {
    const mockResponse = {
      content: [], // Empty content array should return null
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 100,
        },
        tests: [
          createMockTest({
            name: 'Test 1',
            status: 'failed',
            message: 'Error occurred',
          }),
        ],
      },
    }

    const args: Arguments = { _: [] }

    const result = await claudeFailedTestSummary(mockReport, args)

    // Verify the test doesn't get an AI property when Claude returns empty content
    expect(result.results.tests[0].ai).toBeUndefined()
  })

  it('should call generateConsolidatedSummary when consolidate is true', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'AI analysis',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 100,
        },
        tests: [
          createMockTest({
            name: 'Test 1',
            status: 'failed',
            message: 'Error occurred',
          }),
        ],
      },
    }

    const args: Arguments = {
      _: [],
      consolidate: true,
    }

    await claudeFailedTestSummary(mockReport, args, undefined)

    expect(generateConsolidatedSummary).toHaveBeenCalledWith(
      mockReport,
      'claude',
      args
    )
  })

  it('should not call generateConsolidatedSummary when consolidate is false', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'AI analysis',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 100,
        },
        tests: [
          createMockTest({
            name: 'Test 1',
            status: 'failed',
            message: 'Error occurred',
          }),
        ],
      },
    }

    const args: Arguments = {
      _: [],
      consolidate: false,
    }

    await claudeFailedTestSummary(mockReport, args, undefined)

    expect(generateConsolidatedSummary).not.toHaveBeenCalled()
  })

  it('should call saveUpdatedReport when file is provided', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'AI analysis',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 100,
        },
        tests: [
          createMockTest({
            name: 'Test 1',
            status: 'failed',
            message: 'Error occurred',
          }),
        ],
      },
    }

    const args: Arguments = { _: [] }
    const filePath = 'test-report.json'

    await claudeFailedTestSummary(mockReport, args, filePath)

    expect(saveUpdatedReport).toHaveBeenCalledWith(filePath, mockReport)
  })

  it('should not call saveUpdatedReport when file is not provided', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'AI analysis',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 100,
        },
        tests: [
          createMockTest({
            name: 'Test 1',
            status: 'failed',
            message: 'Error occurred',
          }),
        ],
      },
    }

    const args: Arguments = { _: [] }

    await claudeFailedTestSummary(mockReport, args)

    expect(saveUpdatedReport).not.toHaveBeenCalled()
  })

  it('should remove extra property from failed tests', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'AI analysis',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 100,
        },
        tests: [
          createMockTest({
            name: 'Test 1',
            status: 'failed',
            message: 'Error occurred',
            extra: { some: 'data' },
          }),
        ],
      },
    }

    const args: Arguments = { _: [] }

    const result = await claudeFailedTestSummary(mockReport, args)

    expect(result.results.tests[0].extra).toBeUndefined()
  })

  it('should use default system prompt when none is provided', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'AI analysis',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 100,
        },
        tests: [
          createMockTest({
            name: 'Test 1',
            status: 'failed',
            message: 'Error occurred',
          }),
        ],
      },
    }

    const args: Arguments = { _: [] }

    await claudeFailedTestSummary(mockReport, args)

    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT,
      })
    )
  })

  it('should use custom system prompt when provided', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'AI analysis',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'jest',
        },
        summary: {
          tests: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 100,
        },
        tests: [
          createMockTest({
            name: 'Test 1',
            status: 'failed',
            message: 'Error occurred',
          }),
        ],
      },
    }

    const args: Arguments = {
      _: [],
      systemPrompt: 'Custom system prompt',
    }

    await claudeFailedTestSummary(mockReport, args)

    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'Custom system prompt',
      })
    )
  })
})

// Test the claudeAI function separately
describe('claudeAI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call Claude API with correct parameters', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Test response',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const systemPrompt = 'You are a helpful assistant'
    const prompt = 'Tell me a joke'
    const args: Arguments = {
      _: [],
      model: 'claude-3-5-sonnet-20240620',
      maxTokens: 100,
      temperature: 0.7,
    }

    const result = await claudeAI(systemPrompt, prompt, args)

    expect(mockMessagesCreate).toHaveBeenCalledWith({
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      model: 'claude-3-5-sonnet-20240620',
      temperature: 0.7,
    })
    expect(result).toBe('Test response')
  })

  it('should handle responses with non-text blocks gracefully', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Test response',
        },
        {
          type: 'image', // Non-text block should be filtered out
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: '...',
          },
        },
        {
          type: 'text',
          text: 'More response',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const systemPrompt = 'You are a helpful assistant'
    const prompt = 'Tell me a joke'
    const args: Arguments = { _: [] }

    const result = await claudeAI(systemPrompt, prompt, args)

    expect(result).toBe('Test response More response')
  })

  it('should handle responses with no text blocks gracefully', async () => {
    const mockResponse = {
      content: [
        {
          type: 'image', // Only non-text blocks
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: '...',
          },
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const systemPrompt = 'You are a helpful assistant'
    const prompt = 'Tell me a joke'
    const args: Arguments = { _: [] }

    const result = await claudeAI(systemPrompt, prompt, args)

    expect(result).toBeNull()
  })

  it('should handle responses with empty text blocks gracefully', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: '', // Empty text block
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const systemPrompt = 'You are a helpful assistant'
    const prompt = 'Tell me a joke'
    const args: Arguments = { _: [] }

    const result = await claudeAI(systemPrompt, prompt, args)

    expect(result).toBeNull()
  })

  it('should apply default values when args are not provided', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Test response',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const systemPrompt = 'You are a helpful assistant'
    const prompt = 'Tell me a joke'
    const args: Arguments = { _: [] } // No specific values provided

    await claudeAI(systemPrompt, prompt, args)

    expect(mockMessagesCreate).toHaveBeenCalledWith({
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300, // Default value
      model: 'claude-3-5-sonnet-20240620', // Default value
      temperature: 1, // Default value
    })
  })

  it('should handle API errors gracefully', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('API Error'))

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    const systemPrompt = 'You are a helpful assistant'
    const prompt = 'Tell me a joke'
    const args: Arguments = { _: [] }

    const result = await claudeAI(systemPrompt, prompt, args)

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith('Error invoking Claude AI', expect.any(Error))

    consoleSpy.mockRestore()
  })

  it('should call stripAnsi on the prompt', async () => {
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Test response',
        },
      ],
    }

    mockMessagesCreate.mockResolvedValue(mockResponse)

    const systemPrompt = 'You are a helpful assistant'
    const prompt = '\x1b[31mRed text\x1b[0m Tell me a joke' // ANSI colored text
    const args: Arguments = { _: [] }

    await claudeAI(systemPrompt, prompt, args)

    expect(stripAnsi).toHaveBeenCalledWith(prompt)
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: expect.not.stringContaining('\x1b[31m') }],
      })
    )
  })
})