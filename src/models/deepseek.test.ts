import { deepseekAI } from './deepseek'
import { type CtrfReport } from '../../types/ctrf'
import { type Arguments } from '../index'
import OpenAI from 'openai'
import { stripAnsi } from '../common'
import { generateConsolidatedSummary } from '../consolidated-summary'
import { saveUpdatedReport } from '../common'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants'

// Mock the external dependencies
jest.mock('openai')
jest.mock('../common', () => ({
  stripAnsi: jest.fn((str) => str),
  saveUpdatedReport: jest.fn(),
}))
jest.mock('../consolidated-summary', () => ({
  generateConsolidatedSummary: jest.fn(),
}))
jest.mock('../constants', () => ({
  FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT: 'Default system prompt for failed test summary',
}))

describe('deepseekAI', () => {
  const mockApiKey = 'test-api-key'
  const mockBaseUrl = 'https://api.deepseek.test/v1'

  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = mockApiKey
    process.env.DEEPSEEK_API_BASE_URL = mockBaseUrl
  })

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY
    delete process.env.DEEPSEEK_API_BASE_URL
  })

  it('should successfully call the DeepSeek API and return the response', async () => {
    // Arrange
    const systemPrompt = 'You are a helpful assistant'
    const userPrompt = 'Hello, world!'
    const mockArgs: Arguments = {
      _: [],
      model: 'deepseek-reasoner',
      maxTokens: 100,
      temperature: 0.7,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      topP: 0.9,
    }
    const expectedResponse = 'Hello there! How can I assist you?'

    // Mock the OpenAI client and its response
    const mockChatCompletion = {
      choices: [{ message: { content: expectedResponse } }],
    }
    const mockClient = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue(mockChatCompletion),
        },
      },
    }
    ;(OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () => mockClient as any
    )

    // Act
    const result = await deepseekAI(systemPrompt, userPrompt, mockArgs)

    // Assert
    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: mockApiKey,
      baseURL: mockBaseUrl,
    })
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: 'deepseek-reasoner',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }, // stripAnsi is mocked to return the same string
      ],
      max_tokens: 100,
      frequency_penalty: 0.5,
      presence_penalty: 0.5,
      temperature: 0.7,
      top_p: 0.9,
    })
    expect(result).toBe(expectedResponse)
  })

  it('should use default base URL when DEEPSEEK_API_BASE_URL is not set', async () => {
    // Arrange
    delete process.env.DEEPSEEK_API_BASE_URL
    const systemPrompt = 'You are a helpful assistant'
    const userPrompt = 'Hello, world!'
    const mockArgs: Arguments = {
      _: [],
      model: 'deepseek-reasoner',
    }
    const expectedResponse = 'Hello there! How can I assist you?'

    // Mock the OpenAI client and its response
    const mockChatCompletion = {
      choices: [{ message: { content: expectedResponse } }],
    }
    const mockClient = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue(mockChatCompletion),
        },
      },
    }
    ;(OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () => mockClient as any
    )

    // Act
    await deepseekAI(systemPrompt, userPrompt, mockArgs)

    // Assert
    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: mockApiKey,
      baseURL: 'https://api.deepseek.com/v1',
    })
  })

  it('should handle missing max_tokens by setting it to null', async () => {
    // Arrange
    const systemPrompt = 'You are a helpful assistant'
    const userPrompt = 'Hello, world!'
    const mockArgs: Arguments = {
      _: [],
      model: 'deepseek-reasoner',
      // maxTokens is undefined
      temperature: 0.7,
    }
    const expectedResponse = 'Hello there! How can I assist you?'

    // Mock the OpenAI client and its response
    const mockChatCompletion = {
      choices: [{ message: { content: expectedResponse } }],
    }
    const mockClient = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue(mockChatCompletion),
        },
      },
    }
    ;(OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () => mockClient as any
    )

    // Act
    const result = await deepseekAI(systemPrompt, userPrompt, mockArgs)

    // Assert
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: 'deepseek-reasoner',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: null, // Should be null when maxTokens is undefined
      frequency_penalty: undefined,
      presence_penalty: undefined,
      temperature: 0.7,
    })
    expect(result).toBe(expectedResponse)
  })

  it('should return null when API call fails', async () => {
    // Arrange
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    const systemPrompt = 'You are a helpful assistant'
    const userPrompt = 'Hello, world!'
    const mockArgs: Arguments = {
      _: [],
    }

    // Mock the OpenAI client to throw an error
    const mockClient = {
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API Error')),
        },
      },
    }
    ;(OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () => mockClient as any
    )

    // Act
    const result = await deepseekAI(systemPrompt, userPrompt, mockArgs)

    // Assert
    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error invoking DeepSeek',
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })

  it('should not include optional parameters when they are undefined', async () => {
    // Arrange
    const systemPrompt = 'You are a helpful assistant'
    const userPrompt = 'Hello, world!'
    const mockArgs: Arguments = {
      _: [],
      model: 'deepseek-reasoner',
      // temperature is undefined
      // topP is undefined
    }
    const expectedResponse = 'Hello there! How can I assist you?'

    // Mock the OpenAI client and its response
    const mockChatCompletion = {
      choices: [{ message: { content: expectedResponse } }],
    }
    const mockClient = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue(mockChatCompletion),
        },
      },
    }
    ;(OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () => mockClient as any
    )

    // Act
    const result = await deepseekAI(systemPrompt, userPrompt, mockArgs)

    // Assert
    expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
      model: 'deepseek-reasoner',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: null,
      frequency_penalty: undefined,
      presence_penalty: undefined,
      // temperature and top_p should not be included
    })
    expect(result).toBe(expectedResponse)
  })
})