import { type CtrfReport } from '../types/ctrf'
import { type Arguments } from './index'
import { generateJsonSummary, JsonSummaryResponse } from './json-summary'

// Mock all the AI model functions
jest.mock('./models/openai', () => ({
  openAI: jest.fn(),
}))

jest.mock('./models/claude', () => ({
  claudeAI: jest.fn(),
}))

jest.mock('./models/azure-openai', () => ({
  azureOpenAI: jest.fn(),
}))

jest.mock('./models/grok', () => ({
  grokAI: jest.fn(),
}))

jest.mock('./models/deepseek', () => ({
  deepseekAI: jest.fn(),
}))

jest.mock('./models/gemini', () => ({
  gemini: jest.fn(),
}))

jest.mock('./models/perplexity', () => ({
  perplexity: jest.fn(),
}))

jest.mock('./models/openrouter', () => ({
  openRouter: jest.fn(),
}))

jest.mock('./models/bedrock', () => ({
  bedrock: jest.fn(),
}))

jest.mock('./models/custom', () => ({
  customService: jest.fn(),
}))

// Import the mocked functions
import { openAI } from './models/openai'
import { claudeAI } from './models/claude'
import { azureOpenAI } from './models/azure-openai'
import { grokAI } from './models/grok'
import { deepseekAI } from './models/deepseek'
import { gemini } from './models/gemini'
import { perplexity } from './models/perplexity'
import { openRouter } from './models/openrouter'
import { bedrock } from './models/bedrock'
import { customService } from './models/custom'

describe('generateJsonSummary', () => {
  let mockReport: CtrfReport
  let mockArgs: Arguments

  beforeEach(() => {
    mockReport = {
      results: {
        tool: { name: 'Jest' },
        summary: { tests: 5, passed: 3, failed: 2, skipped: 0, pending: 0, other: 0, start: 0, stop: 0 },
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
            message: 'Error occurred',
            trace: 'Stack trace here',
          },
          {
            name: 'Test 2',
            status: 'passed',
            duration: 200,
          },
          {
            name: 'Test 3',
            status: 'failed',
            duration: 150,
            message: 'Another error',
          },
        ],
      },
    }

    mockArgs = {
      _: [],
      log: false,
      maxMessages: 10,
    }

    // Clear all mocks before each test
    ;(openAI as jest.MockedFunction<typeof openAI>).mockClear()
    ;(claudeAI as jest.MockedFunction<typeof claudeAI>).mockClear()
    ;(azureOpenAI as jest.MockedFunction<typeof azureOpenAI>).mockClear()
    ;(grokAI as jest.MockedFunction<typeof grokAI>).mockClear()
    ;(deepseekAI as jest.MockedFunction<typeof deepseekAI>).mockClear()
    ;(gemini as jest.MockedFunction<typeof gemini>).mockClear()
    ;(perplexity as jest.MockedFunction<typeof perplexity>).mockClear()
    ;(openRouter as jest.MockedFunction<typeof openRouter>).mockClear()
    ;(bedrock as jest.MockedFunction<typeof bedrock>).mockClear()
    ;(customService as jest.MockedFunction<typeof customService>).mockClear()
  })

  it('should return null when no model response is received', async () => {
    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValueOnce(null)

    const result = await generateJsonSummary(mockReport, 'openai', mockArgs)

    expect(result).toBeNull()
  })

  it('should return null when empty string response is received', async () => {
    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValueOnce('')

    const result = await generateJsonSummary(mockReport, 'openai', mockArgs)

    expect(result).toBeNull()
  })

  it('should return parsed JSON response when valid JSON is returned by model', async () => {
    const mockResponse: JsonSummaryResponse = {
      summary: 'Test summary',
      code_issues: 'Code issues description',
      timeout_issues: 'Timeout issues description',
      application_issues: 'Application issues description',
      recommendations: 'Recommendations',
    }

    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValueOnce(
      JSON.stringify(mockResponse)
    )

    const result = await generateJsonSummary(mockReport, 'openai', mockArgs)

    expect(result).toEqual(mockResponse)
  })

  it('should handle JSON responses wrapped in markdown code blocks', async () => {
    const mockResponse: JsonSummaryResponse = {
      summary: 'Test summary',
      code_issues: 'Code issues description',
      timeout_issues: 'Timeout issues description',
      application_issues: 'Application issues description',
      recommendations: 'Recommendations',
    }

    const responseWithMarkdown = `\`\`\`json
${JSON.stringify(mockResponse)}
\`\`\``

    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValueOnce(
      responseWithMarkdown
    )

    const result = await generateJsonSummary(mockReport, 'openai', mockArgs)

    expect(result).toEqual(mockResponse)
  })

  it('should handle JSON responses wrapped in generic code blocks', async () => {
    const mockResponse: JsonSummaryResponse = {
      summary: 'Test summary',
      code_issues: 'Code issues description',
      timeout_issues: 'Timeout issues description',
      application_issues: 'Application issues description',
      recommendations: 'Recommendations',
    }

    const responseWithMarkdown = `\`\`\`
${JSON.stringify(mockResponse)}
\`\`\``

    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValueOnce(
      responseWithMarkdown
    )

    const result = await generateJsonSummary(mockReport, 'openai', mockArgs)

    expect(result).toEqual(mockResponse)
  })

  it('should return null when JSON parsing fails', async () => {
    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValueOnce(
      'invalid json'
    )

    const result = await generateJsonSummary(mockReport, 'openai', mockArgs)

    expect(result).toBeNull()
  })

  it('should return null when JSON structure is invalid', async () => {
    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValueOnce(
      JSON.stringify({
        summary: 'Test summary',
        code_issues: 'Code issues description',
        // Missing other required fields
      })
    )

    const result = await generateJsonSummary(mockReport, 'openai', mockArgs)

    expect(result).toBeNull()
  })

  it('should call the correct AI model function based on the model parameter', async () => {
    const mockResponse = JSON.stringify({
      summary: 'Test summary',
      code_issues: 'Code issues description',
      timeout_issues: 'Timeout issues description',
      application_issues: 'Application issues description',
      recommendations: 'Recommendations',
    })

    // Test OpenAI
    await generateJsonSummary(mockReport, 'openai', mockArgs)
    expect(openAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      mockArgs
    )

    // Test Claude
    await generateJsonSummary(mockReport, 'claude', mockArgs)
    expect(claudeAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      mockArgs
    )

    // Test Azure
    await generateJsonSummary(mockReport, 'azure', mockArgs)
    expect(azureOpenAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      mockArgs
    )

    // Test Grok
    await generateJsonSummary(mockReport, 'grok', mockArgs)
    expect(grokAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      mockArgs
    )

    // Test DeepSeek
    await generateJsonSummary(mockReport, 'deepseek', mockArgs)
    expect(deepseekAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      mockArgs
    )

    // Test Gemini
    await generateJsonSummary(mockReport, 'gemini', mockArgs)
    expect(gemini).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      mockArgs
    )

    // Test Perplexity
    await generateJsonSummary(mockReport, 'perplexity', mockArgs)
    expect(perplexity).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      mockArgs
    )

    // Test OpenRouter
    await generateJsonSummary(mockReport, 'openrouter', mockArgs)
    expect(openRouter).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      mockArgs
    )

    // Test Bedrock
    await generateJsonSummary(mockReport, 'bedrock', mockArgs)
    expect(bedrock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      mockArgs
    )

    // Test Custom
    await generateJsonSummary(mockReport, 'custom', mockArgs, 'http://custom.url')
    expect(customService).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      mockArgs,
      'http://custom.url'
    )
  })

  it('should only process failed tests', async () => {
    const mockResponse = JSON.stringify({
      summary: 'Test summary',
      code_issues: 'Code issues description',
      timeout_issues: 'Timeout issues description',
      application_issues: 'Application issues description',
      recommendations: 'Recommendations',
    })

    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValueOnce(
      mockResponse
    )

    const result = await generateJsonSummary(mockReport, 'openai', mockArgs)

    // Check that only failed tests were included in the prompt
    expect(openAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Test 1'),
      mockArgs
    )
    expect(openAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Test 3'),
      mockArgs
    )
    expect(openAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.stringContaining('Test 2'), // This test passed
      mockArgs
    )
  })

  it('should respect maxMessages limit', async () => {
    // Create a report with more failed tests than maxMessages
    const manyFailedReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        summary: { tests: 10, passed: 0, failed: 10, skipped: 0, pending: 0, other: 0, start: 0, stop: 0 },
        tests: Array.from({ length: 10 }, (_, i) => ({
          name: `Failed Test ${i + 1}`,
          status: 'failed' as const,
          duration: 100,
          message: `Error in test ${i + 1}`,
        })),
      },
    }

    const mockResponse = JSON.stringify({
      summary: 'Test summary',
      code_issues: 'Code issues description',
      timeout_issues: 'Timeout issues description',
      application_issues: 'Application issues description',
      recommendations: 'Recommendations',
    })

    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValueOnce(
      mockResponse
    )

    const limitedArgs = { ...mockArgs, maxMessages: 3 }
    await generateJsonSummary(manyFailedReport, 'openai', limitedArgs)

    // Check that the prompt mentions the limit
    expect(openAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Showing 3 of 10 failed tests'),
      limitedArgs
    )
  })

  it('should handle missing optional fields in tests', async () => {
    const reportWithMinimalTests = {
      results: {
        tool: { name: 'Jest' },
        summary: { tests: 2, passed: 0, failed: 2, skipped: 0, pending: 0, other: 0, start: 0, stop: 0 },
        tests: [
          {
            name: 'Minimal Test 1',
            status: 'failed' as const,
            duration: 100,
            // No message, trace, or ai fields
          },
          {
            name: 'Minimal Test 2',
            status: 'failed' as const,
            duration: 200,
            message: 'Error message',
            // Has message but no trace or ai
          },
        ],
      },
    }

    const mockResponse = JSON.stringify({
      summary: 'Test summary',
      code_issues: 'Code issues description',
      timeout_issues: 'Timeout issues description',
      application_issues: 'Application issues description',
      recommendations: 'Recommendations',
    })

    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValueOnce(
      mockResponse
    )

    const result = await generateJsonSummary(
      reportWithMinimalTests,
      'openai',
      mockArgs
    )

    expect(result).not.toBeNull()
  })

  it('should include additional prompt context when provided', async () => {
    const mockResponse = JSON.stringify({
      summary: 'Test summary',
      code_issues: 'Code issues description',
      timeout_issues: 'Timeout issues description',
      application_issues: 'Application issues description',
      recommendations: 'Recommendations',
    })

    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValueOnce(
      mockResponse
    )

    const argsWithAdditionalContext = {
      ...mockArgs,
      additionalPromptContext: 'Additional context here',
      additionalSystemPromptContext: 'Additional system context here',
    }

    await generateJsonSummary(mockReport, 'openai', argsWithAdditionalContext)

    expect(openAI).toHaveBeenCalledWith(
      expect.stringContaining('Additional system context here'),
      expect.stringContaining('Additional context here'),
      argsWithAdditionalContext
    )
  })

  it('should handle reports with environment information', async () => {
    const reportWithEnvironment = {
      results: {
        tool: { name: 'Jest' },
        environment: {
          appName: 'Test App',
          appVersion: '1.0.0',
          osPlatform: 'Linux',
        },
        summary: { tests: 1, passed: 0, failed: 1, skipped: 0, pending: 0, other: 0, start: 0, stop: 0 },
        tests: [
          {
            name: 'Test with environment',
            status: 'failed' as const,
            duration: 100,
            message: 'Error occurred',
          },
        ],
      },
    }

    const mockResponse = JSON.stringify({
      summary: 'Test summary',
      code_issues: 'Code issues description',
      timeout_issues: 'Timeout issues description',
      application_issues: 'Application issues description',
      recommendations: 'Recommendations',
    })

    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValueOnce(
      mockResponse
    )

    const result = await generateJsonSummary(
      reportWithEnvironment,
      'openai',
      mockArgs
    )

    expect(result).not.toBeNull()
  })
})