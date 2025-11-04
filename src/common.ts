import { type Report, type Test } from '../types/ctrf'
import fs from 'fs'
import { type AssessmentType, getAssessmentConfig } from './assess'

export function validateCtrfFile(filePath: string): Report | null {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const jsonData: Report = JSON.parse(fileContent)

    if (jsonData.results?.summary == null || jsonData.results.tests == null) {
      console.warn('Warning: The file does not contain valid CTRF data.')
      return null
    }
    return jsonData
  } catch (error) {
    console.error('Failed to read or process the file:', error)
    return null
  }
}

export function saveUpdatedReport(filePath: string, report: Report): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8')
    console.log(`Updated report saved to ${filePath}`)
  } catch (error) {
    console.error('Failed to save the updated report:', error)
  }
}

export function ansiRegex({ onlyFirst = false } = {}): RegExp {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
  ].join('|')

  return new RegExp(pattern, onlyFirst ? undefined : 'g')
}

export function stripAnsi(message: string): string {
  if (typeof message !== 'string') {
    throw new TypeError(`Expected a \`string\`, got \`${typeof message}\``)
  }

  return message.replace(ansiRegex(), '')
}

export function generateFailedTestPrompt(test: Test, report: Report): string {
  return `Analyze this test failure:

Test Name: ${test.name}
Test Tool: ${report.results.tool.name}
${report.results.environment != null ? `Environment: ${JSON.stringify(report.results.environment)}` : ''}

Failure Details:
${JSON.stringify(test, null, 2)}

What I need:
1. What specifically failed in this test
2. The likely root cause based on the error messages and context
3. The potential impact of this failure on the system`
}

/**
 * Generates assessment-specific prompt context for test analysis
 */
export function generateAssessmentPromptContext(
  test: Test,
  report: Report,
  assessmentType: AssessmentType
): string {
  const assessmentConfig = getAssessmentConfig(assessmentType)

  const assessmentContext =
    assessmentType === 'failed'
      ? 'Please provide a human-readable failure summary that explains why you think the test might have failed and ways to fix'
      : assessmentType === 'flaky'
        ? 'Please analyze why this test is flaky and suggest ways to make it more stable and reliable. Pay special attention to the retries and retryAttempts properties to identify patterns in the flakiness'
        : `Please provide an analysis of this test (${assessmentConfig.label})`

  // Add note about insights data if available
  const insightsNote =
    test.insights != null
      ? '. Note: This test has insights data with historical metrics that may help identify patterns'
      : ''

  return `Report:\n${JSON.stringify(test, null, 2)}.\n\nTool:${report.results.tool.name}.\n\n${assessmentContext}${insightsNote}`
}

/**
 * Gets the appropriate icon for the assessment type
 */
export function getAssessmentIcon(assessmentType: AssessmentType): string {
  switch (assessmentType) {
    case 'failed':
      return '❌'
    case 'flaky':
      return '🍂'
    default:
      return '📋'
  }
}
