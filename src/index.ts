#!/usr/bin/env node
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { openAIFailedTestSummary } from './models/openai';
import { azureFailedTestSummary } from './models/azure-openai';
import { validateCtrfFile } from './common';
import { claudeFailedTestSummary } from './models/claude';

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
    .option('systemPrompt', {
        describe: 'System prompt to guide the AI',
        type: 'string',
        default: `You will receive a CTRF report test object containing an error message and a stack trace. Your task is to generate a clear and concise summary of the failure, specifically designed to assist a human in debugging the issue. The summary should:
                 - It is critical that you do not alter or interpret the error message or stack trace; instead, focus on analyzing the exact content provided.
                 - Identify the likely cause of the failure based on the provided information.
                 - Suggest specific steps for resolution directly related to the failure.
                 - Start the summary with "The test failed because"
                 - keep the tone conversational and natural.
                 Avoid:
                 - Including any code in your response.
                 - Adding generic conclusions or advice such as "By following these steps..."
                 - headings, bullet points, or special formatting.`,
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
    .help()
    .alias('help', 'h')
    .parseSync();

const file = argv.file || "ctrf/ctrf-report.json"

if (argv._.includes('openai') && argv.file) {
    try {
        const report = validateCtrfFile(argv.file);
        if (report !== null) {
            openAIFailedTestSummary(report, file, argv);
        }
    } catch (error) {
        console.error('Failed to read file:', error);
    }
} else if (argv._.includes('claude') && argv.file) {
    try {
        const report = validateCtrfFile(argv.file);
        if (report !== null) {
            claudeFailedTestSummary(report, file, argv);
        }
    } catch (error) {
        console.error('Failed to read file:', error);
    }
} else if (argv._.includes('azure-openai') && argv.file) {
    try {
        const report = validateCtrfFile(argv.file);
        if (report !== null) {
            azureFailedTestSummary(report, file, argv);
        }
    } catch (error) {
        console.error('Failed to read file:', error);
    }
}
