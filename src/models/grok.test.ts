// Mock variables must be defined before the jest.mock() call
const mockChatCompletionsCreate = jest.fn()
const mockOpenAIClient = {
  chat: {
    completions: {
      create: mockChatCompletionsCreate
    }
  }
} as any

// Mock the dependencies
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn(() => mockOpenAIClient),
  }
})

import { type CtrfReport, type Summary, type Tool, type CtrfTestState } from '../../types/ctrf'
import { type Arguments } from '../index'
import { grokAI, grokFailedTestSummary } from './grok'
import OpenAI from 'openai'
import { stripAnsi } from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { saveUpdatedReport } from '../common'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'

jest.mock('../common', () => ({
  __esModule: true,
  stripAnsi: jest.fn((str) => str),
  saveUpdatedReport: jest.fn(),
}))

jest.mock('../consolidated-summary', () => ({
  __esModule: true,
  generateConsolidatedSummary: jest.fn(),
}))

describe('grok', () => {
  const mockOpenAI = OpenAI as unknown as jest.Mock;
  
  beforeEach(() => {
    mockChatCompletionsCreate.mockClear()
    mockChatCompletionsCreate.mockReset()
    jest.clearAllMocks()
  })

  afterAll(() => {
    jest.resetModules()
  })

  describe('grokAI', () => {
    const mockSystemPrompt = 'Test system prompt'
    const mockPrompt = 'Test user prompt'
    const mockArgs: Arguments = {
      _: [],
      model: 'grok-beta',
      maxTokens: 100,
      temperature: 0.7,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      topP: 0.9,
    }

    it('should successfully call the Grok API with correct parameters', async () => {
      // Arrange
      const expectedResponse = 'Test AI response'
      mockChatCompletionsCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: expectedResponse,
            },
          },
        ],
      })

      // Act
      const result = await grokAI(mockSystemPrompt, mockPrompt, mockArgs)

      // Assert
      expect(mockOpenAI).toHaveBeenCalledWith({
        apiKey: process.env.GROK_API_KEY,
        baseURL: process.env.GROK_API_BASE_URL ?? 'https://api.x.ai/v1',
      })
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
        model: mockArgs.model,
        messages: [
          { role: 'system', content: mockSystemPrompt },
          { role: 'user', content: mockPrompt }, // stripAnsi is mocked to return the same string
        ],
        max_tokens: mockArgs.maxTokens,
        frequency_penalty: mockArgs.frequencyPenalty,
        presence_penalty: mockArgs.presencePenalty,
        temperature: mockArgs.temperature,
        top_p: mockArgs.topP,
      })
      expect(result).toBe(expectedResponse)
    })

    it('should handle when response content is null', async () => {
      // Arrange
      mockChatCompletionsCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      })

      // Act
      const result = await grokAI(mockSystemPrompt, mockPrompt, mockArgs)

      // Assert
      expect(result).toBeNull()
    })

    it('should handle API errors gracefully and return null', async () => {
      // Arrange
      const error = new Error('API Error')
      mockChatCompletionsCreate.mockRejectedValue(error)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Act
      const result = await grokAI(mockSystemPrompt, mockPrompt, mockArgs)

      // Assert
      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith('Error invoking Grok', error)

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('should use default model when not provided', async () => {
      // Arrange
      const minimalArgs: Arguments = { _: [] }
      const expectedResponse = 'Test AI response'
      mockChatCompletionsCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: expectedResponse,
            },
          },
        ],
      })

      // Act
      await grokAI(mockSystemPrompt, mockPrompt, minimalArgs)

      // Assert
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'grok-beta', // default model
        })
      )
    })

    it('should use default base URL when GROK_API_BASE_URL is not set', async () => {
      // Arrange
      const originalBaseUrl = process.env.GROK_API_BASE_URL
      delete process.env.GROK_API_BASE_URL
      const expectedResponse = 'Test AI response'
      mockChatCompletionsCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: expectedResponse,
            },
          },
        ],
      })

      // Act
      await grokAI(mockSystemPrompt, mockPrompt, mockArgs)

      // Assert
      expect(mockOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.x.ai/v1', // default URL
        })
      )

      // Restore original value
      process.env.GROK_API_BASE_URL = originalBaseUrl
    })

    it('should handle undefined optional parameters correctly', async () => {
      // Arrange
      const argsWithUndefineds: Arguments = {
        _: [],
        model: 'grok-beta',
        maxTokens: undefined,
        temperature: undefined,
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
        topP: undefined,
      }
      const expectedResponse = 'Test AI response'
      mockChatCompletionsCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: expectedResponse,
            },
          },
        ],
      })

      // Act
      await grokAI(mockSystemPrompt, mockPrompt, argsWithUndefineds)

      // Assert
      const callArgs = mockChatCompletionsCreate.mock.calls[0][0]
      expect(callArgs).not.toHaveProperty('temperature') // should not be set if undefined
      expect(callArgs).not.toHaveProperty('top_p') // should not be set if undefined
      expect(callArgs).toHaveProperty('max_tokens', null) // max_tokens has a default of null
    })
  })

  describe('grokFailedTestSummary', () => {
    const createMockTest = (name: string, status: CtrfTestState, duration: number, extra?: Record<string, any>): any => ({
      name,
      status,
      duration,
      ...(extra && { extra })
    })

    const mockReport: CtrfReport = {
      results: {
        tool: {
          name: 'Test Tool',
          version: '1.0.0',
        } as Tool,
        summary: {
          tests: 3,
          passed: 1,
          failed: 2,
          skipped: 0,
          pending: 0,
          other: 0,
          start: Date.now(),
          stop: Date.now() + 1000,
        } as Summary,
        tests: [
          createMockTest('Passed Test', 'passed', 100),
          createMockTest('Failed Test 1', 'failed', 200, { someData: 'data' }),
          createMockTest('Failed Test 2', 'failed', 300),
        ],
      },
    }

    const mockArgs: Arguments = {
      _: [],
      model: 'grok-beta',
      maxTokens: 100,
      temperature: 0.7,
    }

    beforeEach(() => {
      (stripAnsi as jest.Mock).mockImplementation((str) => str)
    })

    it('should call grokAI for each failed test', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const mockReportForCallTest = JSON.parse(JSON.stringify(mockReport)); // Create a deep copy
      const mockResponse = {
        choices: [{
          message: {
            content: 'AI analysis of failed test'
          }
        }]
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      // Act
      const result = await grokFailedTestSummary(mockReportForCallTest, mockArgs)

      // Assert
      // Should have been called once for each failed test (2 failed tests)
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(2)
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: expect.stringContaining('Failed Test 1') })
          ])
        })
      )
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: expect.stringContaining('Failed Test 2') })
          ])
        })
      )

      // Check that AI property was added to failed tests
      const failedTest1 = result.results.tests.find(
        (t) => t.name === 'Failed Test 1'
      )
      const failedTest2 = result.results.tests.find(
        (t) => t.name === 'Failed Test 2'
      )
      expect(failedTest1?.ai).toBe('AI analysis of failed test')
      expect(failedTest2?.ai).toBe('AI analysis of failed test')

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('should handle when grokAI returns null', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const mockReportForNullTest = JSON.parse(JSON.stringify(mockReport)); // Create a deep copy
      mockChatCompletionsCreate.mockResolvedValue({
        choices: [{
          message: {
            content: null
          }
        }]
      })

      // Act
      const result = await grokFailedTestSummary(mockReportForNullTest, mockArgs)

      // Assert
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(2) // called for each failed test
      // Check that AI property was NOT added when grokAI returned null
      const failedTest1 = result.results.tests.find(
        (t) => t.name === 'Failed Test 1'
      )
      const failedTest2 = result.results.tests.find(
        (t) => t.name === 'Failed Test 2'
      )
      expect(failedTest1?.ai).toBeUndefined()
      expect(failedTest2?.ai).toBeUndefined()

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('should respect maxMessages limit', async () => {
      // Arrange
      const limitedArgs = { ...mockArgs, maxMessages: 1 }
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const mockReportForLimitTest = JSON.parse(JSON.stringify(mockReport)); // Create a deep copy
      const mockResponse = {
        choices: [{
          message: {
            content: 'AI analysis'
          }
        }]
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      // Act
      await grokFailedTestSummary(mockReportForLimitTest, limitedArgs)

      // Assert
      // Should only call grokAI for the first failed test due to maxMessages limit
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1)

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('should add additional prompt context if provided', async () => {
      // Arrange
      const argsWithAdditionalContext = {
        ...mockArgs,
        additionalPromptContext: 'Additional context here',
      }
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const mockReportForPromptContextTest = JSON.parse(JSON.stringify(mockReport)); // Create a deep copy
      const mockResponse = {
        choices: [{
          message: {
            content: 'AI analysis'
          }
        }]
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      // Act
      await grokFailedTestSummary(mockReportForPromptContextTest, argsWithAdditionalContext)

      // Assert
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ content: expect.stringContaining('Additional Context:\nAdditional context here') })
          ])
        })
      )

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('should add additional system prompt context if provided', async () => {
      // Arrange
      const additionalSystemContext = 'Additional system context here'
      const argsWithAdditionalSystemContext = {
        ...mockArgs,
        additionalSystemPromptContext: additionalSystemContext,
      }
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const mockReportForSystemContextTest = JSON.parse(JSON.stringify(mockReport)); // Create a deep copy
      const mockResponse = {
        choices: [{
          message: {
            content: 'AI analysis'
          }
        }]
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      // Act
      await grokFailedTestSummary(mockReportForSystemContextTest, argsWithAdditionalSystemContext)

      // Assert
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ content: expect.stringContaining(additionalSystemContext) })
          ])
        })
      )

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('should generate consolidated summary when consolidate option is true', async () => {
      // Arrange
      const consolidateArgs = { ...mockArgs, consolidate: true }
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const mockReportForConsolidateTest = JSON.parse(JSON.stringify(mockReport)); // Create a deep copy
      const mockResponse = {
        choices: [{
          message: {
            content: 'AI analysis'
          }
        }]
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      // Act
      await grokFailedTestSummary(mockReportForConsolidateTest, consolidateArgs)

      // Assert
      expect(generateConsolidatedSummary).toHaveBeenCalledWith(
        mockReportForConsolidateTest,
        'grok',
        consolidateArgs
      )

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('should not generate consolidated summary when consolidate option is false', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const mockResponse = {
        choices: [{
          message: {
            content: 'AI analysis'
          }
        }]
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      // Act
      await grokFailedTestSummary(mockReport, mockArgs)

      // Assert
      expect(generateConsolidatedSummary).not.toHaveBeenCalled()

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('should save updated report when file is provided', async () => {
      // Arrange
      const testFile = 'test-report.json'
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const mockReportForSaveTest = JSON.parse(JSON.stringify(mockReport)); // Create a deep copy
      const mockResponse = {
        choices: [{
          message: {
            content: 'AI analysis'
          }
        }]
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      // Act
      await grokFailedTestSummary(mockReportForSaveTest, mockArgs, testFile)

      // Assert
      expect(saveUpdatedReport).toHaveBeenCalledWith(testFile, mockReportForSaveTest)

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('should not save updated report when file is not provided', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const mockResponse = {
        choices: [{
          message: {
            content: 'AI analysis'
          }
        }]
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      // Act
      await grokFailedTestSummary(mockReport, mockArgs)

      // Assert
      expect(saveUpdatedReport).not.toHaveBeenCalled()

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('should remove extra property from failed tests', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const mockReportForExtraTest = JSON.parse(JSON.stringify(mockReport)); // Create a deep copy
      const mockResponse = {
        choices: [{
          message: {
            content: 'AI analysis'
          }
        }]
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      // Act
      const result = await grokFailedTestSummary(mockReportForExtraTest, mockArgs)

      // Assert
      const failedTestWithExtra = result.results.tests.find(
        (t) => t.name === 'Failed Test 1'
      )
      expect(failedTestWithExtra?.extra).toBeUndefined()

      // Cleanup
      consoleSpy.mockRestore()
    })

    it('should handle reports with no failed tests', async () => {
      // Arrange
      const reportWithNoFailures = {
        ...mockReport,
        results: {
          ...mockReport.results,
          tests: [
            createMockTest('Passed Test 1', 'passed', 100),
            createMockTest('Passed Test 2', 'passed', 200),
          ],
        },
      }
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const mockResponse = {
        choices: [{
          message: {
            content: 'AI analysis'
          }
        }]
      }
      mockChatCompletionsCreate.mockResolvedValue(mockResponse)

      // Act
      const result = await grokFailedTestSummary(reportWithNoFailures, mockArgs)

      // Assert
      expect(mockChatCompletionsCreate).not.toHaveBeenCalled() // Should not call grokAI for passed tests
      expect(result).toEqual(reportWithNoFailures)

      // Cleanup
      consoleSpy.mockRestore()
    })
  })
})