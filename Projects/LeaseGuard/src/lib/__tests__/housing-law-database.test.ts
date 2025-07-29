import { 
  housingLawDatabase, 
  getAllViolationPatterns, 
  getViolationPatternsBySeverity, 
  findViolationPatternById,
  ViolationPattern 
} from '../housing-law-database';

describe('Housing Law Database', () => {
  describe('Database Structure', () => {
    it('should have proper database metadata', () => {
      expect(housingLawDatabase.database_info).toBeDefined();
      expect(housingLawDatabase.database_info.title).toBe('NYC Housing Law Violations Database');
      expect(housingLawDatabase.database_info.version).toBe('1.0');
      expect(housingLawDatabase.database_info.last_updated).toBe('2025-01-27');
      expect(housingLawDatabase.database_info.description).toContain('20 common illegal lease clause patterns');
      expect(housingLawDatabase.database_info.legal_disclaimer).toContain('informational purposes');
    });

    it('should have violations organized by severity', () => {
      expect(housingLawDatabase.violations.critical_violations).toBeDefined();
      expect(housingLawDatabase.violations.high_severity_violations).toBeDefined();
      expect(housingLawDatabase.violations.medium_low_violations).toBeDefined();
    });

    it('should have exactly 20 violation patterns total', () => {
      const totalPatterns = 
        housingLawDatabase.violations.critical_violations.length +
        housingLawDatabase.violations.high_severity_violations.length +
        housingLawDatabase.violations.medium_low_violations.length;
      
      expect(totalPatterns).toBe(20);
    });
  });

  describe('Critical Violations', () => {
    it('should have 5 critical violations', () => {
      expect(housingLawDatabase.violations.critical_violations).toHaveLength(5);
    });

    it('should include excessive security deposit violation', () => {
      const securityDepositViolation = housingLawDatabase.violations.critical_violations.find(
        v => v.id === 'CRIT-001'
      );
      
      expect(securityDepositViolation).toBeDefined();
      expect(securityDepositViolation?.violation_type).toBe('Excessive Security Deposit');
      expect(securityDepositViolation?.severity).toBe('Critical');
      expect(securityDepositViolation?.legal_violation).toContain('NYC Housing Maintenance Code');
      expect(securityDepositViolation?.detection_regex).toContain('security');
    });

    it('should include repair responsibility waiver violation', () => {
      const repairWaiverViolation = housingLawDatabase.violations.critical_violations.find(
        v => v.id === 'CRIT-002'
      );
      
      expect(repairWaiverViolation).toBeDefined();
      expect(repairWaiverViolation?.violation_type).toBe('Repair Responsibility Waiver');
      expect(repairWaiverViolation?.detection_regex).toContain('waive');
    });

    it('should include right to court waiver violation', () => {
      const courtWaiverViolation = housingLawDatabase.violations.critical_violations.find(
        v => v.id === 'CRIT-004'
      );
      
      expect(courtWaiverViolation).toBeDefined();
      expect(courtWaiverViolation?.violation_type).toBe('Right to Court Waiver');
      expect(courtWaiverViolation?.legal_violation).toContain('Due Process Clause');
    });
  });

  describe('High Severity Violations', () => {
    it('should have 4 high severity violations', () => {
      expect(housingLawDatabase.violations.high_severity_violations).toHaveLength(4);
    });

    it('should include illegal rent increase provision', () => {
      const rentIncreaseViolation = housingLawDatabase.violations.high_severity_violations.find(
        v => v.id === 'HIGH-001'
      );
      
      expect(rentIncreaseViolation).toBeDefined();
      expect(rentIncreaseViolation?.violation_type).toBe('Illegal Rent Increase Provision');
      expect(rentIncreaseViolation?.legal_violation).toContain('Rent Stabilization Law');
    });

    it('should include discriminatory provisions', () => {
      const discriminationViolation = housingLawDatabase.violations.high_severity_violations.find(
        v => v.id === 'HIGH-002'
      );
      
      expect(discriminationViolation).toBeDefined();
      expect(discriminationViolation?.violation_type).toBe('Discriminatory Provisions');
      expect(discriminationViolation?.legal_violation).toContain('NYC Human Rights Law');
    });
  });

  describe('Medium/Low Violations', () => {
    it('should have 11 medium/low violations', () => {
      expect(housingLawDatabase.violations.medium_low_violations).toHaveLength(11);
    });

    it('should include excessive late fees violation', () => {
      const lateFeeViolation = housingLawDatabase.violations.medium_low_violations.find(
        v => v.id === 'MED-001'
      );
      
      expect(lateFeeViolation).toBeDefined();
      expect(lateFeeViolation?.violation_type).toBe('Excessive Late Fees');
      expect(lateFeeViolation?.severity).toBe('Medium');
    });

    it('should include pet fee violation for stabilized units', () => {
      const petFeeViolation = housingLawDatabase.violations.medium_low_violations.find(
        v => v.id === 'LOW-004'
      );
      
      expect(petFeeViolation).toBeDefined();
      expect(petFeeViolation?.violation_type).toBe('Pet Fee (Stabilized Units)');
      expect(petFeeViolation?.severity).toBe('Low');
    });
  });

  describe('Utility Functions', () => {
    it('should return all violation patterns', () => {
      const allPatterns = getAllViolationPatterns();
      expect(allPatterns).toHaveLength(20);
      expect(allPatterns.every(p => p.id && p.violation_type && p.severity)).toBe(true);
    });

    it('should filter patterns by severity', () => {
      const criticalPatterns = getViolationPatternsBySeverity('Critical');
      const highPatterns = getViolationPatternsBySeverity('High');
      const mediumPatterns = getViolationPatternsBySeverity('Medium');
      const lowPatterns = getViolationPatternsBySeverity('Low');

      expect(criticalPatterns).toHaveLength(5);
      expect(highPatterns).toHaveLength(4);
      expect(mediumPatterns).toHaveLength(3); // MED-001, MED-002, MED-003
      expect(lowPatterns).toHaveLength(8); // All others are Low
    });

    it('should find violation pattern by ID', () => {
      const pattern = findViolationPatternById('CRIT-001');
      expect(pattern).toBeDefined();
      expect(pattern?.violation_type).toBe('Excessive Security Deposit');

      const nonExistentPattern = findViolationPatternById('NON-EXISTENT');
      expect(nonExistentPattern).toBeUndefined();
    });
  });

  describe('Violation Pattern Structure', () => {
    it('should have valid regex patterns', () => {
      const allPatterns = getAllViolationPatterns();
      
      for (const pattern of allPatterns) {
        // Test that regex patterns are valid
        expect(() => new RegExp(pattern.detection_regex, 'i')).not.toThrow();
        
        // Test that patterns have required fields
        expect(pattern.id).toMatch(/^[A-Z]+-\d{3}$/);
        expect(pattern.violation_type).toBeTruthy();
        expect(['Critical', 'High', 'Medium', 'Low']).toContain(pattern.severity);
        expect(pattern.legal_violation).toBeTruthy();
        expect(pattern.example_illegal_clause).toBeTruthy();
        expect(pattern.hpd_violation_code).toBeTruthy();
      }
    });

    it('should have unique IDs across all patterns', () => {
      const allPatterns = getAllViolationPatterns();
      const ids = allPatterns.map(p => p.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique HPD violation codes', () => {
      const allPatterns = getAllViolationPatterns();
      const codes = allPatterns.map(p => p.hpd_violation_code);
      const uniqueCodes = new Set(codes);
      
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });
}); 