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
import { perplexity, perplexityFailedTestSummary } from './perplexity';
import { CtrfReport, CtrfTest } from '../../types/ctrf';
import { Arguments } from '../index';
import { generateConsolidatedSummary } from '../consolidated-summary';
import { saveUpdatedReport, stripAnsi } from '../common';

// Mock other dependencies
jest.mock('../common', () => ({
  saveUpdatedReport: jest.fn(),
  stripAnsi: jest.fn((str) => str), // Default to returning the string as is
}));

jest.mock('../consolidated-summary', () => ({
  generateConsolidatedSummary: jest.fn(),
}));

jest.mock('../constants', () => ({
  FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT: 'Default system prompt for failed test summary',
}));

// Mock console.error to suppress error logs during testing
global.console.error = jest.fn();

describe('perplexity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.PERPLEXITY_API_KEY;
  });

  describe('perplexity function', () => {
    it('should make a successful request to Perplexity API', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Test response content',
            },
          },
        ],
      };
      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const systemPrompt = 'Test system prompt';
      const prompt = 'Test user prompt';
      const args: Arguments = {
        _: [],
        model: 'test-model',
        maxTokens: 100,
        temperature: 0.7,
        frequencyPenalty: 0.5,
        presencePenalty: 0.5,
        topP: 0.9,
      };

      // Act
      const result = await perplexity(systemPrompt, prompt, args);

      // Assert
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
        model: 'test-model',
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
      expect(result).toBe('Test response content');
    });

    it('should return null when API request fails', async () => {
      // Arrange
      const mockError = new Error('API Error');
      mockChatCompletionsCreate.mockRejectedValue(mockError);

      const systemPrompt = 'Test system prompt';
      const prompt = 'Test user prompt';
      const args: Arguments = { _: [] };

      // Act
      const result = await perplexity(systemPrompt, prompt, args);

      // Assert
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Error invoking Perplexity', mockError);
    });

    it('should use default model when no model is provided', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Test response content',
            },
          },
        ],
      };
      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const systemPrompt = 'Test system prompt';
      const prompt = 'Test user prompt';
      const args: Arguments = {
        _: [],
      };

      // Act
      await perplexity(systemPrompt, prompt, args);

      // Assert
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'llama-3.1-sonar-small-128k-online',
        })
      );
    });

    it('should handle arguments with undefined values correctly', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Test response content',
            },
          },
        ],
      };
      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const systemPrompt = 'Test system prompt';
      const prompt = 'Test user prompt';
      const args: Arguments = {
        _: [],
        model: 'test-model',
        temperature: undefined,
        topP: undefined,
        maxTokens: undefined, // Use undefined - this will become null in the actual API call
      };

      // Act
      await perplexity(systemPrompt, prompt, args);

      // Assert
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith({
        model: 'test-model',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: null, // The implementation converts undefined maxTokens to null (due to ?? operator)
        frequency_penalty: undefined,
        presence_penalty: undefined,
        // Note: temperature and top_p should not be included when undefined
      });
    });
  });

  describe('perplexityFailedTestSummary', () => {
    const createMockTest = (overrides: Partial<CtrfTest>): CtrfTest => ({
      name: 'Test Name',
      status: 'failed',
      duration: 100,
      ai: undefined,
      ...overrides
    });

    it('should process failed tests and add AI summaries', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'AI analysis of the failed test',
            },
          },
        ],
      };
      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const mockReport: CtrfReport = {
        results: {
          tool: {
            name: 'Test Tool',
            version: '1.0.0',
          },
          summary: {
            tests: 3,
            passed: 1,
            failed: 2,
            skipped: 0,
            pending: 0,
            other: 0,
            start: Date.now(),
            stop: Date.now() + 1000,
          },
          tests: [
            createMockTest({
              name: 'Failed Test 1',
              status: 'failed',
              duration: 100,
              extra: { some: 'data' },
            }),
            createMockTest({
              name: 'Passed Test',
              status: 'passed',
              duration: 50,
            }),
            createMockTest({
              name: 'Failed Test 2',
              status: 'failed',
              duration: 200,
            }),
          ],
        },
      };

      const args: Arguments = {
        _: [],
        model: 'test-model',
        temperature: 0.7,
      };

      // Act
      const result = await perplexityFailedTestSummary(mockReport, args);

      // Assert
      // Check that extra property was removed from failed tests
      expect(result.results.tests[0].extra).toBeUndefined();
      expect(result.results.tests[2].extra).toBeUndefined(); // Only failed tests should have extra removed

      // Check that AI summary was added to failed tests
      expect(result.results.tests[0].ai).toBe('AI analysis of the failed test');

      // The passed test should remain unchanged
      expect(result.results.tests[1].status).toBe('passed');
      expect(result.results.tests[1].ai).toBeUndefined();
    });

    it('should respect maxMessages limit', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'AI analysis of the failed test',
            },
          },
        ],
      };
      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const mockReport: CtrfReport = {
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
            start: Date.now(),
            stop: Date.now() + 1000,
          },
          tests: [
            createMockTest({
              name: 'Failed Test 1',
              status: 'failed',
              duration: 100,
            }),
            createMockTest({
              name: 'Failed Test 2',
              status: 'failed',
              duration: 200,
            }),
            createMockTest({
              name: 'Failed Test 3',
              status: 'failed',
              duration: 150,
            }),
          ],
        },
      };

      const args: Arguments = {
        _: [],
        model: 'test-model',
        temperature: 0.7,
        maxMessages: 2, // Should only process 2 failed tests
      };

      // Act
      const result = await perplexityFailedTestSummary(mockReport, args);

      // Assert
      // Only the first 2 failed tests should have AI summaries
      expect(result.results.tests[0].ai).toBe('AI analysis of the failed test');
      expect(result.results.tests[1].ai).toBe('AI analysis of the failed test');
      // The third failed test should not have an AI summary due to the limit
      expect(result.results.tests[2].ai).toBeUndefined();

      // Verify OpenAI API was called only twice (for first 2 failed tests)
      expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(2);
    });

    it('should skip tests when API returns null response', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      };
      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const mockReport: CtrfReport = {
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
            start: Date.now(),
            stop: Date.now() + 1000,
          },
          tests: [
            createMockTest({
              name: 'Failed Test 1',
              status: 'failed',
              duration: 100,
            }),
          ],
        },
      };

      const args: Arguments = {
        _: [],
        model: 'test-model',
        temperature: 0.7,
      };

      // Act
      const result = await perplexityFailedTestSummary(mockReport, args);

      // Assert
      expect(result.results.tests[0].ai).toBeUndefined();
    });

    it('should use additional prompt and system prompt context when provided', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'AI analysis with additional context',
            },
          },
        ],
      };
      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const mockReport: CtrfReport = {
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
            start: Date.now(),
            stop: Date.now() + 1000,
          },
          tests: [
            createMockTest({
              name: 'Failed Test 1',
              status: 'failed',
              duration: 100,
            }),
          ],
        },
      };

      const args: Arguments = {
        _: [],
        model: 'test-model',
        temperature: 0.7,
        additionalPromptContext: 'Additional prompt context',
        additionalSystemPromptContext: 'Additional system prompt context',
        systemPrompt: 'Custom system prompt',
      };

      // Act
      await perplexityFailedTestSummary(mockReport, args);

      // Assert
      expect(mockChatCompletionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Additional Context:\nAdditional prompt context'),
            }),
            expect.objectContaining({
              content: expect.stringContaining('Additional system prompt context'),
            }),
          ]),
        })
      );
    });

    it('should call generateConsolidatedSummary when consolidate is true', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'AI analysis of the failed test',
            },
          },
        ],
      };
      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const mockReport: CtrfReport = {
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
            start: Date.now(),
            stop: Date.now() + 1000,
          },
          tests: [
            createMockTest({
              name: 'Failed Test 1',
              status: 'failed',
              duration: 100,
            }),
          ],
        },
      };

      const args: Arguments = {
        _: [],
        model: 'test-model',
        temperature: 0.7,
        consolidate: true,
      };

      // Act
      await perplexityFailedTestSummary(mockReport, args);

      // Assert
      expect(generateConsolidatedSummary).toHaveBeenCalledWith(mockReport, 'perplexity', args);
    });

    it('should call saveUpdatedReport when file is provided', async () => {
      // Arrange
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'AI analysis of the failed test',
            },
          },
        ],
      };
      mockChatCompletionsCreate.mockResolvedValue(mockResponse);

      const mockReport: CtrfReport = {
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
            start: Date.now(),
            stop: Date.now() + 1000,
          },
          tests: [
            createMockTest({
              name: 'Failed Test 1',
              status: 'failed',
              duration: 100,
            }),
          ],
        },
      };

      const args: Arguments = {
        _: [],
        model: 'test-model',
        temperature: 0.7,
      };

      const file = 'test-report.json';

      // Act
      await perplexityFailedTestSummary(mockReport, args, file);

      // Assert
      expect(saveUpdatedReport).toHaveBeenCalledWith(file, mockReport);
    });
  });
});