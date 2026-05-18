import OpenAI from 'openai'
import { customService, customFailedTestSummary } from './custom'
import { type CtrfReport } from '../../types/ctrf'
import { type Arguments } from '../index'
import { stripAnsi, saveUpdatedReport } from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'

// Mock the OpenAI module
jest.mock('openai', () => {
  const mockCreate = jest.fn()

  return {
    __esModule: true,
    default: jest.fn(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  }
})

// Mock other dependencies
jest.mock('../common', () => ({
  stripAnsi: jest.fn((str) => str),
  saveUpdatedReport: jest.fn(),
}))

jest.mock('../consolidated-summary')

describe('custom.ts', () => {
  let mockChatCompletionsCreate: jest.Mock

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Mock console.error to make it a spy so we can assert on it
    jest.spyOn(console, 'error').mockImplementation(() => {})

    // Get the mock function directly from the module
    const OpenAIMock = require('openai').default
    OpenAIMock.mockClear()

    // Create a mock instance that will be returned by the OpenAI constructor
    const mockClient = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    }

    OpenAIMock.mockReturnValue(mockClient)
    mockChatCompletionsCreate = mockClient.chat.completions.create
  })

  afterEach(() => {
    // Restore console.error after each test
    jest.restoreAllMocks()
  })

  describe('customService', () => {
    it('should return null when no custom URL is provided', async () => {
      const args = {} as Arguments
      const result = await customService('system prompt', 'user prompt', args)
      
      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error: Custom URL is required')
      )
    })

    it('should use customUrl parameter when provided', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = {} as Arguments
      const result = await customService(
        'system prompt', 
        'user prompt', 
        args, 
        'https://custom.example.com'
      )
      
      expect(result).toBe('Test response')
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: expect.any(String),
        baseURL: 'https://custom.example.com',
      })
    })

    it('should use args.customUrl when no customUrl parameter provided', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = { customUrl: 'https://args.example.com' } as Arguments
      const result = await customService('system prompt', 'user prompt', args)
      
      expect(result).toBe('Test response')
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: expect.any(String),
        baseURL: 'https://args.example.com',
      })
    })

    it('should use environment variable AI_CTRF_CUSTOM_URL when no other URLs provided', async () => {
      process.env.AI_CTRF_CUSTOM_URL = 'https://env.example.com'
      
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = {} as Arguments
      const result = await customService('system prompt', 'user prompt', args)
      
      expect(result).toBe('Test response')
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: expect.any(String),
        baseURL: 'https://env.example.com',
      })
      
      delete process.env.AI_CTRF_CUSTOM_URL
    })

    it('should use correct API configuration with default model', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = { customUrl: 'https://test.example.com' } as Arguments
      await customService('system prompt', 'user prompt', args)
      
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'user prompt' },
        ],
        max_tokens: null,
        frequency_penalty: undefined,
        presence_penalty: undefined,
      })
    })

    it('should use provided model and other parameters', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = {
        customUrl: 'https://test.example.com',
        model: 'gpt-3.5-turbo',
        maxTokens: 100,
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
        temperature: 0.7,
        topP: 0.9,
      } as Arguments
      
      await customService('system prompt', 'user prompt', args)
      
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'user prompt' },
        ],
        max_tokens: 100,
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
        temperature: 0.7,
        top_p: 0.9,
      })
    })

    it('should return null when API call fails', async () => {
      mockChatCompletionsCreate.mockRejectedValue(new Error('API Error'))

      const args = { customUrl: 'https://test.example.com' } as Arguments
      const result = await customService('system prompt', 'user prompt', args)
      
      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        'Error invoking Custom API',
        expect.any(Error)
      )
    })

    it('should return null when response has no content', async () => {
      const mockResponse = {
        choices: [{ message: { content: null } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = { customUrl: 'https://test.example.com' } as Arguments
      const result = await customService('system prompt', 'user prompt', args)
      
      expect(result).toBeNull()
    })

    it('should call stripAnsi on the prompt', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = { customUrl: 'https://test.example.com' } as Arguments
      await customService('system prompt', 'user prompt with ansi', args)
      
      expect(stripAnsi).toHaveBeenCalledWith('user prompt with ansi')
    })

    it('should use OPENAI_API_KEY when AI_CTRF_CUSTOM_API_KEY is not set', async () => {
      process.env.OPENAI_API_KEY = 'env-openai-key'
      
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = { customUrl: 'https://test.example.com' } as Arguments
      await customService('system prompt', 'user prompt', args)
      
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'env-openai-key',
        baseURL: 'https://test.example.com',
      })
      
      delete process.env.OPENAI_API_KEY
    })

    it('should use fallback API key when neither env var is set', async () => {
      delete process.env.AI_CTRF_CUSTOM_API_KEY
      delete process.env.OPENAI_API_KEY
      
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = { customUrl: 'https://test.example.com' } as Arguments
      await customService('system prompt', 'user prompt', args)
      
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'not-needed',
        baseURL: 'https://test.example.com',
      })
    })
  })

  describe('customFailedTestSummary', () => {
    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'Test Tool',
          version: '1.0.0',
        },
        summary: {
          tests: 2,
          passed: 1,
          failed: 1,
          skipped: 0,
          pending: 0,
          other: 0,
          start: 0,
          stop: 1000,
        },
        tests: [
          {
            name: 'Passed Test',
            status: 'passed',
            duration: 100,
            start: 0,
            stop: 100,
          },
          {
            name: 'Failed Test',
            status: 'failed',
            duration: 200,
            start: 1000,
            stop: 1200,
          },
        ],
      },
    }

    beforeEach(() => {
      // Reset console.log mock
      jest.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('should process only failed tests', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'AI summary for failed test' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = { customUrl: 'https://test.example.com' } as Arguments
      const result = await customFailedTestSummary(mockReport, args)
      
      // Verify that only the failed test got AI summary
      expect(result.results.tests[0].ai).toBeUndefined() // Passed test should not have AI summary
      expect(result.results.tests[1].ai).toBe('AI summary for failed test') // Failed test should have AI summary
    })

    it('should delete extra property from failed tests', async () => {
      const reportWithExtra: CtrfReport = {
        results: {
          tool: {
            name: 'Test Tool',
            version: '1.0.0',
          },
          summary: {
            tests: 1,
            passed: 0,
            failed: 1,
            skipped: 0,
            pending: 0,
            other: 0,
            start: 0,
            stop: 1000,
          },
          tests: [
            {
              name: 'Failed Test',
              status: 'failed',
              duration: 200,
              start: 0,
              stop: 1000,
              extra: { someExtraData: 'data' },
            },
          ],
        },
      }

      const mockResponse = {
        choices: [{ message: { content: 'AI summary for failed test' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = { customUrl: 'https://test.example.com' } as Arguments
      const result = await customFailedTestSummary(reportWithExtra, args)
      
      expect(result.results.tests[0].extra).toBeUndefined()
    })

    it('should respect maxMessages limit', async () => {
      const multiFailedReport: CtrfReport = {
        results: {
          tool: {
            name: 'Test Tool',
            version: '1.0.0',
          },
          summary: {
            tests: 3,
            passed: 0,
            failed: 3,
            skipped: 0,
            pending: 0,
            other: 0,
            start: 0,
            stop: 3000,
          },
          tests: [
            {
              name: 'Failed Test 1',
              status: 'failed',
              duration: 100,
              start: 0,
              stop: 100,
            },
            {
              name: 'Failed Test 2',
              status: 'failed',
              duration: 200,
              start: 100,
              stop: 300,
            },
            {
              name: 'Failed Test 3',
              status: 'failed',
              duration: 300,
              start: 300,
              stop: 600,
            },
          ],
        },
      }

      const mockResponse = {
        choices: [{ message: { content: 'AI summary for test' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = {
        customUrl: 'https://test.example.com',
        maxMessages: 2,
      } as Arguments
      const result = await customFailedTestSummary(multiFailedReport, args)
      
      // Only the first 2 failed tests should get AI summaries
      expect(result.results.tests[0].ai).toBe('AI summary for test')
      expect(result.results.tests[1].ai).toBe('AI summary for test')
      expect(result.results.tests[2].ai).toBeUndefined()
    })

    it('should include additional prompt context if provided', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'AI summary for failed test' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = {
        customUrl: 'https://test.example.com',
        additionalPromptContext: 'Additional context here',
      } as Arguments
      await customFailedTestSummary(mockReport, args)
      
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: expect.any(String) },
          { 
            role: 'user', 
            content: expect.stringContaining('Additional Context:\nAdditional context here') 
          },
        ],
        max_tokens: null,
        frequency_penalty: undefined,
        presence_penalty: undefined,
      })
    })

    it('should use custom system prompt if provided', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'AI summary for failed test' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = {
        customUrl: 'https://test.example.com',
        systemPrompt: 'Custom system prompt',
      } as Arguments
      await customFailedTestSummary(mockReport, args)
      
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Custom system prompt' },
          { role: 'user', content: expect.any(String) },
        ],
        max_tokens: null,
        frequency_penalty: undefined,
        presence_penalty: undefined,
      })
    })

    it('should append additional system prompt context if provided', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'AI summary for failed test' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = {
        customUrl: 'https://test.example.com',
        additionalSystemPromptContext: 'Additional system context here',
      } as Arguments
      await customFailedTestSummary(mockReport, args)
      
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: expect.stringContaining('Additional system context here') 
          },
          { role: 'user', content: expect.any(String) },
        ],
        max_tokens: null,
        frequency_penalty: undefined,
        presence_penalty: undefined,
      })
    })

    it('should call generateConsolidatedSummary when consolidate is true', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'AI summary for failed test' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = {
        customUrl: 'https://test.example.com',
        consolidate: true,
      } as Arguments
      await customFailedTestSummary(mockReport, args, undefined, false, 'https://custom.example.com')
      
      expect(generateConsolidatedSummary).toHaveBeenCalledWith(
        expect.any(Object),
        'custom',
        args,
        'https://custom.example.com'
      )
    })

    it('should not call generateConsolidatedSummary when consolidate is false', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'AI summary for failed test' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = {
        customUrl: 'https://test.example.com',
        consolidate: false,
      } as Arguments
      await customFailedTestSummary(mockReport, args)
      
      expect(generateConsolidatedSummary).not.toHaveBeenCalled()
    })

    it('should save updated report when file is provided', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'AI summary for failed test' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = { customUrl: 'https://test.example.com' } as Arguments
      await customFailedTestSummary(mockReport, args, 'test-report.json')
      
      expect(saveUpdatedReport).toHaveBeenCalledWith('test-report.json', expect.any(Object))
    })

    it('should log to console when log option is true', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'AI summary for failed test' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

      const args = {
        customUrl: 'https://test.example.com',
        log: true,
      } as Arguments
      await customFailedTestSummary(mockReport, args)
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI Test Reporter Summary')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed Test: Failed Test')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI summary for failed test')
      )
      
      consoleLogSpy.mockRestore()
    })

    it('should return the modified report', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'AI summary for failed test' } }],
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      const args = { customUrl: 'https://test.example.com' } as Arguments
      const result = await customFailedTestSummary(mockReport, args)
      
      expect(result).toEqual(expect.any(Object))
      expect(result.results.tests[1].ai).toBe('AI summary for failed test')
    })
  })
})