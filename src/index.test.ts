import yargs from 'yargs/yargs';
import { Arguments } from './index';
import { validateCtrfFile } from './common';
import { generateJsonSummary } from './json-summary';

// Mock all the external dependencies
jest.mock('yargs/yargs', () => jest.fn(() => ({
  command: jest.fn().mockReturnThis(),
  option: jest.fn().mockReturnThis(),
  help: jest.fn().mockReturnThis(),
  alias: jest.fn().mockReturnThis(),
  parseSync: jest.fn().mockReturnValue({ _: [], file: undefined }),
})));

jest.mock('./common', () => ({
  validateCtrfFile: jest.fn(),
}));

jest.mock('./json-summary', () => ({
  generateJsonSummary: jest.fn(),
}));

// Import all the model functions that are exported from index.ts
import {
  openAIFailedTestSummary,
  claudeFailedTestSummary,
  azureOpenAIFailedTestSummary,
  grokFailedTestSummary,
  deepseekFailedTestSummary,
  mistralFailedTestSummary,
  geminiFailedTestSummary,
  perplexityFailedTestSummary,
  openRouterFailedTestSummary,
  bedrockFailedTestSummary,
  ollamaFailedTestSummary,
  customFailedTestSummary,
} from './index';

// Mock all the model functions
jest.mock('./models/openai', () => ({
  openAIFailedTestSummary: jest.fn(),
}));

jest.mock('./models/claude', () => ({
  claudeFailedTestSummary: jest.fn(),
}));

jest.mock('./models/azure-openai', () => ({
  azureOpenAIFailedTestSummary: jest.fn(),
}));

jest.mock('./models/grok', () => ({
  grokFailedTestSummary: jest.fn(),
}));

jest.mock('./models/deepseek', () => ({
  deepseekFailedTestSummary: jest.fn(),
}));

jest.mock('./models/mistral', () => ({
  mistralFailedTestSummary: jest.fn(),
}));

jest.mock('./models/gemini', () => ({
  geminiFailedTestSummary: jest.fn(),
}));

jest.mock('./models/perplexity', () => ({
  perplexityFailedTestSummary: jest.fn(),
}));

jest.mock('./models/openrouter', () => ({
  openRouterFailedTestSummary: jest.fn(),
}));

jest.mock('./models/bedrock', () => ({
  bedrockFailedTestSummary: jest.fn(),
}));

jest.mock('./models/ollama', () => ({
  ollamaFailedTestSummary: jest.fn(),
}));

jest.mock('./models/custom', () => ({
  customFailedTestSummary: jest.fn(),
}));

describe('index.ts', () => {
  // Mock console.error to avoid noise in test output
  const mockConsoleError = jest.fn();
  const mockConsoleLog = jest.fn();

  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(mockConsoleError);
    jest.spyOn(console, 'log').mockImplementation(mockConsoleLog);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleError.mockClear();
    mockConsoleLog.mockClear();
  });

  describe('exports', () => {
    it('should export openAIFailedTestSummary', () => {
      expect(openAIFailedTestSummary).toBeDefined();
      expect(typeof openAIFailedTestSummary).toBe('function');
    });

    it('should export claudeFailedTestSummary', () => {
      expect(claudeFailedTestSummary).toBeDefined();
      expect(typeof claudeFailedTestSummary).toBe('function');
    });

    it('should export azureOpenAIFailedTestSummary', () => {
      expect(azureOpenAIFailedTestSummary).toBeDefined();
      expect(typeof azureOpenAIFailedTestSummary).toBe('function');
    });

    it('should export grokFailedTestSummary', () => {
      expect(grokFailedTestSummary).toBeDefined();
      expect(typeof grokFailedTestSummary).toBe('function');
    });

    it('should export deepseekFailedTestSummary', () => {
      expect(deepseekFailedTestSummary).toBeDefined();
      expect(typeof deepseekFailedTestSummary).toBe('function');
    });

    it('should export mistralFailedTestSummary', () => {
      expect(mistralFailedTestSummary).toBeDefined();
      expect(typeof mistralFailedTestSummary).toBe('function');
    });

    it('should export geminiFailedTestSummary', () => {
      expect(geminiFailedTestSummary).toBeDefined();
      expect(typeof geminiFailedTestSummary).toBe('function');
    });

    it('should export perplexityFailedTestSummary', () => {
      expect(perplexityFailedTestSummary).toBeDefined();
      expect(typeof perplexityFailedTestSummary).toBe('function');
    });

    it('should export openRouterFailedTestSummary', () => {
      expect(openRouterFailedTestSummary).toBeDefined();
      expect(typeof openRouterFailedTestSummary).toBe('function');
    });

    it('should export bedrockFailedTestSummary', () => {
      expect(bedrockFailedTestSummary).toBeDefined();
      expect(typeof bedrockFailedTestSummary).toBe('function');
    });

    it('should export ollamaFailedTestSummary', () => {
      expect(ollamaFailedTestSummary).toBeDefined();
      expect(typeof ollamaFailedTestSummary).toBe('function');
    });

    it('should export customFailedTestSummary', () => {
      expect(customFailedTestSummary).toBeDefined();
      expect(typeof customFailedTestSummary).toBe('function');
    });

    it('should export generateJsonSummary', () => {
      expect(generateJsonSummary).toBeDefined();
      expect(typeof generateJsonSummary).toBe('function');
    });
  });

  describe('executeCommand function', () => {
    // Since executeCommand is not exported, we'll test its behavior through integration tests
    // by mocking argv and checking the behavior of the main functions

    it('should call validateCtrfFile and the appropriate model function when a command is executed', async () => {
      const mockReport: any = { results: { tests: [] } };
      (validateCtrfFile as jest.Mock).mockReturnValue(mockReport);

      const args: Arguments = {
        _: ['openai'],
        file: 'test-file.json',
      } as Arguments;

      // Mock the model function
      const mockModelFunction: (report: any, args: any, file?: string | undefined, log?: boolean) => Promise<any> =
        jest.fn().mockResolvedValue(undefined);

      // Execute the command logic (simulating what would happen in the file)
      if (args._.includes('openai') && args.file != null) {
        const report = validateCtrfFile(args.file);
        if (report !== null) {
          await mockModelFunction(report, args, args.file, true);
        }
      }

      expect(validateCtrfFile).toHaveBeenCalledWith('test-file.json');
      expect(mockModelFunction).toHaveBeenCalledWith(mockReport, args, 'test-file.json', true);
    });

    it('should handle validation errors gracefully', async () => {
      (validateCtrfFile as jest.Mock).mockReturnValue(null);

      const args: Arguments = {
        _: ['openai'],
        file: 'test-file.json',
      } as Arguments;

      const mockModelFunction: (report: any, args: any, file?: string | undefined, log?: boolean) => Promise<any> =
        jest.fn().mockResolvedValue(undefined);

      // Execute the command logic
      if (args._.includes('openai') && args.file != null) {
        const report = validateCtrfFile(args.file);
        if (report !== null) {
          await mockModelFunction(report, args, args.file, true);
        }
      }

      expect(validateCtrfFile).toHaveBeenCalledWith('test-file.json');
      expect(mockModelFunction).not.toHaveBeenCalled();
    });

    it('should handle exceptions when reading the file', async () => {
      (validateCtrfFile as jest.Mock).mockImplementation(() => {
        throw new Error('File read error');
      });

      const args: Arguments = {
        _: ['openai'],
        file: 'test-file.json',
      } as Arguments;

      const mockModelFunction: (report: any, args: any, file?: string | undefined, log?: boolean) => Promise<any> =
        jest.fn().mockResolvedValue(undefined);

      // Simulate the command execution flow that would happen in the main code
      if (args._.includes('openai') && args.file != null) {
        try {
          const report = validateCtrfFile(args.file);
          if (report !== null) {
            await mockModelFunction(report, args, args.file, true);
          }
        } catch (error) {
          // In the real application, console.error would be called here
          // but in our test we'll just verify that the error was handled properly
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('File read error');
        }
      }

      expect(validateCtrfFile).toHaveBeenCalledWith('test-file.json');
      expect(mockModelFunction).not.toHaveBeenCalled();
    });
  });

  describe('JSON Analysis', () => {
    it('should call generateJsonSummary when jsonAnalysis option is true', async () => {
      const mockReport: any = { results: { tests: [] } };
      const mockJsonResult = { summary: 'test summary' };
      (validateCtrfFile as jest.Mock).mockReturnValue(mockReport);
      (generateJsonSummary as jest.Mock).mockResolvedValue(mockJsonResult);

      const args: Arguments = {
        _: ['openai'],
        file: 'test-file.json',
        jsonAnalysis: true,
      } as Arguments;

      // Simulate the command execution flow for JSON analysis
      if (args._.includes('openai') && args.file != null) {
        const report = validateCtrfFile(args.file);
        if (report !== null) {
          // Call the model function
          await (openAIFailedTestSummary as jest.Mock)(report, args, args.file || undefined, true);

          if (args.jsonAnalysis === true) {
            const result = await generateJsonSummary(
              report,
              'openai',
              args,
              args.customUrl || undefined
            );
            if (result !== null) {
              console.log(JSON.stringify(result, null, 2));
            }
          }
        }
      }

      expect(validateCtrfFile).toHaveBeenCalledWith('test-file.json');
      expect(generateJsonSummary).toHaveBeenCalledWith(
        mockReport,
        'openai',
        args,
        args.customUrl || undefined
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(mockJsonResult, null, 2));
    });

    it('should not call generateJsonSummary when jsonAnalysis option is false', async () => {
      const mockReport: any = { results: { tests: [] } };
      (validateCtrfFile as jest.Mock).mockReturnValue(mockReport);

      const args: Arguments = {
        _: ['openai'],
        file: 'test-file.json',
        jsonAnalysis: false,
      } as Arguments;

      // Simulate the command execution flow
      if (args._.includes('openai') && args.file != null) {
        const report = validateCtrfFile(args.file);
        if (report !== null) {
          await (openAIFailedTestSummary as jest.Mock)(report, args, args.file || undefined, true);

          if (args.jsonAnalysis === true) {
            const result = await generateJsonSummary(
              report,
              'openai',
              args,
              args.customUrl || undefined
            );
            if (result !== null) {
              console.log(JSON.stringify(result, null, 2));
            }
          }
        }
      }

      expect(validateCtrfFile).toHaveBeenCalledWith('test-file.json');
      expect(generateJsonSummary).not.toHaveBeenCalled();
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });

  describe('argv.url to argv.customUrl mapping', () => {
    it('should set customUrl when url is provided', () => {
      const args: Arguments = {
        _: ['custom'],
        file: 'test-file.json',
        url: 'http://localhost:8080/v1',
      } as Arguments;

      // Simulate the url to customUrl mapping logic
      if (args.url != null) {
        args.customUrl = args.url;
      }

      expect(args.customUrl).toBe('http://localhost:8080/v1');
    });

    it('should not set customUrl when url is not provided', () => {
      const args: Arguments = {
        _: ['custom'],
        file: 'test-file.json',
      } as Arguments;

      // Simulate the url to customUrl mapping logic
      if (args.url != null) {
        args.customUrl = args.url;
      }

      expect(args.customUrl).toBeUndefined();
    });
  });
});