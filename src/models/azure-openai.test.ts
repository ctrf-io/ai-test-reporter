import { AzureOpenAI } from 'openai'
import { azureOpenAI, azureOpenAIFailedTestSummary } from './azure-openai'
import { type CtrfReport } from '../../types/ctrf'
import { type Arguments } from '../index'
import { stripAnsi, saveUpdatedReport } from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'

// Mock the external dependencies
jest.mock('openai', () => ({
  AzureOpenAI: jest.fn(),
}))

jest.mock('../common', () => ({
  stripAnsi: jest.fn((str) => str),
  saveUpdatedReport: jest.fn(),
}))

jest.mock('../consolidated-summary', () => ({
  generateConsolidatedSummary: jest.fn(),
}))

// Mock console.error to prevent test output pollution
let consoleErrorSpy: jest.SpyInstance
let consoleLogSpy: jest.SpyInstance

beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
})

afterAll(() => {
  consoleErrorSpy.mockRestore()
  consoleLogSpy.mockRestore()
})

describe('azureOpenAI', () => {
  let mockAzureOpenAIClient: any
  let mockChatCompletionsCreate: jest.Mock

  beforeEach(() => {
    // Reset environment variables to ensure clean state
    delete process.env.AZURE_OPENAI_API_KEY
    delete process.env.AZURE_OPENAI_ENDPOINT
    delete process.env.AZURE_OPENAI_DEPLOYMENT_NAME

    // Set up mock for AzureOpenAI client
    mockChatCompletionsCreate = jest.fn()
    mockAzureOpenAIClient = require('openai').AzureOpenAI
    mockAzureOpenAIClient.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockChatCompletionsCreate,
        },
      },
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return null when required environment variables are missing', async () => {
    const result = await azureOpenAI('system prompt', 'user prompt', {} as Arguments)
    expect(result).toBeNull()
  })

  it('should return null when API key is empty', async () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'
    
    const result = await azureOpenAI('system prompt', 'user prompt', {} as Arguments)
    expect(result).toBeNull()
  })

  it('should return null when endpoint is empty', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'
    
    const result = await azureOpenAI('system prompt', 'user prompt', {} as Arguments)
    expect(result).toBeNull()
  })

  it('should return null when deployment name is empty', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    
    const result = await azureOpenAI('system prompt', 'user prompt', {} as Arguments)
    expect(result).toBeNull()
  })

  it('should initialize AzureOpenAI client with correct configuration', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mocked response' } }],
    } as any)

    await azureOpenAI('system prompt', 'user prompt', {} as Arguments)

    expect(mockAzureOpenAIClient).toHaveBeenCalledWith({
      apiKey: 'test-key',
      endpoint: 'https://test.openai.azure.com',
      apiVersion: '2024-05-01-preview',
    })
  })

  it('should call chat completions with correct parameters', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mocked response' } }],
    } as any)

    await azureOpenAI('system prompt', 'user prompt', {} as Arguments)

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: 'test-deployment',
      messages: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'user prompt' },
      ],
      max_tokens: null,
      frequency_penalty: undefined,
      presence_penalty: undefined,
    })
  })

  it('should use stripAnsi to process the prompt', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mocked response' } }],
    } as any)

    const stripAnsiSpy = jest.spyOn(require('../common'), 'stripAnsi')

    await azureOpenAI('system prompt', 'user prompt', {} as Arguments)

    expect(stripAnsiSpy).toHaveBeenCalledWith('user prompt')
  })

  it('should handle max tokens from arguments', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mocked response' } }],
    } as any)

    const args = { maxTokens: 500 } as Arguments
    await azureOpenAI('system prompt', 'user prompt', args)

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        max_tokens: 500,
      })
    )
  })

  it('should handle frequency penalty from arguments', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mocked response' } }],
    } as any)

    const args = { frequencyPenalty: 0.5 } as Arguments
    await azureOpenAI('system prompt', 'user prompt', args)

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        frequency_penalty: 0.5,
      })
    )
  })

  it('should handle presence penalty from arguments', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mocked response' } }],
    } as any)

    const args = { presencePenalty: 0.5 } as Arguments
    await azureOpenAI('system prompt', 'user prompt', args)

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        presence_penalty: 0.5,
      })
    )
  })

  it('should handle temperature from arguments', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mocked response' } }],
    } as any)

    const args = { temperature: 0.7 } as Arguments
    await azureOpenAI('system prompt', 'user prompt', args)

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.7,
      })
    )
  })

  it('should handle top_p from arguments', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mocked response' } }],
    } as any)

    const args = { topP: 0.9 } as Arguments
    await azureOpenAI('system prompt', 'user prompt', args)

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        top_p: 0.9,
      })
    )
  })

  it('should return the content from the response', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mocked response content' } }],
    } as any)

    const result = await azureOpenAI('system prompt', 'user prompt', {} as Arguments)

    expect(result).toBe('Mocked response content')
  })

  it('should return null when response message content is undefined', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: undefined } }],
    } as any)

    const result = await azureOpenAI('system prompt', 'user prompt', {} as Arguments)

    expect(result).toBeNull()
  })

  it('should return null when response is empty', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'

    mockChatCompletionsCreate.mockResolvedValue({ choices: [] } as any)

    const result = await azureOpenAI('system prompt', 'user prompt', {} as Arguments)

    expect(result).toBeNull()
  })

  it('should return null on error', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'

    mockChatCompletionsCreate.mockRejectedValue(new Error('API Error'))

    const result = await azureOpenAI('system prompt', 'user prompt', {} as Arguments)

    expect(result).toBeNull()
  })

  it('should use deployment from arguments if provided', async () => {
    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    // Don't set deployment name in env to test argument override

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'Mocked response' } }],
    } as any)

    const args = { deploymentId: 'arg-deployment' } as Arguments
    await azureOpenAI('system prompt', 'user prompt', args)

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: 'arg-deployment',
      messages: [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'user prompt' },
      ],
      max_tokens: null,
      frequency_penalty: undefined,
      presence_penalty: undefined,
    })
  })
})

describe('azureOpenAIFailedTestSummary', () => {
  let mockAzureOpenAIClient: any
  let mockChatCompletionsCreate: jest.Mock

  beforeEach(() => {
    // Reset environment variables to ensure clean state
    delete process.env.AZURE_OPENAI_API_KEY
    delete process.env.AZURE_OPENAI_ENDPOINT
    delete process.env.AZURE_OPENAI_DEPLOYMENT_NAME

    // Set up mock for AzureOpenAI client
    mockChatCompletionsCreate = jest.fn()
    mockAzureOpenAIClient = require('openai').AzureOpenAI
    mockAzureOpenAIClient.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockChatCompletionsCreate,
        },
      },
    }))

    process.env.AZURE_OPENAI_API_KEY = 'test-key'
    process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com'
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME = 'test-deployment'
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should process failed tests and add AI summaries', async () => {
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
            status: 'passed',
            duration: 200,
          },
        ],
      },
    } as any

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'AI summary for failed test' } }],
    } as any)

    const args = { log: false } as Arguments
    const result = await azureOpenAIFailedTestSummary(mockReport, args)

    // Verify that only failed tests were processed
    expect(result.results.tests[0].ai).toBe('AI summary for failed test')
    expect(result.results.tests[1]).not.toHaveProperty('ai')
  })

  it('should delete extra property from failed tests', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
            extra: { some: 'data' },
          },
          {
            name: 'Test 2',
            status: 'passed',
            duration: 200,
          },
        ],
      },
    } as any

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'AI summary for failed test' } }],
    } as any)

    const args = { log: false } as Arguments
    const result = await azureOpenAIFailedTestSummary(mockReport, args)

    // Verify that the extra property was removed from failed tests
    expect(result.results.tests[0]).not.toHaveProperty('extra')
    expect(result.results.tests[1]).not.toHaveProperty('ai')
  })

  it('should respect maxMessages limit', async () => {
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
            status: 'failed',
            duration: 200,
          },
          {
            name: 'Test 3',
            status: 'failed',
            duration: 300,
          },
        ],
      },
    } as any

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'AI summary for failed test' } }],
    } as any)

    const args = { maxMessages: 2, log: false } as Arguments
    await azureOpenAIFailedTestSummary(mockReport, args)

    // Verify that only the specified number of messages were processed
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(2)
  })

  it('should add additional prompt context if provided', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
          },
        ],
      },
    } as any

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'AI summary for failed test' } }],
    } as any)

    const args = { 
      additionalPromptContext: 'Additional context data',
      log: false 
    } as Arguments
    await azureOpenAIFailedTestSummary(mockReport, args)

    // Verify that the additional prompt context was included in the call
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: 'test-deployment',
      messages: [
        { 
          role: 'system', 
          content: expect.stringContaining(FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT) 
        },
        { 
          role: 'user', 
          content: expect.stringContaining('Additional Context:\nAdditional context data') 
        },
      ],
      max_tokens: null,
      frequency_penalty: undefined,
      presence_penalty: undefined,
    })
  })

  it('should add additional system prompt context if provided', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
          },
        ],
      },
    } as any

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'AI summary for failed test' } }],
    } as any)

    const args = {
      additionalSystemPromptContext: 'Additional system context',
      log: false
    } as Arguments
    await azureOpenAIFailedTestSummary(mockReport, args)

    // Verify that the additional system prompt context was included in the call
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: 'test-deployment',
      messages: [
        {
          role: 'system',
          content: expect.stringContaining(FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT)
        },
        {
          role: 'user',
          content: expect.stringContaining('Report:')
        },
      ],
      max_tokens: null,
      frequency_penalty: undefined,
      presence_penalty: undefined,
    })

    // Check that the system prompt contains the additional context
    const callArgs = mockChatCompletionsCreate.mock.calls[0][0]
    expect(callArgs.messages[0].content).toContain('Additional system context')
  })

  it('should use custom system prompt if provided', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
          },
        ],
      },
    } as any

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'AI summary for failed test' } }],
    } as any)

    const args = { 
      systemPrompt: 'Custom system prompt',
      log: false 
    } as Arguments
    await azureOpenAIFailedTestSummary(mockReport, args)

    // Verify that the custom system prompt was used
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: 'test-deployment',
      messages: [
        { 
          role: 'system', 
          content: 'Custom system prompt' 
        },
        { 
          role: 'user', 
          content: expect.stringContaining('Report:') 
        },
      ],
      max_tokens: null,
      frequency_penalty: undefined,
      presence_penalty: undefined,
    })
  })

  it('should call generateConsolidatedSummary when consolidate is true', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
          },
        ],
      },
    } as any

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'AI summary for failed test' } }],
    } as any)

    const args = { 
      consolidate: true,
      log: false 
    } as Arguments
    await azureOpenAIFailedTestSummary(mockReport, args, 'test-file.json')

    // Verify that generateConsolidatedSummary was called
    expect(require('../consolidated-summary').generateConsolidatedSummary)
      .toHaveBeenCalledWith(mockReport, 'azure', args)
  })

  it('should save updated report when file is provided', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
          },
        ],
      },
    } as any

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'AI summary for failed test' } }],
    } as any)

    const args = { log: false } as Arguments
    await azureOpenAIFailedTestSummary(mockReport, args, 'test-file.json')

    // Verify that saveUpdatedReport was called
    expect(require('../common').saveUpdatedReport)
      .toHaveBeenCalledWith('test-file.json', mockReport)
  })

  it('should not save updated report when file is not provided', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
          },
        ],
      },
    } as any

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'AI summary for failed test' } }],
    } as any)

    const args = { log: false } as Arguments
    await azureOpenAIFailedTestSummary(mockReport, args)

    // Verify that saveUpdatedReport was not called
    expect(require('../common').saveUpdatedReport).not.toHaveBeenCalled()
  })

  it('should return the updated report', async () => {
    const mockReport: CtrfReport = {
      results: {
        tool: { name: 'Jest' },
        tests: [
          {
            name: 'Test 1',
            status: 'failed',
            duration: 100,
          },
        ],
      },
    } as any

    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{ message: { content: 'AI summary for failed test' } }],
    } as any)

    const args = { log: false } as Arguments
    const result = await azureOpenAIFailedTestSummary(mockReport, args)

    // Verify that the function returns the processed report
    expect(result).toEqual(mockReport)
    expect(result.results.tests[0].ai).toBe('AI summary for failed test')
  })
})