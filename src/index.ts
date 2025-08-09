#!/usr/bin/env node

// External dependencies
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'

// Internal utilities
import { validateCtrfFile } from './common'
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from './constants'

import type { CtrfReport } from '../types/ctrf'
import { azureOpenAIFailedTestSummary } from './models/azure-openai'
import { bedrockFailedTestSummary } from './models/bedrock'
import { claudeFailedTestSummary } from './models/claude'
import { deepseekFailedTestSummary } from './models/deepseek'
import { geminiFailedTestSummary } from './models/gemini'
import { grokFailedTestSummary } from './models/grok'
import { mistralFailedTestSummary } from './models/mistral'
import { ollamaFailedTestSummary } from './models/ollama'
import { openAIFailedTestSummary } from './models/openai'
import { openRouterFailedTestSummary } from './models/openrouter'
import { perplexityFailedTestSummary } from './models/perplexity'

export interface Arguments {
  _: Array<string | number>
  file?: string
  model?: string
  systemPrompt?: string
  frequencyPenalty?: number
  maxTokens?: number
  presencePenalty?: number
  temperature?: number
  topP?: number
  log?: boolean
  maxMessages?: number
  consolidate?: boolean
  deploymentId?: string
}

const argv: Arguments = yargs(hideBin(process.argv))
  .command(
    'openai <file>',
    'Generate test summary from a CTRF report',
    (yargs) => {
      return yargs
        .positional('file', {
          describe: 'Path to the CTRF file',
          type: 'string',
        })
        .option('model', {
          describe: 'OpenAI model to use',
          type: 'string',
          default: 'gpt-4o',
        })
    }
  )
  .command(
    'claude <file>',
    'Generate test summary from a CTRF report',
    (yargs) => {
      return yargs
        .positional('file', {
          describe: 'Path to the CTRF file',
          type: 'string',
        })
        .option('model', {
          describe: 'Claude model to use',
          type: 'string',
          default: 'claude-3-5-sonnet-20240620',
        })
    }
  )
  .command(
    'ollama <file>',
    'Generate test summary from a CTRF report using Ollama',
    (yargs) => {
      return yargs
        .positional('file', {
          describe: 'Path to the CTRF file',
          type: 'string',
        })
        .option('model', {
          describe: 'Ollama model to use',
          type: 'string',
          default: 'llama2',
        })
    }
  )
  .command(
    'azure-openai <file>',
    'Generate test summary from a CTRF report using Azure OpenAI',
    (yargs) => {
      return yargs
        .positional('file', {
          describe: 'Path to the CTRF file',
          type: 'string',
        })
        .option('deploymentId', {
          describe: 'Deployment ID for Azure OpenAI',
          type: 'string',
        })
        .option('model', {
          describe: 'Model to use',
          type: 'string',
          default: 'gpt-4o',
        })
    }
  )
  .command(
    'grok <file>',
    'Generate test summary from a CTRF report using Grok',
    (yargs) => {
      return yargs
        .positional('file', {
          describe: 'Path to the CTRF file',
          type: 'string',
        })
        .option('model', {
          describe: 'Grok model to use',
          type: 'string',
          default: 'grok-2-latest',
        })
    }
  )
  .command(
    'deepseek <file>',
    'Generate test summary from a CTRF report using DeepSeek',
    (yargs) => {
      return yargs
        .positional('file', {
          describe: 'Path to the CTRF file',
          type: 'string',
        })
        .option('model', {
          describe: 'DeepSeek model to use',
          type: 'string',
          default: 'deepseek-reasoner',
        })
    }
  )
  .command(
    'mistral <file>',
    'Generate test summary from a CTRF report using Mistral',
    (yargs) => {
      return yargs
        .positional('file', {
          describe: 'Path to the CTRF file',
          type: 'string',
        })
        .option('model', {
          describe: 'Mistral model to use',
          type: 'string',
          default: 'mistral-medium',
        })
    }
  )
  .command(
    'gemini <file>',
    'Generate test summary from a CTRF report using Google Gemini',
    (yargs) => {
      return yargs
        .positional('file', {
          describe: 'Path to the CTRF file',
          type: 'string',
        })
        .option('model', {
          describe: 'Gemini model to use',
          type: 'string',
          default: 'gemini-pro',
        })
    }
  )
  .command(
    'perplexity <file>',
    'Generate test summary from a CTRF report using Perplexity',
    (yargs) => {
      return yargs
        .positional('file', {
          describe: 'Path to the CTRF file',
          type: 'string',
        })
        .option('model', {
          describe: 'Perplexity model to use',
          type: 'string',
          default: 'pplx-7b-online',
        })
    }
  )
  .command(
    'openrouter <file>',
    'Generate test summary from a CTRF report using OpenRouter',
    (yargs) => {
      return yargs
        .positional('file', {
          describe: 'Path to the CTRF file',
          type: 'string',
        })
        .option('model', {
          describe: 'OpenRouter model to use',
          type: 'string',
          default: 'anthropic/claude-3-opus',
        })
    }
  )
  .command(
    'bedrock <file>',
    'Generate test summary from a CTRF report using Amazon Bedrock Claude',
    (yargs) => {
      return yargs
        .positional('file', {
          describe: 'Path to the CTRF file',
          type: 'string',
        })
        .option('model', {
          describe: 'Bedrock model to use',
          type: 'string',
          default: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        })
    }
  )
  .option('systemPrompt', {
    describe: 'System prompt to guide the AI',
    type: 'string',
    default: FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT,
  })
  .option('frequencyPenalty', {
    describe: 'Frequency penalty parameter for the model',
    type: 'number',
    default: 0,
  })
  .option('maxTokens', {
    describe: 'Maximum number of tokens to generate',
    type: 'number',
  })
  .option('presencePenalty', {
    describe: 'Presence penalty parameter for the model',
    type: 'number',
    default: 0,
  })
  .option('temperature', {
    describe: 'Sampling temperature',
    type: 'number',
    conflicts: 'topP',
  })
  .option('topP', {
    describe: 'Top-p sampling parameter',
    type: 'number',
    conflicts: 'temperature',
  })
  .option('log', {
    describe: 'Log the AI responses to the console',
    type: 'boolean',
    default: true,
  })
  .option('maxMessages', {
    describe:
      'Limit the number of failing tests to send for summarization in the LLM request. This helps avoid overwhelming the model when dealing with reports that have many failing tests.',
    type: 'number',
    default: 10,
  })
  .option('consolidate', {
    describe:
      'Consolidate and summarize multiple AI summaries into a higher-level overview',
    type: 'boolean',
    default: true,
  })
  .help()
  .alias('help', 'h')
  .parseSync()

const file = argv.file ?? 'ctrf/ctrf-report.json'

// Command handlers
const executeCommand = async (
  command: string,
  modelFunction: (
    report: CtrfReport,
    argv: Arguments,
    file?: string,
    log?: boolean
  ) => Promise<CtrfReport>
): Promise<void> => {
  if (argv._.includes(command) && argv.file != null) {
    try {
      const report = validateCtrfFile(argv.file)
      if (report !== null) {
        await modelFunction(report, argv, file, true)
      }
    } catch (error) {
      console.error('Failed to read file:', error)
    }
  }
}

// Execute commands
void Promise.resolve().then(async () => {
  await executeCommand('openai', openAIFailedTestSummary)
  await executeCommand('claude', claudeFailedTestSummary)
  await executeCommand('azure-openai', azureOpenAIFailedTestSummary)
  await executeCommand('grok', grokFailedTestSummary)
  await executeCommand('deepseek', deepseekFailedTestSummary)
  await executeCommand('mistral', mistralFailedTestSummary)
  await executeCommand('gemini', geminiFailedTestSummary)
  await executeCommand('perplexity', perplexityFailedTestSummary)
  await executeCommand('openrouter', openRouterFailedTestSummary)
  await executeCommand('bedrock', bedrockFailedTestSummary)
  await executeCommand('ollama', ollamaFailedTestSummary)
})

export {
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
}
