import { type Test } from '../types/ctrf'

export type AssessmentType = 'failed' | 'flaky'

export interface AssessmentConfig {
  type: AssessmentType
  label: string
  description: string
  systemPromptSuffix: string
}

export const ASSESSMENT_CONFIGS: Record<AssessmentType, AssessmentConfig> = {
  failed: {
    type: 'failed',
    label: 'Failed Tests',
    description: 'Analyzing failed tests',
    systemPromptSuffix: 'Focus on test failures and why they occurred.',
  },
  flaky: {
    type: 'flaky',
    label: 'Flaky Tests',
    description: 'Analyzing flaky tests',
    systemPromptSuffix:
      'Focus on identifying why these tests are flaky and suggest ways to make them more stable and reliable. Use the retries and attempts data to determine patterns and possible causes of flakiness. If insights data is available, use it to understand historical patterns.',
  },
}

/**
 * Filters tests based on the assessment type
 */
export function filterTestsByAssessment(
  tests: Test[],
  assessmentType: AssessmentType
): Test[] {
  switch (assessmentType) {
    case 'failed':
      return tests.filter((test) => test.status === 'failed')

    case 'flaky':
      return tests.filter((test) => test.flaky === true)

    default:
      // Default to failed for backward compatibility
      return tests.filter((test) => test.status === 'failed')
  }
}

/**
 * Gets the assessment configuration for a given type
 */
export function getAssessmentConfig(
  assessmentType: AssessmentType
): AssessmentConfig {
  return ASSESSMENT_CONFIGS[assessmentType] ?? ASSESSMENT_CONFIGS.failed
}

/**
 * Generates a dynamic system prompt suffix based on assessment type
 */
export function getAssessmentPromptContext(
  assessmentType: AssessmentType,
  testCount: number
): string {
  const config = getAssessmentConfig(assessmentType)

  switch (assessmentType) {
    case 'failed':
      return `You are analyzing ${testCount} failed test${testCount !== 1 ? 's' : ''}. ${config.systemPromptSuffix}`

    case 'flaky':
      return `You are analyzing ${testCount} flaky test${testCount !== 1 ? 's' : ''}. ${config.systemPromptSuffix}`

    default:
      return `You are analyzing ${testCount} test${testCount !== 1 ? 's' : ''}. ${config.systemPromptSuffix}`
  }
}

/**
 * Validates if an assessment type is valid
 */
export function isValidAssessmentType(type: string): type is AssessmentType {
  return type in ASSESSMENT_CONFIGS
}

/**
 * Gets the label for logging based on assessment type
 */
export function getAssessmentLabel(assessmentType: AssessmentType): string {
  return getAssessmentConfig(assessmentType).label
}
