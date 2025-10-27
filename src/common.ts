import { type CtrfReport } from '../types/ctrf'
import fs from 'fs'

export function validateCtrfFile(filePath: string): CtrfReport | null {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const jsonData: CtrfReport = JSON.parse(fileContent)

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

export function saveUpdatedReport(filePath: string, report: CtrfReport): void {
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

export function generateFailedTestPrompt(
  test: any,
  report: CtrfReport
): string {
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
