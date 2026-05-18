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
import { openAIFailedTestSummary, openAI } from './openai';
import { CtrfReport, CtrfTest } from '../../types/ctrf';
import { Arguments } from '../index';
import { generateConsolidatedSummary } from '../consolidated-summary';
import { saveUpdatedReport } from '../common';

// Mock other dependencies
jest.mock('../common', () => ({
  saveUpdatedReport: jest.fn(),
  stripAnsi: jest.fn((str) => str), // Default to returning the string as is
}));

jest.mock('../consolidated-summary', () => ({
  generateConsolidatedSummary: jest.fn(),
}));

describe('openAIFailedTestSummary', () => {
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

    const result = await openAIFailedTestSummary(mockReport, args);

    // Check that only failed tests were processed
    expect(result.results.tests[0].ai).toBe('AI analysis of failed test');
    expect(result.results.tests[1].ai).toBeUndefined(); // Passed test should not have AI summary
    expect(result.results.tests[2].ai).toBe('AI analysis of failed test');
    
    // Verify OpenAI API was called for each failed test (2 calls)
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

    await openAIFailedTestSummary(mockReport, args);

    // Verify OpenAI API was called only twice (for first 2 failed tests)
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

    await openAIFailedTestSummary(mockReport, args);

    // Verify that OpenAI was called with the additional context in the prompt
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

    await openAIFailedTestSummary(mockReport, args);

    // Verify that OpenAI was called with the additional system context
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

  it('should handle undefined response from openAI gracefully', async () => {
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

    const result = await openAIFailedTestSummary(mockReport, args);

    // Verify the test doesn't get an AI property when OpenAI returns null content
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

    await openAIFailedTestSummary(mockReport, args, undefined);

    expect(generateConsolidatedSummary).toHaveBeenCalledWith(mockReport, 'openai', args);
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

    await openAIFailedTestSummary(mockReport, args, undefined);

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

    await openAIFailedTestSummary(mockReport, args, filePath);

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

    await openAIFailedTestSummary(mockReport, args);

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

    const result = await openAIFailedTestSummary(mockReport, args);

    expect(result.results.tests[0].extra).toBeUndefined();
  });
});

// Test the openAI function separately
describe('openAI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call OpenAI API with correct parameters', async () => {
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
      model: 'gpt-4',
      maxTokens: 100,
      temperature: 0.7,
      frequencyPenalty: 0.5,
      presencePenalty: 0.5,
      topP: 0.9,
    };

    const result = await openAI(systemPrompt, prompt, args);

    expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
      model: 'gpt-4',
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

    const result = await openAI(systemPrompt, prompt, args);

    expect(result).toBeNull();
  });
});