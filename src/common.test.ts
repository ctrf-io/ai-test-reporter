import { validateCtrfFile, saveUpdatedReport, ansiRegex, stripAnsi, generateFailedTestPrompt } from './common'
import fs from 'fs'
import { CtrfReport } from '../types/ctrf'

// Mock the 'fs' module
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}))

describe('common.ts functions', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateCtrfFile', () => {
    it('should return CTRF data when file contains valid CTRF structure', () => {
      const validCtrfData = {
        results: {
          summary: { tests: 10, passed: 5, failed: 3, skipped: 1, pending: 1, other: 0, start: 100, stop: 200 },
          tests: [
            {
              name: 'Test 1',
              status: 'passed',
              duration: 100,
            },
          ],
          tool: { name: 'Jest' },
        },
      }
      mockedFs.readFileSync.mockReturnValueOnce(JSON.stringify(validCtrfData))

      const result = validateCtrfFile('test.json')

      expect(mockedFs.readFileSync).toHaveBeenCalledWith('test.json', 'utf8')
      expect(result).toEqual(validCtrfData)
    })

    it('should return null when file does not contain valid CTRF data (missing summary)', () => {
      const invalidCtrfData = {
        results: {
          tests: [
            {
              name: 'Test 1',
              status: 'passed',
              duration: 100,
            },
          ],
          tool: { name: 'Jest' },
        },
      }
      mockedFs.readFileSync.mockReturnValueOnce(JSON.stringify(invalidCtrfData))
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = validateCtrfFile('test.json')

      expect(mockedFs.readFileSync).toHaveBeenCalledWith('test.json', 'utf8')
      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalledWith('Warning: The file does not contain valid CTRF data.')

      warnSpy.mockRestore()
    })

    it('should return null when file does not contain valid CTRF data (missing tests)', () => {
      const invalidCtrfData = {
        results: {
          summary: { tests: 10, passed: 5, failed: 3, skipped: 1, pending: 1, other: 0, start: 100, stop: 200 },
          tool: { name: 'Jest' },
        },
      }
      mockedFs.readFileSync.mockReturnValueOnce(JSON.stringify(invalidCtrfData))
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const result = validateCtrfFile('test.json')

      expect(mockedFs.readFileSync).toHaveBeenCalledWith('test.json', 'utf8')
      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalledWith('Warning: The file does not contain valid CTRF data.')

      warnSpy.mockRestore()
    })

    it('should return null when file contains invalid JSON', () => {
      mockedFs.readFileSync.mockReturnValueOnce('invalid JSON')
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = validateCtrfFile('test.json')

      expect(mockedFs.readFileSync).toHaveBeenCalledWith('test.json', 'utf8')
      expect(result).toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('Failed to read or process the file:', expect.any(SyntaxError))

      errorSpy.mockRestore()
    })

    it('should return null when file reading fails', () => {
      mockedFs.readFileSync.mockImplementationOnce(() => {
        throw new Error('File not found')
      })
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      const result = validateCtrfFile('test.json')

      expect(mockedFs.readFileSync).toHaveBeenCalledWith('test.json', 'utf8')
      expect(result).toBeNull()
      expect(errorSpy).toHaveBeenCalledWith('Failed to read or process the file:', expect.any(Error))

      errorSpy.mockRestore()
    })
  })

  describe('saveUpdatedReport', () => {
    it('should save the report to the specified file', () => {
      const report: CtrfReport = {
        results: {
          summary: { tests: 10, passed: 5, failed: 3, skipped: 1, pending: 1, other: 0, start: 100, stop: 200 },
          tests: [
            {
              name: 'Test 1',
              status: 'passed',
              duration: 100,
            },
          ],
          tool: { name: 'Jest' },
        },
      }

      const logSpy = jest.spyOn(console, 'log').mockImplementation()

      saveUpdatedReport('output.json', report)

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        'output.json',
        JSON.stringify(report, null, 2),
        'utf8'
      )
      expect(logSpy).toHaveBeenCalledWith('Updated report saved to output.json')

      logSpy.mockRestore()
    })

    it('should handle errors during file writing', () => {
      const report: CtrfReport = {
        results: {
          summary: { tests: 10, passed: 5, failed: 3, skipped: 1, pending: 1, other: 0, start: 100, stop: 200 },
          tests: [
            {
              name: 'Test 1',
              status: 'passed',
              duration: 100,
            },
          ],
          tool: { name: 'Jest' },
        },
      }
      mockedFs.writeFileSync.mockImplementationOnce(() => {
        throw new Error('Permission denied')
      })
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()

      saveUpdatedReport('output.json', report)

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        'output.json',
        JSON.stringify(report, null, 2),
        'utf8'
      )
      expect(errorSpy).toHaveBeenCalledWith('Failed to save the updated report:', expect.any(Error))

      errorSpy.mockRestore()
    })
  })

  describe('ansiRegex', () => {
    it('should return a global regex pattern that matches ANSI escape codes by default', () => {
      const regex = ansiRegex()
      expect(regex).toBeInstanceOf(RegExp)
      expect(regex.flags).toContain('g')

      // Test with a string containing ANSI codes
      const textWithAnsi = '\u001B[31mRed text\u001B[0m'
      expect(regex.test(textWithAnsi)).toBe(true)
    })

    it('should return a regex pattern that matches only first ANSI escape code when onlyFirst is true', () => {
      const regex = ansiRegex({ onlyFirst: true })
      expect(regex).toBeInstanceOf(RegExp)
      expect(regex.flags).not.toContain('g')

      // Test with a string containing multiple ANSI codes
      const textWithAnsi = '\u001B[31mRed text\u001B[0m'
      expect(regex.test(textWithAnsi)).toBe(true)
    })
  })

  describe('stripAnsi', () => {
    it('should remove ANSI escape codes from a string', () => {
      const textWithAnsi = '\u001B[31mRed text\u001B[0m and \u001B[32mGreen text\u001B[0m'
      const expected = 'Red text and Green text'

      const result = stripAnsi(textWithAnsi)

      expect(result).toBe(expected)
    })

    it('should throw TypeError when input is not a string', () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        stripAnsi(123)
      }).toThrow(TypeError)

      expect(() => {
        // @ts-expect-error - Testing invalid input
        stripAnsi(null)
      }).toThrow(TypeError)

      expect(() => {
        // @ts-expect-error - Testing invalid input
        stripAnsi(undefined)
      }).toThrow(TypeError)

      expect(() => {
        // @ts-expect-error - Testing invalid input
        stripAnsi({})
      }).toThrow(TypeError)
    })

    it('should return unchanged string if no ANSI codes are present', () => {
      const textWithoutAnsi = 'Plain text without ANSI codes'
      const result = stripAnsi(textWithoutAnsi)

      expect(result).toBe(textWithoutAnsi)
    })
  })

  describe('generateFailedTestPrompt', () => {
    it('should generate a proper failure analysis prompt', () => {
      const test = {
        name: 'Sample Test',
        status: 'failed' as const,
        duration: 100,
        message: 'Test failed due to timeout',
      }
      const report: CtrfReport = {
        results: {
          summary: { tests: 10, passed: 5, failed: 5, skipped: 0, pending: 0, other: 0, start: 100, stop: 200 },
          tests: [test],
          tool: { name: 'Jest' },
        },
      }

      const expectedPrompt = `Analyze this test failure:

Test Name: Sample Test
Test Tool: Jest


Failure Details:
{
  "name": "Sample Test",
  "status": "failed",
  "duration": 100,
  "message": "Test failed due to timeout"
}

What I need:
1. What specifically failed in this test
2. The likely root cause based on the error messages and context
3. The potential impact of this failure on the system`

      const result = generateFailedTestPrompt(test, report)

      expect(result).toBe(expectedPrompt)
    })

    it('should include environment information when available', () => {
      const test = {
        name: 'Sample Test',
        status: 'failed' as const,
        duration: 100,
        message: 'Test failed due to timeout',
      }
      const report: CtrfReport = {
        results: {
          summary: { tests: 10, passed: 5, failed: 5, skipped: 0, pending: 0, other: 0, start: 100, stop: 200 },
          tests: [test],
          tool: { name: 'Jest' },
          environment: { osPlatform: 'Linux', osVersion: '1.0.0' },
        },
      }

      const expectedPrompt = `Analyze this test failure:

Test Name: Sample Test
Test Tool: Jest
Environment: {"osPlatform":"Linux","osVersion":"1.0.0"}

Failure Details:
{
  "name": "Sample Test",
  "status": "failed",
  "duration": 100,
  "message": "Test failed due to timeout"
}

What I need:
1. What specifically failed in this test
2. The likely root cause based on the error messages and context
3. The potential impact of this failure on the system`

      const result = generateFailedTestPrompt(test, report)

      expect(result).toBe(expectedPrompt)
    })
  })
})