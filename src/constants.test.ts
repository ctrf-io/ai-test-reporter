import {
  CONSOLIDATED_SUMMARY_SYSTEM_PROMPT,
  FAILED_TEST_SUMMARY_SYSTEM_PROMPT,
  FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT
} from './constants';

describe('Constants', () => {
  describe('CONSOLIDATED_SUMMARY_SYSTEM_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(CONSOLIDATED_SUMMARY_SYSTEM_PROMPT).toBeDefined();
      expect(typeof CONSOLIDATED_SUMMARY_SYSTEM_PROMPT).toBe('string');
      expect(CONSOLIDATED_SUMMARY_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('should contain the expected content about analyzing test failures', () => {
      expect(CONSOLIDATED_SUMMARY_SYSTEM_PROMPT).toContain('analyzing multiple test failures');
      expect(CONSOLIDATED_SUMMARY_SYSTEM_PROMPT).toContain('concise, high-level synthesis');
    });

    it('should include guidelines about what to avoid', () => {
      expect(CONSOLIDATED_SUMMARY_SYSTEM_PROMPT).toContain('Avoid:');
      expect(CONSOLIDATED_SUMMARY_SYSTEM_PROMPT).toContain('Including code snippets');
      expect(CONSOLIDATED_SUMMARY_SYSTEM_PROMPT).toContain('Generic testing advice');
    });
  });

  describe('FAILED_TEST_SUMMARY_SYSTEM_PROMPT', () => {
    it('should be a non-empty string', () => {
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT).toBeDefined();
      expect(typeof FAILED_TEST_SUMMARY_SYSTEM_PROMPT).toBe('string');
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });

    it('should contain the expected content about analyzing test failures', () => {
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT).toContain('analyzing a specific test failure');
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT).toContain('clear, actionable summary');
    });

    it('should start with the expected instruction', () => {
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT).toContain('Start your response with "The test failed because"');
    });

    it('should include guidelines about what to avoid', () => {
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT).toContain('Avoid:');
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT).toContain('Including code snippets');
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT).toContain('Adding generic conclusions');
    });
  });

  describe('FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT', () => {
    it('should be a non-empty string', () => {
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT).toBeDefined();
      expect(typeof FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT).toBe('string');
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT.length).toBeGreaterThan(0);
    });

    it('should contain the expected content about CTRF report test object', () => {
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT).toContain('CTRF report test object');
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT).toContain('generate a clear and concise summary');
    });

    it('should include the instruction to start with "The test failed because"', () => {
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT).toContain('Start the summary with "The test failed because"');
    });

    it('should include guidelines about what to avoid', () => {
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT).toContain('Avoid:');
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT).toContain('Including any code in your response');
      expect(FAILED_TEST_SUMMARY_SYSTEM_PROMPT_CURRENT).toContain('headings, bullet points, or special formatting');
    });
  });
});