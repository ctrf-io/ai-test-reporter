import { type CtrfReport } from '../../types/ctrf'
import { type Arguments } from '../index'
import { mistralAI, mistralFailedTestSummary } from './mistral'
import OpenAI from 'openai'
import { stripAnsi } from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { saveUpdatedReport } from '../common'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'

// Global mock for the create function so all tests can access it
const mockCreate = jest.fn()

// Mock the external dependencies
jest.mock('openai', () => {
  return {
    default: jest.fn(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    __esModule: true,
  }
})

jest.mock('../common', () => ({
  stripAnsi: jest.fn((str) => str),
  saveUpdatedReport: jest.fn(),
}))

jest.mock('../consolidated-summary', () => ({
  generateConsolidatedSummary: jest.fn(),
}))

describe('mistral.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('mistralAI', () => {
    const mockArgs: Arguments = {
      _: [],
      model: 'mistral-large-latest',
      maxTokens: 100,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      temperature: 0.7,
      topP: 0.9,
    }

    it('should successfully call Mistral API and return response content', async () => {
      // Arrange
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
      }
      mockCreate.mockResolvedValue(mockResponse)
      process.env.MISTRAL_API_KEY = 'test-api-key'

      // Act
      const result = await mistralAI('system prompt', 'test prompt', mockArgs)

      // Assert
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        baseURL: 'https://api.mistral.ai/v1',
      })
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'test prompt' },
        ],
        max_tokens: 100,
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
        temperature: 0.7,
        top_p: 0.9,
      })
      expect(result).toBe('Test response')
      expect(stripAnsi).toHaveBeenCalledWith('test prompt')
    })

    it('should handle missing message content and return null', async () => {
      // Arrange
      const mockResponse = {
        choices: [{}], // No message content
      }
      mockCreate.mockResolvedValue(mockResponse)
      process.env.MISTRAL_API_KEY = 'test-api-key'

      // Act
      const result = await mistralAI('system prompt', 'test prompt', mockArgs)

      // Assert
      expect(result).toBeNull()
    })

    it('should handle API errors and return null', async () => {
      // Arrange
      mockCreate.mockRejectedValue(new Error('API Error'))
      
      // Spy on console.error to verify it's called
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act
      const result = await mistralAI('system prompt', 'test prompt', mockArgs)

      // Assert
      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('Error invoking Mistral', expect.any(Error))

      // Restore console.error
      consoleSpy.mockRestore()
    })

    it('should use default model when not provided in args', async () => {
      // Arrange
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
      }
      mockCreate.mockResolvedValue(mockResponse)
      process.env.MISTRAL_API_KEY = 'test-api-key'
      const argsWithoutModel: Arguments = { 
        _: [],
        model: 'mistral-large-latest', // This will be ignored since we delete it
        maxTokens: 100,
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
        temperature: 0.7,
        topP: 0.9,
      }
      delete argsWithoutModel.model

      // Act
      await mistralAI('system prompt', 'test prompt', argsWithoutModel)

      // Assert
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'mistral-large-latest', // Default value
        })
      )
    })

    it('should handle undefined optional parameters correctly', async () => {
      // Arrange
      const mockResponse = {
        choices: [{ message: { content: 'Test response' } }],
      }
      mockCreate.mockResolvedValue(mockResponse)
      process.env.MISTRAL_API_KEY = 'test-api-key'
      
      const argsWithUndefined: Arguments = {
        _: [],
        model: 'mistral-small',
        maxTokens: undefined,
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
        temperature: undefined,
        topP: undefined,
      }

      // Act
      await mistralAI('system prompt', 'test prompt', argsWithUndefined)

      // Assert - temperature and top_p should not be included when undefined
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'mistral-small',
        messages: [
          { role: 'system', content: 'system prompt' },
          { role: 'user', content: 'test prompt' },
        ],
        max_tokens: null, // When maxTokens is undefined, it becomes null
        frequency_penalty: 0.5,
        presence_penalty: 0.5,
        // temperature and top_p should not be present in the call
      })
    })
  })

  describe('mistralFailedTestSummary', () => {
    it('should process failed tests and add AI summaries', async () => {
      // Arrange
      const mockReport: CtrfReport = {
        results: {
          tool: { name: 'Jest' },
          tests: [
            {
              name: 'Test 1',
              status: 'failed',
              duration: 100,
            },
            {
              name: 'Test 2',
              status: 'passed', // Should be ignored
              duration: 200,
            },
            {
              name: 'Test 3',
              status: 'failed',
              duration: 150,
              extra: { some: 'data' }, // Should be deleted
            },
          ],
        },
      } as any

      const mockArgs: Arguments = {
        _: [],
        model: 'mistral-large-latest',
      }

      // Set up the mock response
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'AI summary for failed test' } }],
      })

      // Act
      const result = await mistralFailedTestSummary(mockReport, mockArgs)

      // Assert - only failed tests should have ai property added
      expect(result.results.tests[0].ai).toBe('AI summary for failed test') // Test 1
      expect(result.results.tests[1].ai).toBeUndefined() // Test 2 (passed)
      expect(result.results.tests[2].ai).toBe('AI summary for failed test') // Test 3

      // Verify that extra property was deleted
      expect(result.results.tests[2].extra).toBeUndefined()

      // Verify that AI was called for each failed test
      expect(mockCreate).toHaveBeenCalledTimes(2) // Called for 2 failed tests
    })

    it('should respect maxMessages limit', async () => {
      // Arrange
      const mockReport: CtrfReport = {
        results: {
          tool: { name: 'Jest' },
          tests: [
            { name: 'Failed Test 1', status: 'failed', duration: 100 },
            { name: 'Failed Test 2', status: 'failed', duration: 150 },
            { name: 'Failed Test 3', status: 'failed', duration: 200 },
          ],
        },
      } as any

      const mockArgs: Arguments = {
        _: [],
        model: 'mistral-large-latest',
        maxMessages: 2,
      }

      // Set up the mock response
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'AI summary' } }],
      })

      // Act - this will create the OpenAI instance internally
      await mistralFailedTestSummary(mockReport, mockArgs)

      // Verify the calls
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('should handle additional prompt context', async () => {
      // Arrange
      const mockReport: CtrfReport = {
        results: {
          tool: { name: 'Jest' },
          tests: [
            { name: 'Failed Test', status: 'failed', duration: 100 },
          ],
        },
      } as any

      const mockArgs: Arguments = {
        _: [],
        model: 'mistral-large-latest',
        additionalPromptContext: 'Additional context here',
      }

      // Set up the mock response
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'AI summary' } }],
      })

      // Act
      await mistralFailedTestSummary(mockReport, mockArgs)

      // Assert - verify the prompt includes the additional context
      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.messages[1].content).toContain('Additional Context:\nAdditional context here')
    })

    it('should handle additional system prompt context', async () => {
      // Arrange
      const mockReport: CtrfReport = {
        results: {
          tool: { name: 'Jest' },
          tests: [
            { name: 'Failed Test', status: 'failed', duration: 100 },
          ],
        },
      } as any

      const mockArgs: Arguments = {
        _: [],
        model: 'mistral-large-latest',
        additionalSystemPromptContext: 'Additional system context',
      }

      // Set up the mock response
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'AI summary' } }],
      })

      // Act
      await mistralFailedTestSummary(mockReport, mockArgs)

      // Assert - verify the system prompt includes the additional context
      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.messages[0].content).toBe(`${FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT}\n\nAdditional system context`)
    })

    it('should call generateConsolidatedSummary when consolidate is true', async () => {
      // Arrange
      const mockReport: CtrfReport = {
        results: {
          tool: { name: 'Jest' },
          tests: [
            { name: 'Failed Test', status: 'failed', duration: 100 },
          ],
        },
      } as any

      const mockArgs: Arguments = {
        _: [],
        model: 'mistral-large-latest',
        consolidate: true,
      }

      // Set up the mock response
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'AI summary' } }],
      })

      // Act
      await mistralFailedTestSummary(mockReport, mockArgs)

      // Assert
      expect(generateConsolidatedSummary).toHaveBeenCalledWith(mockReport, 'mistral', mockArgs)
    })

    it('should not call generateConsolidatedSummary when consolidate is false', async () => {
      // Arrange
      const mockReport: CtrfReport = {
        results: {
          tool: { name: 'Jest' },
          tests: [
            { name: 'Failed Test', status: 'failed', duration: 100 },
          ],
        },
      } as any

      const mockArgs: Arguments = {
        _: [],
        model: 'mistral-large-latest',
        consolidate: false,
      }

      // Set up the mock response
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'AI summary' } }],
      })

      // Act
      await mistralFailedTestSummary(mockReport, mockArgs)

      // Assert
      expect(generateConsolidatedSummary).not.toHaveBeenCalled()
    })

    it('should save report when file is provided', async () => {
      // Arrange
      const mockReport: CtrfReport = {
        results: {
          tool: { name: 'Jest' },
          tests: [
            { name: 'Failed Test', status: 'failed', duration: 100 },
          ],
        },
      } as any

      const mockArgs: Arguments = {
        _: [],
        model: 'mistral-large-latest',
      }

      // Set up the mock response
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'AI summary' } }],
      })

      const mockFile = 'test-report.json'

      // Act
      await mistralFailedTestSummary(mockReport, mockArgs, mockFile)

      // Assert
      expect(saveUpdatedReport).toHaveBeenCalledWith(mockFile, mockReport)
    })

    it('should handle no failed tests scenario', async () => {
      // Arrange
      const mockReport: CtrfReport = {
        results: {
          tool: { name: 'Jest' },
          tests: [
            { name: 'Passed Test', status: 'passed', duration: 100 },
            { name: 'Skipped Test', status: 'skipped', duration: 150 },
          ],
        },
      } as any

      const mockArgs: Arguments = {
        _: [],
        model: 'mistral-large-latest',
      }

      // Act
      const result = await mistralFailedTestSummary(mockReport, mockArgs)

      // Assert - no AI calls should be made since there are no failed tests
      expect(mockCreate).not.toHaveBeenCalled()
      expect(result).toBe(mockReport) // Report should remain unchanged
    })

    it('should handle AI returning null response gracefully', async () => {
      // Arrange
      const mockReport: CtrfReport = {
        results: {
          tool: { name: 'Jest' },
          tests: [
            { name: 'Failed Test', status: 'failed', duration: 100 },
          ],
        },
      } as any

      const mockArgs: Arguments = {
        _: [],
        model: 'mistral-large-latest',
      }

      // Mock the AI to return a response with no content
      mockCreate.mockResolvedValue({
        choices: [{}], // No message content
      })

      // Act
      const result = await mistralFailedTestSummary(mockReport, mockArgs)

      // Assert - test should not have AI property added
      expect(result.results.tests[0].ai).toBeUndefined()
    })
  })
})