#!/usr/bin/env node
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { openAIFailedTestSummary } from './models/openai';
import { azureFailedTestSummary } from './models/azure-openai';
import { validateCtrfFile } from './common';
import { claudeFailedTestSummary } from './models/claude';
import { grokFailedTestSummary } from './models/grok';
import { deepseekFailedTestSummary } from './models/deepseek';
import { mistralFailedTestSummary } from './models/mistral';
import { geminiFailedTestSummary } from './models/gemini';
import { perplexityFailedTestSummary } from './models/perplexity';
import { openRouterFailedTestSummary } from './models/openrouter';
import { FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT } from './constants';

export interface Arguments {
    _: Array<string | number>;
    file?: string;
    model?: string;
    systemPrompt?: string;
    frequencyPenalty?: number;
    maxTokens?: number;
    presencePenalty?: number;
    temperature?: number;
    topP?: number;
    log?: boolean;
    maxMessages?: number
    consolidate?: boolean
    deploymentId?: string;
}

const argv: Arguments = yargs(hideBin(process.argv))
    .command(
        'openai <file>',
        'Generate test summary from a CTRF report',
        (yargs) => {
            return yargs.positional('file', {
                describe: 'Path to the CTRF file',
                type: 'string',
            }) 
            .option('model', {
                describe: 'OpenAI model to use',
                type: 'string',
                default: 'gpt-4o', 
            });
        }
    )
    .command(
        'claude <file>',
        'Generate test summary from a CTRF report',
        (yargs) => {
            return yargs.positional('file', {
                describe: 'Path to the CTRF file',
                type: 'string',
            })
            .option('model', {
                describe: 'Claude model to use',
                type: 'string',
                default: 'claude-3-5-sonnet-20240620', 
            });
        }
    )
    .command(
        'azure-openai <file>',
        'Generate test summary from a CTRF report using Azure OpenAI',
        (yargs) => {
            return yargs.positional('file', {
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
                });
        }
    )
    .command(
        'grok <file>',
        'Generate test summary from a CTRF report using Grok',
        (yargs) => {
            return yargs.positional('file', {
                describe: 'Path to the CTRF file',
                type: 'string',
            })
            .option('model', {
                describe: 'Grok model to use',
                type: 'string',
                default: 'grok-2-latest',
            });
        }
    )
    .command(
        'deepseek <file>',
        'Generate test summary from a CTRF report using DeepSeek',
        (yargs) => {
            return yargs.positional('file', {
                describe: 'Path to the CTRF file',
                type: 'string',
            })
            .option('model', {
                describe: 'DeepSeek model to use',
                type: 'string',
                default: 'deepseek-reasoner',
            });
        }
    )
    .command(
        'mistral <file>',
        'Generate test summary from a CTRF report using Mistral',
        (yargs) => {
            return yargs.positional('file', {
                describe: 'Path to the CTRF file',
                type: 'string',
            })
            .option('model', {
                describe: 'Mistral model to use',
                type: 'string',
                default: 'mistral-medium',
            });
        }
    )
    .command(
        'gemini <file>',
        'Generate test summary from a CTRF report using Google Gemini',
        (yargs) => {
            return yargs.positional('file', {
                describe: 'Path to the CTRF file',
                type: 'string',
            })
            .option('model', {
                describe: 'Gemini model to use',
                type: 'string',
                default: 'gemini-pro',
            });
        }
    )
    .command(
        'perplexity <file>',
        'Generate test summary from a CTRF report using Perplexity',
        (yargs) => {
            return yargs.positional('file', {
                describe: 'Path to the CTRF file',
                type: 'string',
            })
            .option('model', {
                describe: 'Perplexity model to use',
                type: 'string',
                default: 'pplx-7b-online',
            });
        }
    )
    .command(
        'openrouter <file>',
        'Generate test summary from a CTRF report using OpenRouter',
        (yargs) => {
            return yargs.positional('file', {
                describe: 'Path to the CTRF file',
                type: 'string',
            })
            .option('model', {
                describe: 'OpenRouter model to use',
                type: 'string',
                default: 'anthropic/claude-3-opus',
            });
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
        describe: 'Limit the number of failing tests to send for summarization in the LLM request. This helps avoid overwhelming the model when dealing with reports that have many failing tests.',
        type: 'number',
        default: 10,
    })
    .option('consolidate', {
        describe: 'Consolidate and summarize multiple AI summaries into a higher-level overview',
        type: 'boolean',
        default: true,
    })
    .help()
    .alias('help', 'h')
    .parseSync();

const file = argv.file || "ctrf/ctrf-report.json"

if (argv._.includes('openai') && argv.file) {
    try {
        const report = validateCtrfFile(argv.file);
        if (report !== null) {
            openAIFailedTestSummary(report, argv, file, true);
        }
    } catch (error) {
        console.error('Failed to read file:', error);
    }
} else if (argv._.includes('claude') && argv.file) {
    try {
        const report = validateCtrfFile(argv.file);
        if (report !== null) {
            claudeFailedTestSummary(report, argv, file, true);
        }
    } catch (error) {
        console.error('Failed to read file:', error);
    }
} else if (argv._.includes('azure-openai') && argv.file) {
    try {
        const report = validateCtrfFile(argv.file);
        if (report !== null) {
            azureFailedTestSummary(report, argv, file, true);
        }
    } catch (error) {
        console.error('Failed to read file:', error);
    }
} else if (argv._.includes('grok') && argv.file) {
    try {
        const report = validateCtrfFile(argv.file);
        if (report !== null) {
            grokFailedTestSummary(report, argv, file, true);
        }
    } catch (error) {
        console.error('Failed to read file:', error);
    }
} else if (argv._.includes('deepseek') && argv.file) {
    try {
        const report = validateCtrfFile(argv.file);
        if (report !== null) {
            deepseekFailedTestSummary(report, argv, file, true);
        }
    } catch (error) {
        console.error('Failed to read file:', error);
    }
} else if (argv._.includes('mistral') && argv.file) {
    try {
        const report = validateCtrfFile(argv.file);
        if (report !== null) {
            mistralFailedTestSummary(report, argv, file, true);
        }
    } catch (error) {
        console.error('Failed to read file:', error);
    }
} else if (argv._.includes('gemini') && argv.file) {
    try {
        const report = validateCtrfFile(argv.file);
        if (report !== null) {
            geminiFailedTestSummary(report, argv, file, true);
        }
    } catch (error) {
        console.error('Failed to read file:', error);
    }
} else if (argv._.includes('perplexity') && argv.file) {
    try {
        const report = validateCtrfFile(argv.file);
        if (report !== null) {
            perplexityFailedTestSummary(report, argv, file, true);
        }
    } catch (error) {
        console.error('Failed to read file:', error);
    }
} else if (argv._.includes('openrouter') && argv.file) {
    try {
        const report = validateCtrfFile(argv.file);
        if (report !== null) {
            openRouterFailedTestSummary(report, argv, file, true);
        }
    } catch (error) {
        console.error('Failed to read file:', error);
    }
} 

export { openAIFailedTestSummary, claudeFailedTestSummary, azureFailedTestSummary, grokFailedTestSummary, deepseekFailedTestSummary, mistralFailedTestSummary, geminiFailedTestSummary, perplexityFailedTestSummary, openRouterFailedTestSummary };
