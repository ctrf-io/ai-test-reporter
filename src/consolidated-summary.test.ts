import { type CtrfReport } from '../types/ctrf'
import { type Arguments } from './index'
import { generateConsolidatedSummary } from './consolidated-summary'

// Mock the AI model functions
jest.mock('./models/openai', () => ({
  openAI: jest.fn()
}))

jest.mock('./models/claude', () => ({
  claudeAI: jest.fn()
}))

jest.mock('./models/azure-openai', () => ({
  azureOpenAI: jest.fn()
}))

jest.mock('./models/grok', () => ({
  grokAI: jest.fn()
}))

jest.mock('./models/deepseek', () => ({
  deepseekAI: jest.fn()
}))

jest.mock('./models/gemini', () => ({
  gemini: jest.fn()
}))

jest.mock('./models/perplexity', () => ({
  perplexity: jest.fn()
}))

jest.mock('./models/openrouter', () => ({
  openRouter: jest.fn()
}))

jest.mock('./models/bedrock', () => ({
  bedrock: jest.fn()
}))

jest.mock('./models/custom', () => ({
  customService: jest.fn()
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

describe('generateConsolidatedSummary', () => {
  const mockArgs: Arguments = {
    _: [],
    model: 'openai',
    log: true,
    additionalSystemPromptContext: '',
    additionalPromptContext: ''
  }

  const getMockReport = (): CtrfReport => ({
    results: {
      tool: {
        name: 'Jest',
        version: '29.0.0'
      },
      summary: {
        tests: 5,
        passed: 3,
        failed: 2,
        pending: 0,
        skipped: 0,
        other: 0,
        start: Date.now(),
        stop: Date.now() + 1000
      },
      tests: [
        {
          name: 'Test 1',
          status: 'passed',
          duration: 100
        },
        {
          name: 'Test 2',
          status: 'failed',
          duration: 200,
          ai: 'Issue with authentication'
        },
        {
          name: 'Test 3',
          status: 'passed',
          duration: 150
        },
        {
          name: 'Test 4',
          status: 'failed',
          duration: 300,
          ai: 'Database connection error'
        },
        {
          name: 'Test 5',
          status: 'passed',
          duration: 120
        }
      ]
    }
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should call the correct AI model based on the model argument', async () => {
    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValue('OpenAI summary')

    await generateConsolidatedSummary(getMockReport(), 'openai', mockArgs)

    expect(openAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('The following tests failed in the suite'),
      mockArgs
    )
  })

  it('should call claude model when model is claude', async () => {
    ;(claudeAI as jest.MockedFunction<typeof claudeAI>).mockResolvedValue('Claude summary')

    await generateConsolidatedSummary(getMockReport(), 'claude', mockArgs)

    expect(claudeAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('The following tests failed in the suite'),
      mockArgs
    )
  })

  it('should call azure model when model is azure', async () => {
    ;(azureOpenAI as jest.MockedFunction<typeof azureOpenAI>).mockResolvedValue('Azure summary')

    await generateConsolidatedSummary(getMockReport(), 'azure', mockArgs)

    expect(azureOpenAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('The following tests failed in the suite'),
      mockArgs
    )
  })

  it('should call grok model when model is grok', async () => {
    ;(grokAI as jest.MockedFunction<typeof grokAI>).mockResolvedValue('Grok summary')

    await generateConsolidatedSummary(getMockReport(), 'grok', mockArgs)

    expect(grokAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('The following tests failed in the suite'),
      mockArgs
    )
  })

  it('should call deepseek model when model is deepseek', async () => {
    ;(deepseekAI as jest.MockedFunction<typeof deepseekAI>).mockResolvedValue('DeepSeek summary')

    await generateConsolidatedSummary(getMockReport(), 'deepseek', mockArgs)

    expect(deepseekAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('The following tests failed in the suite'),
      mockArgs
    )
  })

  it('should call gemini model when model is gemini', async () => {
    ;(gemini as jest.MockedFunction<typeof gemini>).mockResolvedValue('Gemini summary')

    await generateConsolidatedSummary(getMockReport(), 'gemini', mockArgs)

    expect(gemini).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('The following tests failed in the suite'),
      mockArgs
    )
  })

  it('should call perplexity model when model is perplexity', async () => {
    ;(perplexity as jest.MockedFunction<typeof perplexity>).mockResolvedValue('Perplexity summary')

    await generateConsolidatedSummary(getMockReport(), 'perplexity', mockArgs)

    expect(perplexity).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('The following tests failed in the suite'),
      mockArgs
    )
  })

  it('should call openrouter model when model is openrouter', async () => {
    ;(openRouter as jest.MockedFunction<typeof openRouter>).mockResolvedValue('OpenRouter summary')

    await generateConsolidatedSummary(getMockReport(), 'openrouter', mockArgs)

    expect(openRouter).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('The following tests failed in the suite'),
      mockArgs
    )
  })

  it('should call bedrock model when model is bedrock', async () => {
    ;(bedrock as jest.MockedFunction<typeof bedrock>).mockResolvedValue('Bedrock summary')

    await generateConsolidatedSummary(getMockReport(), 'bedrock', mockArgs)

    expect(bedrock).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('The following tests failed in the suite'),
      mockArgs
    )
  })

  it('should call custom service when model is custom', async () => {
    const customUrl = 'https://custom-ai-service.com'
    ;(customService as jest.MockedFunction<typeof customService>).mockResolvedValue('Custom summary')

    await generateConsolidatedSummary(getMockReport(), 'custom', mockArgs, customUrl)

    expect(customService).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('The following tests failed in the suite'),
      mockArgs,
      customUrl
    )
  })

  it('should add AI summary to report extras when summary is returned', async () => {
    const summary = 'Consolidated summary of test failures'
    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValue(summary)

    const report = getMockReport()
    await generateConsolidatedSummary(report, 'openai', mockArgs)

    expect(report.results.extra?.ai).toBe(summary)
  })

  it('should add AI summary to report extras when report initially has no extra property', async () => {
    const summary = 'Consolidated summary of test failures'
    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValue(summary)

    const mockReportCopy = getMockReport()
    const report: CtrfReport = {
      results: {
        ...mockReportCopy.results,
        extra: undefined
      }
    }

    await generateConsolidatedSummary(report, 'openai', mockArgs)

    expect(report.results.extra?.ai).toBe(summary)
  })

  it('should process only failed tests with AI summaries', async () => {
    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValue('Summary')

    await generateConsolidatedSummary(getMockReport(), 'openai', mockArgs)

    // Check that the prompt contains only failed tests with AI summaries
    expect(openAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Test Name: Test 2'),
      mockArgs
    )
    expect(openAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('Test Name: Test 4'),
      mockArgs
    )
    // Ensure it does not contain passed tests
    expect(openAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.stringContaining('Test Name: Test 1'),
      mockArgs
    )
  })

  it('should handle empty AI summaries in tests', async () => {
    const reportWithEmptyAISummaries: CtrfReport = {
      results: {
        ...getMockReport().results,
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
            ai: '' // Empty AI summary
          },
          {
            name: 'Test 2',
            status: 'failed',
            duration: 200,
            ai: 'Valid AI summary' // Valid AI summary
          },
          {
            name: 'Test 3',
            status: 'failed',
            duration: 150,
            ai: '   ' // Whitespace only AI summary
          }
        ]
      }
    }

    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValue('Summary')

    await generateConsolidatedSummary(reportWithEmptyAISummaries, 'openai', mockArgs)

    // Check that only the test with a valid AI summary is included in the prompt
    const callArgs = (openAI as jest.Mock).mock.calls[0]
    const prompt = callArgs[1]
    expect(prompt).not.toContain('Test Name: Test 1')
    expect(prompt).toContain('Test Name: Test 2')
    expect(prompt).not.toContain('Test Name: Test 3')
  })

  it('should include additional system prompt context when provided', async () => {
    const additionalContext = 'Additional system prompt context'
    const argsWithAdditionalContext: Arguments = {
      ...mockArgs,
      additionalSystemPromptContext: additionalContext
    }

    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValue('Summary')

    await generateConsolidatedSummary(getMockReport(), 'openai', argsWithAdditionalContext)

    const systemPrompt = (openAI as jest.Mock).mock.calls[0][0]
    expect(systemPrompt).toContain(additionalContext)
  })

  it('should include additional prompt context when provided', async () => {
    const additionalContext = 'Additional prompt context'
    const argsWithAdditionalContext: Arguments = {
      ...mockArgs,
      additionalPromptContext: additionalContext
    }

    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValue('Summary')

    await generateConsolidatedSummary(getMockReport(), 'openai', argsWithAdditionalContext)

    const prompt = (openAI as jest.Mock).mock.calls[0][1]
    expect(prompt).toContain(additionalContext)
  })

  it('should not add summary to report if AI returns empty string', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const freshReport = getMockReport();

    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValue('');

    await generateConsolidatedSummary(freshReport, 'openai', mockArgs)

    expect(freshReport.results.extra?.ai).toBeUndefined()
    consoleSpy.mockRestore();
  })

  it('should count the correct number of failed tests in the prompt', async () => {
    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValue('Summary')

    await generateConsolidatedSummary(getMockReport(), 'openai', mockArgs)

    const prompt = (openAI as jest.Mock).mock.calls[0][1]
    // There are 2 failed tests in the getMockReport()
    expect(prompt).toContain('A total of 2 tests failed in this test suite')
  })

  it('should not log to console when log argument is false', async () => {
    const argsWithoutLog: Arguments = { ...mockArgs, log: false }
    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValue('Summary')

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    await generateConsolidatedSummary(getMockReport(), 'openai', argsWithoutLog)

    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('should call openAI with correct parameters when model is openai', async () => {
    const summary = 'Test summary from OpenAI'
    ;(openAI as jest.MockedFunction<typeof openAI>).mockResolvedValue(summary)

    await generateConsolidatedSummary(getMockReport(), 'openai', mockArgs)

    expect(openAI).toHaveBeenCalledWith(
      expect.stringMatching(/summarizing the results of a test run/),
      expect.stringContaining('The following tests failed in the suite'),
      mockArgs
    )
  })
})