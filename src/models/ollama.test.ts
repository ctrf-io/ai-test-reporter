import { ollama, ollamaFailedTestSummary } from './ollama'
import type { Arguments } from '../index'
import { stripAnsi } from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'
import type { CtrfReport, Summary, Tool } from '../../types/ctrf'

// Mock the external dependencies
jest.mock('../common', () => ({
  stripAnsi: jest.fn((str: string) => str),
  saveUpdatedReport: jest.fn(),
}))

jest.mock('../consolidated-summary', () => ({
  generateConsolidatedSummary: jest.fn(),
}))

// Define a proper mock for fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as jest.MockedFunction<typeof fetch>

describe('ollama', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    mockFetch.mockClear()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should make a successful API call to Ollama', async () => {
    const mockResponse = { response: 'Test response from Ollama' }

    mockFetch.mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
      ok: true,
      status: 200,
    } as Response)

    const args: Arguments = { _: [], model: 'llama2' }
    const result = await ollama('system prompt', 'test prompt', args)

    expect(result).toBe('Test response from Ollama')
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama2',
          prompt: 'system prompt\n\ntest prompt',
          stream: false,
        }),
      })
    )
  })

  it('should use default model when no model is provided', async () => {
    const mockResponse = { response: 'Test response' }
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
      ok: true,
      status: 200,
    } as Response)

    const args: Arguments = { _: [] }
    await ollama('system prompt', 'test prompt', args)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"model":"llama2"')
      })
    )
  })

  it('should use custom base URL when provided via environment variable', async () => {
    process.env.OLLAMA_BASE_URL = 'http://custom-url:11434'
    const mockResponse = { response: 'Test response' }
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
      ok: true,
      status: 200,
    } as Response)

    const args: Arguments = { _: [], model: 'llama2' }
    await ollama('system prompt', 'test prompt', args)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://custom-url:11434/api/generate',
      expect.anything()
    )
    // Clean up environment
    delete process.env.OLLAMA_BASE_URL
  })

  it('should return null when API call fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const args: Arguments = { _: [], model: 'llama2' }
    const result = await ollama('system prompt', 'test prompt', args)

    expect(result).toBeNull()
  })

  it('should return null when response is invalid', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({}),
      ok: true,
      status: 200,
    } as Response)

    const args: Arguments = { _: [], model: 'llama2' }
    const result = await ollama('system prompt', 'test prompt', args)

    expect(result).toBeNull()
  })

  it('should call stripAnsi on the prompt', async () => {
    const mockResponse = { response: 'Test response' }
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
      ok: true,
      status: 200,
    } as Response)

    const args: Arguments = { _: [], model: 'llama2' }
    await ollama('system prompt', 'test prompt', args)

    expect(stripAnsi).toHaveBeenCalledWith('test prompt')
  })
})

describe('ollamaFailedTestSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should process failed tests and add AI summaries', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'test-tool' } as Tool,
        summary: { tests: 2, passed: 1, failed: 1, skipped: 0, pending: 0, other: 0, start: 0, stop: 0 } as Summary,
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
            message: 'Test failed',
          },
          {
            name: 'Test 2',
            status: 'passed', // This should be filtered out
            duration: 200,
            message: 'Test passed',
          },
        ],
      },
    }

    const mockArgs: Arguments = { _: [], model: 'llama2' }
    const mockAiResponse = 'This test failed because of X reason'

    // Mock the ollama function to return the AI response
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ response: mockAiResponse }),
      ok: true,
      status: 200,
    } as Response)

    const result = await ollamaFailedTestSummary(mockReport, mockArgs)

    // Check that fetch was called for the failed test
    expect(mockFetch).toHaveBeenCalled()
    expect(result.results.tests[0].ai).toBe(mockAiResponse)
    expect(result.results.tests[0].name).toBe('Test 1')
    // The passed test should remain unchanged
    expect(result.results.tests[1].status).toBe('passed')
  })

  it('should handle empty failed tests array', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'test-tool' } as Tool,
        summary: { tests: 1, passed: 1, failed: 0, skipped: 0, pending: 0, other: 0, start: 0, stop: 0 } as Summary,
        tests: [
          {
            name: 'Test 1',
            status: 'passed',
            duration: 100,
            message: 'Test passed',
          },
        ],
      },
    }

    const mockArgs: Arguments = { _: [], model: 'llama2' }

    const result = await ollamaFailedTestSummary(mockReport, mockArgs)

    expect(result.results.tests).toHaveLength(1)
    expect(result.results.tests[0].status).toBe('passed')
    // The internal ollama function should not have been called for an empty failed tests list
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should use default system prompt when no custom one provided', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'test-tool' } as Tool,
        summary: { tests: 1, passed: 0, failed: 1, skipped: 0, pending: 0, other: 0, start: 0, stop: 0 } as Summary,
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
            message: 'Test failed',
          },
        ],
      },
    }

    const mockArgs: Arguments = { _: [], model: 'llama2' }
    
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ response: 'AI response' }),
      ok: true,
      status: 200,
    } as Response)

    await ollamaFailedTestSummary(mockReport, mockArgs)

    // The first call to fetch should contain the default system prompt
    const fetchCall = mockFetch.mock.calls[0][1] // Second argument is the request options
    const body = JSON.parse((fetchCall as any).body as string)
    expect(body.prompt).toContain(FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT)
  })

  it('should use custom system prompt when provided', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'test-tool' } as Tool,
        summary: { tests: 1, passed: 0, failed: 1, skipped: 0, pending: 0, other: 0, start: 0, stop: 0 } as Summary,
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
            message: 'Test failed',
          },
        ],
      },
    }

    const customSystemPrompt = 'Custom system prompt'
    const mockArgs: Arguments = {
      _: [],
      model: 'llama2',
      systemPrompt: customSystemPrompt,
    }
    
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ response: 'AI response' }),
      ok: true,
      status: 200,
    } as Response)

    await ollamaFailedTestSummary(mockReport, mockArgs)

    // The first call to fetch should contain the custom system prompt
    const fetchCall = mockFetch.mock.calls[0][1] // Second argument is the request options
    const body = JSON.parse((fetchCall as any).body as string)
    expect(body.prompt).toContain(customSystemPrompt)
  })

  it('should add additional context to system prompt when provided', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'test-tool' } as Tool,
        summary: { tests: 1, passed: 0, failed: 1, skipped: 0, pending: 0, other: 0, start: 0, stop: 0 } as Summary,
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
            message: 'Test failed',
          },
        ],
      },
    }

    const additionalContext = 'Additional system context'
    const mockArgs: Arguments = {
      _: [],
      model: 'llama2',
      additionalSystemPromptContext: additionalContext,
    }
    
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ response: 'AI response' }),
      ok: true,
      status: 200,
    } as Response)

    await ollamaFailedTestSummary(mockReport, mockArgs)

    // The first call to fetch should contain the additional context
    const fetchCall = mockFetch.mock.calls[0][1] // Second argument is the request options
    const body = JSON.parse((fetchCall as any).body as string)
    expect(body.prompt).toContain(additionalContext)
  })

  it('should respect maxMessages argument', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'test-tool' } as Tool,
        summary: { tests: 2, passed: 0, failed: 2, skipped: 0, pending: 0, other: 0, start: 0, stop: 0 } as Summary,
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
            message: 'Test failed',
          },
          {
            name: 'Test 2',
            status: 'failed',
            duration: 200,
            message: 'Test failed',
          },
        ],
      },
    }

    const mockArgs: Arguments = { _: [], model: 'llama2', maxMessages: 1 }
    
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ response: 'AI response' }),
      ok: true,
      status: 200,
    } as Response)

    await ollamaFailedTestSummary(mockReport, mockArgs)

    // Should only call the API once due to maxMessages constraint
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should call generateConsolidatedSummary when consolidate is true', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'test-tool' } as Tool,
        summary: { tests: 1, passed: 0, failed: 1, skipped: 0, pending: 0, other: 0, start: 0, stop: 0 } as Summary,
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
            message: 'Test failed',
          },
        ],
      },
    }

    const mockArgs: Arguments = { _: [], model: 'llama2', consolidate: true }
    
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ response: 'AI response' }),
      ok: true,
      status: 200,
    } as Response)

    await ollamaFailedTestSummary(mockReport, mockArgs)

    expect(generateConsolidatedSummary).toHaveBeenCalledWith(
      mockReport,
      'ollama',
      mockArgs
    )
  })

  it('should not call generateConsolidatedSummary when consolidate is false', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'test-tool' } as Tool,
        summary: { tests: 1, passed: 0, failed: 1, skipped: 0, pending: 0, other: 0, start: 0, stop: 0 } as Summary,
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
            message: 'Test failed',
          },
        ],
      },
    }

    const mockArgs: Arguments = { _: [], model: 'llama2', consolidate: false }
    
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ response: 'AI response' }),
      ok: true,
      status: 200,
    } as Response)

    await ollamaFailedTestSummary(mockReport, mockArgs)

    expect(generateConsolidatedSummary).not.toHaveBeenCalled()
  })
})