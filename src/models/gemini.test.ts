import { type CtrfReport } from '../../types/ctrf'
import { type Arguments } from '../index'
import { gemini, geminiFailedTestSummary } from './gemini'

// Mock @google/generative-ai
jest.mock('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn()
  const mockGetGenerativeModel = jest.fn()
  const mockGenAIConstructor = jest.fn()

  return {
    __esModule: true,
    GoogleGenerativeAI: mockGenAIConstructor,
    // Export for tests to access
    mockGenerateContent,
    mockGetGenerativeModel,
    mockGenAIConstructor,
  }
})

// Get the mocked functions
const {
  mockGenerateContent,
  mockGetGenerativeModel,
  mockGenAIConstructor,
} = require('@google/generative-ai')

// Mock the common functions
jest.mock('../common', () => ({
  __esModule: true,
  saveUpdatedReport: jest.fn(),
  stripAnsi: jest.fn((str) => str),
}))

// Mock the consolidated summary function
jest.mock('../consolidated-summary', () => ({
  __esModule: true,
  generateConsolidatedSummary: jest.fn(),
}))

describe('gemini', () => {
  const mockApiKey = 'test-api-key'
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.GOOGLE_API_KEY = mockApiKey

    // Set up the mock for each test
    const mockModelInstance = {
      generateContent: mockGenerateContent
    }
    mockGetGenerativeModel.mockReturnValue(mockModelInstance)
    mockGenAIConstructor.mockReturnValue({
      getGenerativeModel: mockGetGenerativeModel,
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should successfully call the model and return the response', async () => {
    const mockResponse = {
      response: {
        text: () => 'Test response from Gemini',
      },
    }
    mockGenerateContent.mockResolvedValue(mockResponse)

    const args: Arguments = { _: [], model: 'gemini-pro' } as any

    const result = await gemini('system prompt', 'test prompt', args)

    expect(mockGenAIConstructor).toHaveBeenCalledWith(mockApiKey)
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-pro' })
    expect(mockGenerateContent).toHaveBeenCalledWith('system prompt\n\ntest prompt')
    expect(result).toBe('Test response from Gemini')
  })

  it('should return null if the response text is empty', async () => {
    const mockResponse = {
      response: {
        text: () => '',
      },
    }
    mockGenerateContent.mockResolvedValue(mockResponse)

    const args: Arguments = { _: [], model: 'gemini-pro' } as any

    const result = await gemini('system prompt', 'test prompt', args)

    expect(result).toBeNull()
  })

  it('should return null if an error occurs', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API Error'))

    const args: Arguments = { _: [], model: 'gemini-pro' } as any

    const result = await gemini('system prompt', 'test prompt', args)

    expect(result).toBeNull()
  })

  it('should use default model if not specified in args', async () => {
    const mockResponse = {
      response: {
        text: () => 'Test response from Gemini',
      },
    }
    mockGenerateContent.mockResolvedValue(mockResponse)

    const args: Arguments = { _: [] } as any

    await gemini('system prompt', 'test prompt', args)

    expect(mockGenAIConstructor).toHaveBeenCalledWith(mockApiKey)
    // Verify that the default model name is used
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-pro' }) // Default value from the code
  })
})

describe('geminiFailedTestSummary', () => {
  const mockApiKey = 'test-api-key'
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.GOOGLE_API_KEY = mockApiKey

    // Set up the mock for each test
    const mockModelInstance = {
      generateContent: mockGenerateContent
    }
    mockGetGenerativeModel.mockReturnValue(mockModelInstance)
    mockGenAIConstructor.mockReturnValue({
      getGenerativeModel: mockGetGenerativeModel,
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should add AI summary to failed tests', async () => {
    const mockResponse = {
      response: {
        text: () => 'This is a test failure summary',
      },
    }
    mockGenerateContent.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'test1',
            status: 'failed',
            duration: 100,
            message: 'Test failure message',
          },
          {
            name: 'test2',
            status: 'passed',
            duration: 200,
          },
        ],
      },
    } as any

    const args: Arguments = {
      _: [],
      model: 'gemini-pro',
    } as any

    const result = await geminiFailedTestSummary(mockReport, args)

    // Should only process failed tests
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    expect(result.results.tests[0].ai).toBe('This is a test failure summary')
  })

  it('should not process tests if maxMessages is reached', async () => {
    const mockResponse = {
      response: {
        text: () => 'This is a test failure summary',
      },
    }
    mockGenerateContent.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'test1',
            status: 'failed',
            duration: 100,
          },
          {
            name: 'test2',
            status: 'failed',
            duration: 200,
          },
        ],
      },
    } as any

    const args: Arguments = {
      _: [],
      model: 'gemini-pro',
      maxMessages: 1,
    } as any

    await geminiFailedTestSummary(mockReport, args)

    // Should only process one test because of maxMessages limit
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
  })

  it('should handle cases where Gemini returns null', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '',
      },
    })

    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'test1',
            status: 'failed',
            duration: 100,
          },
        ],
      },
    } as any

    const args: Arguments = {
      _: [],
      model: 'gemini-pro',
    } as any

    const result = await geminiFailedTestSummary(mockReport, args)

    // The ai property should not be added if Gemini returns empty string
    expect(result.results.tests[0].ai).toBeUndefined()
  })

  it('should add additional prompt context when provided', async () => {
    const mockResponse = {
      response: {
        text: () => 'This is a test failure summary',
      },
    }
    mockGenerateContent.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'test1',
            status: 'failed',
            duration: 100,
          },
        ],
      },
    } as any

    const args: Arguments = {
      _: [],
      model: 'gemini-pro',
      additionalPromptContext: 'Context about the test environment',
    } as any

    await geminiFailedTestSummary(mockReport, args)

    // Verify that the additional context was included in the prompt
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.stringContaining('Additional Context:\nContext about the test environment')
    )
  })

  it('should add additional system prompt context when provided', async () => {
    const mockResponse = {
      response: {
        text: () => 'This is a test failure summary',
      },
    }
    mockGenerateContent.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'test1',
            status: 'failed',
            duration: 100,
          },
        ],
      },
    } as any

    const args: Arguments = {
      _: [],
      model: 'gemini-pro',
      additionalSystemPromptContext: 'Additional system context',
    } as any

    await geminiFailedTestSummary(mockReport, args)

    // Verify that the additional system context was included in the prompt
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.stringContaining('Additional system context')
    )
  })

  it('should generate consolidated summary if consolidate option is true', async () => {
    const mockResponse = {
      response: {
        text: () => 'This is a test failure summary',
      },
    }
    mockGenerateContent.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'test1',
            status: 'failed',
            duration: 100,
          },
        ],
      },
    } as any

    const args: Arguments = {
      _: [],
      model: 'gemini-pro',
      consolidate: true,
    } as any

    await geminiFailedTestSummary(mockReport, args)

    // verify that generateConsolidatedSummary was called
    const { generateConsolidatedSummary } = require('../consolidated-summary')
    expect(generateConsolidatedSummary).toHaveBeenCalledWith(mockReport, 'gemini', args)
  })

  it('should save updated report if file is provided', async () => {
    const mockResponse = {
      response: {
        text: () => 'This is a test failure summary',
      },
    }
    mockGenerateContent.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'test1',
            status: 'failed',
            duration: 100,
          },
        ],
      },
    } as any

    const args: Arguments = {
      _: [],
      model: 'gemini-pro',
    } as any
    const file = 'test-report.json'

    await geminiFailedTestSummary(mockReport, args, file)

    // verify that saveUpdatedReport was called
    const { saveUpdatedReport } = require('../common')
    expect(saveUpdatedReport).toHaveBeenCalledWith(file, mockReport)
  })

  it('should clean up extra property from failed tests', async () => {
    const mockResponse = {
      response: {
        text: () => 'This is a test failure summary',
      },
    }
    mockGenerateContent.mockResolvedValue(mockResponse)

    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'test1',
            status: 'failed',
            duration: 100,
            extra: { some: 'data' },
          },
          {
            name: 'test2',
            status: 'passed',
            duration: 200,
            extra: { some: 'other_data' },
          },
        ],
      },
    } as any

    const args: Arguments = {
      _: [],
      model: 'gemini-pro',
    } as any

    const result = await geminiFailedTestSummary(mockReport, args)

    // Verify that the extra property was removed from failed tests
    expect(result.results.tests[0].extra).toBeUndefined()
    // Passed tests should not be affected
    expect(result.results.tests[1].extra).toBeDefined()
  })
})