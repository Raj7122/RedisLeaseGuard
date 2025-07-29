/**
 * NYC Housing Law Violations Database
 * Comprehensive database of illegal lease clause patterns for automated detection
 */

export interface ViolationPattern {
  id: string;
  violation_type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  illegal_clause_pattern: string;
  description: string;
  legal_violation: string;
  example_illegal_clause: string;
  legal_standard: string;
  penalties: string;
  detection_regex: string;
  source: string;
  hpd_violation_code: string;
}

export interface HousingLawDatabase {
  database_info: {
    title: string;
    version: string;
    last_updated: string;
    description: string;
    legal_disclaimer: string;
  };
  violations: {
    critical_violations: ViolationPattern[];
    high_severity_violations: ViolationPattern[];
    medium_low_violations: ViolationPattern[];
  };
}

export const housingLawDatabase: HousingLawDatabase = {
  database_info: {
    title: "NYC Housing Law Violations Database",
    version: "1.0",
    last_updated: "2025-01-27",
    description: "Comprehensive database of 20 common illegal lease clause patterns in NYC housing law",
    legal_disclaimer: "This database is for informational purposes. Consult legal counsel for specific cases."
  },
  violations: {
    critical_violations: [
      {
        id: "CRIT-001",
        violation_type: "Excessive Security Deposit",
        severity: "Critical",
        illegal_clause_pattern: "Security deposit exceeding one month's rent",
        description: "Any lease clause requiring security deposit greater than one month's rent",
        legal_violation: "NYC Housing Maintenance Code, Real Property Law §7-103",
        example_illegal_clause: "Tenant agrees to pay security deposit equal to two months' rent",
        legal_standard: "Maximum security deposit is one month's rent",
        penalties: "Tenant can recover excess amount plus interest",
        detection_regex: "(security\\s+deposit|deposit).*(?:two|2|three|3|four|4).*(month|rent)",
        source: "https://rentguidelinesboard.cityofnewyork.us/resources/faqs/security-deposits/",
        hpd_violation_code: "SEC-DEP-01"
      },
      {
        id: "CRIT-002",
        violation_type: "Repair Responsibility Waiver",
        severity: "Critical",
        illegal_clause_pattern: "Waiving landlord's duty to maintain premises",
        description: "Clauses that require tenant to waive landlord's obligation to maintain habitability",
        legal_violation: "NYC Housing Maintenance Code Article 1, Warranty of Habitability",
        example_illegal_clause: "Tenant waives any claims for repairs and maintenance",
        legal_standard: "Landlord cannot waive duty to maintain habitable conditions",
        penalties: "Clause is void; tenant retains all habitability rights",
        detection_regex: "(waive|waiver|waiving).*(repair|maintenance|habitab|condition|claims)|responsible.*all.*repair",
        source: "NY Real Property Law §235-b",
        hpd_violation_code: "HAB-WAIV-01"
      },
      {
        id: "CRIT-003",
        violation_type: "Self-Help Eviction Authorization",
        severity: "Critical",
        illegal_clause_pattern: "Allowing landlord to change locks or remove tenant property",
        description: "Clauses permitting landlord to evict without court process",
        legal_violation: "Real Property Actions and Proceedings Law (RPAPL)",
        example_illegal_clause: "Landlord may change locks for non-payment without notice",
        legal_standard: "All evictions must go through court process",
        penalties: "Tenant entitled to damages, attorney fees, and immediate restoration",
        detection_regex: "(change\\s+lock|remove\\s+property|self.?help|without.*court)",
        source: "RPAPL Article 7",
        hpd_violation_code: "EVICT-SELF-01"
      },
      {
        id: "CRIT-004",
        violation_type: "Right to Court Waiver",
        severity: "Critical",
        illegal_clause_pattern: "Waiving tenant's right to court proceedings",
        description: "Clauses requiring tenant to waive right to appear in housing court",
        legal_violation: "Due Process Clause, RPAPL",
        example_illegal_clause: "Tenant waives right to contest eviction in court",
        legal_standard: "Constitutional right to due process cannot be waived",
        penalties: "Clause is void and unenforceable",
        detection_regex: "(waive|waiver).*(court|legal|proceeding|contest|right|proceedings)|no.*court.*proceeding|waiving.*legal",
        source: "US Constitution 14th Amendment, NY Constitution",
        hpd_violation_code: "COURT-WAIV-01"
      },
      {
        id: "CRIT-005",
        violation_type: "Attorney Fee Shifting (One-Way)",
        severity: "Critical",
        illegal_clause_pattern: "Tenant pays landlord's attorney fees but not vice versa",
        description: "Clauses requiring only tenant to pay landlord's legal fees",
        legal_violation: "Real Property Law §234",
        example_illegal_clause: "Tenant shall pay landlord's attorney fees in any legal action",
        legal_standard: "Attorney fee clauses must be reciprocal or void",
        penalties: "Clause is void; neither party entitled to attorney fees",
        detection_regex: "tenant.*(pay|responsible).*(attorney|legal).*fee(?!.*landlord.*pay)",
        source: "NY Real Property Law §234",
        hpd_violation_code: "ATTY-FEE-01"
      }
    ],
    high_severity_violations: [
      {
        id: "HIGH-001",
        violation_type: "Illegal Rent Increase Provision",
        severity: "High",
        illegal_clause_pattern: "Rent increases without proper notice or limits",
        description: "Clauses allowing rent increases without required notice periods or beyond legal limits",
        legal_violation: "Rent Stabilization Law, Emergency Tenant Protection Act",
        example_illegal_clause: "Rent may be increased at any time with 15 days notice",
        legal_standard: "30 days notice required; stabilized units have increase limits",
        penalties: "Illegal increases must be refunded with interest",
        detection_regex: "rent.*increas.*(?:15|1-5|immediate|any\\s+time)",
        source: "NYC Rent Guidelines Board regulations",
        hpd_violation_code: "RENT-INC-01"
      },
      {
        id: "HIGH-002",
        violation_type: "Discriminatory Provisions",
        severity: "High",
        illegal_clause_pattern: "Discrimination based on protected characteristics",
        description: "Clauses that discriminate based on race, religion, family status, etc.",
        legal_violation: "NYC Human Rights Law, Fair Housing Act",
        example_illegal_clause: "No children under 12 permitted in apartment",
        legal_standard: "Cannot discriminate based on protected classes",
        penalties: "Civil penalties up to $250,000, compensatory damages",
        detection_regex: "(no\\s+children|adults\\s+only|single\\s+person|race|religion|national|families.*children)",
        source: "NYC Human Rights Law §8-107",
        hpd_violation_code: "DISCRIM-01"
      },
      {
        id: "HIGH-003",
        violation_type: "Illegal Entry Provisions",
        severity: "High",
        illegal_clause_pattern: "Landlord entry without proper notice",
        description: "Clauses allowing landlord entry without reasonable notice",
        legal_violation: "Real Property Law §235-f",
        example_illegal_clause: "Landlord may enter apartment at any time for inspections",
        legal_standard: "Reasonable notice required except for emergencies",
        penalties: "Tenant entitled to damages for privacy violation",
        detection_regex: "(enter|access).*(?:any\\s+time|without\\s+notice|immediate)",
        source: "NY Real Property Law §235-f",
        hpd_violation_code: "ENTRY-01"
      },
      {
        id: "HIGH-004",
        violation_type: "Lease Renewal Denial Without Cause",
        severity: "High",
        illegal_clause_pattern: "Denying renewal without good cause (stabilized units)",
        description: "Clauses allowing non-renewal without good cause in stabilized apartments",
        legal_violation: "Rent Stabilization Code",
        example_illegal_clause: "Landlord may refuse lease renewal for any reason",
        legal_standard: "Good cause required for non-renewal in stabilized units",
        penalties: "Tenant entitled to lease renewal and damages",
        detection_regex: "(refuse|deny).*renewal.*(?:any\\s+reason|no\\s+cause)",
        source: "9 NYCRR 2524.3",
        hpd_violation_code: "RENEW-01"
      }
    ],
    medium_low_violations: [
      {
        id: "MED-001",
        violation_type: "Excessive Late Fees",
        severity: "Medium",
        illegal_clause_pattern: "Late fees exceeding reasonable limits",
        description: "Late fees that are excessive or compound daily",
        legal_violation: "General contract law - unconscionable terms",
        example_illegal_clause: "Late fee of $100 per day after 5 days late",
        legal_standard: "Late fees must be reasonable and not punitive",
        penalties: "Excessive fees may be deemed unenforceable",
        detection_regex: "late\\s+fee.*(?:per\\s+day|\\$\\d{2,}|compound)",
        source: "NY General Obligations Law §5-501",
        hpd_violation_code: "LATE-FEE-01"
      },
      {
        id: "MED-002",
        violation_type: "Subletting Prohibition",
        severity: "Medium",
        illegal_clause_pattern: "Complete prohibition on subletting",
        description: "Clauses completely prohibiting subletting in rent-stabilized units",
        legal_violation: "Real Property Law §226-b",
        example_illegal_clause: "Subletting is strictly prohibited under all circumstances",
        legal_standard: "Stabilized tenants have limited right to sublet",
        penalties: "Clause is void in stabilized apartments",
        detection_regex: "sublet.*(?:prohibited|forbidden|not\\s+allowed|strictly)",
        source: "NY Real Property Law §226-b",
        hpd_violation_code: "SUBLET-01"
      },
      {
        id: "MED-003",
        violation_type: "Excessive Guest Restrictions",
        severity: "Medium",
        illegal_clause_pattern: "Unreasonable limits on guests",
        description: "Clauses that unreasonably restrict overnight guests",
        legal_violation: "Right to quiet enjoyment",
        example_illegal_clause: "No overnight guests permitted for more than 2 nights per month",
        legal_standard: "Reasonable guest policies allowed, but not excessive restrictions",
        penalties: "Unenforceable if deemed unreasonable",
        detection_regex: "guest.*(?:prohibit|not\\s+permit|2\\s+night|no\\s+overnight)",
        source: "Implied covenant of quiet enjoyment",
        hpd_violation_code: "GUEST-01"
      },
      {
        id: "LOW-004",
        violation_type: "Pet Fee (Stabilized Units)",
        severity: "Low",
        illegal_clause_pattern: "Pet fees in rent-stabilized apartments",
        description: "Additional fees for pets in stabilized units",
        legal_violation: "Rent Stabilization Code",
        example_illegal_clause: "Monthly pet fee of $50 for any pets",
        legal_standard: "No additional fees allowed in stabilized units beyond rent",
        penalties: "Fees must be refunded",
        detection_regex: "pet\\s+fee|additional.*pet.*charge",
        source: "9 NYCRR 2520.6",
        hpd_violation_code: "PET-FEE-01"
      },
      {
        id: "LOW-005",
        violation_type: "Utility Responsibility Shift",
        severity: "Low",
        illegal_clause_pattern: "Shifting utility costs improperly",
        description: "Making tenant responsible for utilities traditionally covered by landlord",
        legal_violation: "Services reduction (stabilized units)",
        example_illegal_clause: "Tenant responsible for all utilities including heat",
        legal_standard: "Cannot reduce services in stabilized units without DHCR approval",
        penalties: "Service reduction order, rent reduction",
        detection_regex: "tenant.*responsible.*(?:heat|hot\\s+water|all\\s+utilit)",
        source: "9 NYCRR 2523.4",
        hpd_violation_code: "UTIL-01"
      },
      {
        id: "LOW-006",
        violation_type: "Lease Assignment Prohibition",
        severity: "Low",
        illegal_clause_pattern: "Blanket prohibition on lease assignment",
        description: "Clauses prohibiting assignment in rent-stabilized units",
        legal_violation: "Rent Stabilization Code",
        example_illegal_clause: "Lease may not be assigned under any circumstances",
        legal_standard: "Assignment rights exist in stabilized units with conditions",
        penalties: "Prohibition is void and unenforceable",
        detection_regex: "assign.*(?:prohibit|not\\s+allow|forbidden)",
        source: "9 NYCRR 2524.3",
        hpd_violation_code: "ASSIGN-01"
      },
      {
        id: "LOW-007",
        violation_type: "Carpet/Flooring Requirements",
        severity: "Low",
        illegal_clause_pattern: "Mandatory carpet installation at tenant expense",
        description: "Requiring tenant to install carpeting at their own expense",
        legal_violation: "Alteration responsibilities",
        example_illegal_clause: "Tenant must carpet 80% of apartment floors",
        legal_standard: "Landlord cannot require tenant-funded alterations",
        penalties: "Requirement is unenforceable",
        detection_regex: "tenant.*(?:install|carpet|floor).*expense",
        source: "Lease alteration principles",
        hpd_violation_code: "CARPET-01"
      },
      {
        id: "LOW-008",
        violation_type: "Insurance Requirement Overreach",
        severity: "Low",
        illegal_clause_pattern: "Excessive insurance requirements for tenant",
        description: "Requiring tenant to carry excessive or inappropriate insurance",
        legal_violation: "Unconscionable contract terms",
        example_illegal_clause: "Tenant must carry $1 million liability insurance",
        legal_standard: "Insurance requirements must be reasonable",
        penalties: "Excessive requirements may be unenforceable",
        detection_regex: "tenant.*insurance.*(?:\\$\\d{6,}|million|excessive)",
        source: "Contract unconscionability doctrine",
        hpd_violation_code: "INSUR-01"
      },
      {
        id: "LOW-009",
        violation_type: "Improper Lease Termination Notice",
        severity: "Low",
        illegal_clause_pattern: "Insufficient notice periods for lease termination",
        description: "Notice periods shorter than legally required minimums",
        legal_violation: "Real Property Law notice requirements",
        example_illegal_clause: "Either party may terminate with 15 days notice",
        legal_standard: "30 days notice required for month-to-month tenancies",
        penalties: "Termination invalid without proper notice",
        detection_regex: "terminat.*(?:15|1-5|immediate|10)\\s+day",
        source: "NY Real Property Law §232-a",
        hpd_violation_code: "TERM-NOT-01"
      },
      {
        id: "LOW-010",
        violation_type: "Roommate Restriction Overreach",
        severity: "Low",
        illegal_clause_pattern: "Excessive restrictions on roommates",
        description: "Blanket prohibition on roommates in apartments",
        legal_violation: "Real Property Law §235-f",
        example_illegal_clause: "No additional persons may reside in apartment",
        legal_standard: "Tenant has right to roommate subject to reasonable restrictions",
        penalties: "Excessive restrictions are unenforceable",
        detection_regex: "(?:no.*roommate|additional.*person.*prohibit)",
        source: "NY Real Property Law §235-f",
        hpd_violation_code: "ROOMM-01"
      },
      {
        id: "LOW-011",
        violation_type: "Waiver of Jury Trial",
        severity: "Low",
        illegal_clause_pattern: "Waiving right to jury trial",
        description: "Clauses requiring waiver of jury trial rights",
        legal_violation: "Constitutional rights",
        example_illegal_clause: "Parties waive right to jury trial in all disputes",
        legal_standard: "Jury trial rights generally cannot be waived in residential leases",
        penalties: "Waiver may be deemed unenforceable",
        detection_regex: "waive.*jury\\s+trial",
        source: "NY Constitution Article 1 §2",
        hpd_violation_code: "JURY-01"
      }
    ]
  }
};

/**
 * Get all violation patterns for vector embedding
 */
export function getAllViolationPatterns(): ViolationPattern[] {
  return [
    ...housingLawDatabase.violations.critical_violations,
    ...housingLawDatabase.violations.high_severity_violations,
    ...housingLawDatabase.violations.medium_low_violations
  ];
}

/**
 * Get violation patterns by severity
 */
export function getViolationPatternsBySeverity(severity: ViolationPattern['severity']): ViolationPattern[] {
  switch (severity) {
    case 'Critical':
      return housingLawDatabase.violations.critical_violations;
    case 'High':
      return housingLawDatabase.violations.high_severity_violations;
    case 'Medium':
      return housingLawDatabase.violations.medium_low_violations.filter(v => v.severity === 'Medium');
    case 'Low':
      return housingLawDatabase.violations.medium_low_violations.filter(v => v.severity === 'Low');
    default:
      return [];
  }
}

/**
 * Find violation pattern by ID
 */
export function findViolationPatternById(id: string): ViolationPattern | undefined {
  return getAllViolationPatterns().find(pattern => pattern.id === id);
} 