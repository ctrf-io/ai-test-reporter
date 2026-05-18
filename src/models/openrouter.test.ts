// Mock the OpenAI module before any imports
const mockChatCompletionsCreate = jest.fn();
const mockOpenAIClient = {
  chat: {
    completions: {
      create: mockChatCompletionsCreate,
    },
  },
};

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn(() => mockOpenAIClient),
  };
});

// Now import after the mock
import { openRouterFailedTestSummary, openRouter } from './openrouter';
import { CtrfReport, CtrfTest } from '../../types/ctrf';
import { Arguments } from '../index';
import { generateConsolidatedSummary } from '../consolidated-summary';
import { saveUpdatedReport, stripAnsi } from '../common';
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from '../constants';

// Mock other dependencies
jest.mock('../common', () => ({
  saveUpdatedReport: jest.fn(),
  stripAnsi: jest.fn((str) => str), // Default to returning the string as is
}));

jest.mock('../consolidated-summary', () => ({
  generateConsolidatedSummary: jest.fn(),
}));

describe('openRouterFailedTestSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockTest = (overrides: Partial<CtrfTest>): CtrfTest => ({
    name: 'Test Name',
    status: 'failed',
    duration: 100,
    ...overrides
  });

  it('should process failed tests and add AI summaries', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'AI analysis of failed test',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

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
    };

    const args: Arguments = { _: [] };

    const result = await openRouterFailedTestSummary(mockReport, args);

    // Check that only failed tests were processed
    expect(result.results.tests[0].ai).toBe('AI analysis of failed test');
    expect(result.results.tests[1].ai).toBeUndefined(); // Passed test should not have AI summary
    expect(result.results.tests[2].ai).toBe('AI analysis of failed test');

    // Verify OpenRouter API was called for each failed test (2 calls)
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(2);
  });

  it('should respect maxMessages limit', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'AI analysis',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

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
    };

    const args: Arguments = {
      _: [],
      maxMessages: 2, // Should only process first 2 failed tests
    };

    await openRouterFailedTestSummary(mockReport, args);

    // Verify OpenRouter API was called only twice (for first 2 failed tests)
    expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(2);
  });

  it('should process additional prompt context when provided', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'AI analysis with context',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

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
    };

    const args: Arguments = {
      _: [],
      additionalPromptContext: 'Additional context for the AI',
    };

    await openRouterFailedTestSummary(mockReport, args);

    // Verify that OpenRouter was called with the additional context in the prompt
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Additional Context:\nAdditional context for the AI')
          })
        ])
      })
    );
  });

  it('should process additional system prompt context when provided', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'AI analysis with system context',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

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
    };

    const args: Arguments = {
      _: [],
      additionalSystemPromptContext: 'Additional system context',
    };

    await openRouterFailedTestSummary(mockReport, args);

    // Verify that OpenRouter was called with the additional system context
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Additional system context')
          })
        ])
      })
    );
  });

  it('should handle undefined response from openRouter gracefully', async () => {
    const mockResponse = {
      choices: [
        {
          message: {},
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

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
    };

    const args: Arguments = { _: [] };

    const result = await openRouterFailedTestSummary(mockReport, args);

    // Verify the test doesn't get an AI property when OpenRouter returns null content
    expect(result.results.tests[0].ai).toBeUndefined();
  });

  it('should call generateConsolidatedSummary when consolidate is true', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'AI analysis',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

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
    };

    const args: Arguments = {
      _: [],
      consolidate: true,
    };

    await openRouterFailedTestSummary(mockReport, args, undefined);

    expect(generateConsolidatedSummary).toHaveBeenCalledWith(mockReport, 'openrouter', args);
  });

  it('should not call generateConsolidatedSummary when consolidate is false', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'AI analysis',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

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
    };

    const args: Arguments = {
      _: [],
      consolidate: false,
    };

    await openRouterFailedTestSummary(mockReport, args, undefined);

    expect(generateConsolidatedSummary).not.toHaveBeenCalled();
  });

  it('should call saveUpdatedReport when file is provided', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'AI analysis',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

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
    };

    const args: Arguments = { _: [] };
    const filePath = 'test-report.json';

    await openRouterFailedTestSummary(mockReport, args, filePath);

    expect(saveUpdatedReport).toHaveBeenCalledWith(filePath, mockReport);
  });

  it('should not call saveUpdatedReport when file is not provided', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'AI analysis',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

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
    };

    const args: Arguments = { _: [] };

    await openRouterFailedTestSummary(mockReport, args);

    expect(saveUpdatedReport).not.toHaveBeenCalled();
  });

  it('should remove extra property from failed tests', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'AI analysis',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

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
    };

    const args: Arguments = { _: [] };

    const result = await openRouterFailedTestSummary(mockReport, args);

    expect(result.results.tests[0].extra).toBeUndefined();
  });
});

// Test the openRouter function separately
describe('openRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call OpenRouter API with correct parameters', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Test response',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

    const systemPrompt = 'You are a helpful assistant';
    const prompt = 'Tell me a joke';
    const args: Arguments = {
      _: [],
      model: 'openai/gpt-4',
      maxTokens: 100,
      temperature: 0.7,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      topP: 0.9,
    };

    const result = await openRouter(systemPrompt, prompt, args);

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: 'openai/gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 100,
      frequency_penalty: 0.5,
      presence_penalty: 0.5,
      temperature: 0.7,
      top_p: 0.9,
    });
    expect(result).toBe('Test response');
  });

  it('should use default model if not provided in args', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Test response',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

    const systemPrompt = 'You are a helpful assistant';
    const prompt = 'Hello';
    const args: Arguments = { _: [] }; // no model specified

    await openRouter(systemPrompt, prompt, args);

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openai/gpt-3.5-turbo',
      })
    );
  });

  it('should handle responses without message content gracefully', async () => {
    const mockResponse = {
      choices: [
        {
          message: {},
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

    const systemPrompt = 'You are a helpful assistant';
    const prompt = 'Hello';
    const args: Arguments = { _: [] };

    const result = await openRouter(systemPrompt, prompt, args);

    expect(result).toBeNull();
  });

  it('should call API with environment variables for OpenRouter configuration', async () => {
    // Mock environment variables
    const originalApiKey = process.env.OPENROUTER_API_KEY;
    const originalReferer = process.env.OPENROUTER_REFERER;
    process.env.OPENROUTER_API_KEY = 'test-api-key';
    process.env.OPENROUTER_REFERER = 'http://test.com';

    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Test response',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

    const systemPrompt = 'You are a helpful assistant';
    const prompt = 'Hello';
    const args: Arguments = { _: [] };

    await openRouter(systemPrompt, prompt, args);

    const OpenAIMock = require('openai').default;
    expect(OpenAIMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-api-key',
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'http://test.com',
          'X-Title': 'AI Test Reporter',
        },
      })
    );

    // Restore original environment variables
    process.env.OPENROUTER_API_KEY = originalApiKey;
    process.env.OPENROUTER_REFERER = originalReferer;
  });

  it('should use default referer when environment variable is not set', async () => {
    const originalApiKey = process.env.OPENROUTER_API_KEY;
    const originalReferer = process.env.OPENROUTER_REFERER;
    delete process.env.OPENROUTER_REFERER;
    process.env.OPENROUTER_API_KEY = 'test-api-key';

    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Test response',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

    const systemPrompt = 'You are a helpful assistant';
    const prompt = 'Hello';
    const args: Arguments = { _: [] };

    await openRouter(systemPrompt, prompt, args);

    const OpenAIMock = require('openai').default;
    expect(OpenAIMock).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultHeaders: {
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'AI Test Reporter',
        },
      })
    );

    // Restore original environment variables
    process.env.OPENROUTER_API_KEY = originalApiKey;
    process.env.OPENROUTER_REFERER = originalReferer;
  });

  it('should handle API errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockChatCompletionsCreate.mockRejectedValue(new Error('API Error'));

    const systemPrompt = 'You are a helpful assistant';
    const prompt = 'Hello';
    const args: Arguments = { _: [] };

    const result = await openRouter(systemPrompt, prompt, args);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('Error invoking OpenRouter', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('should call stripAnsi on the prompt before sending to API', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Test response',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

    const systemPrompt = 'You are a helpful assistant';
    const prompt = 'Hello \x1b[31mred text\x1b[0m'; // ANSI-coded red text
    const args: Arguments = { _: [] };

    await openRouter(systemPrompt, prompt, args);

    expect(stripAnsi).toHaveBeenCalledWith(prompt);
    expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }, // Note: stripAnsi is mocked to return the original string
        ]
      })
    );
  });

  it('should only include conditional parameters when they are defined', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Test response',
          },
        },
      ],
    };

    mockChatCompletionsCreate.mockResolvedValue(mockResponse);

    const systemPrompt = 'You are a helpful assistant';
    const prompt = 'Hello';
    const args: Arguments = {
      _: [],
      model: 'openai/gpt-4',
      // Only maxTokens is defined, other parameters are undefined
      maxTokens: 500,
    };

    await openRouter(systemPrompt, prompt, args);

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: 'openai/gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 500,
      // Only max_tokens is included, other optional parameters are excluded
    });
  });
});