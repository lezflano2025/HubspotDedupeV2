# Fuzzy Matching Test Plan & Validation Dataset

## Overview

This document provides a comprehensive test plan and synthetic dataset to validate the fuzzy matching algorithm for contact deduplication.

## Algorithm Details

### Field Weights (from `fuzzyMatch.ts:43-110`)
- **email**: 1.5 (highest priority)
- **last_name**: 1.2
- **first_name**: 1.2
- **full_name**: 1.3 (computed from first + last)
- **phone**: 1.0
- **company**: 0.8
- **job_title**: 0.6 (lowest priority)

### Scoring Method
1. Each field compared using `fuzzball.ratio` (0-100)
2. Strings normalized: lowercase, trimmed, special chars removed, whitespace normalized
3. Overall score = weighted average of all compared fields
4. Fields with score > 70 marked as "matched"

### Expected Score Ranges
- **95-100**: Exact or near-exact duplicates (definite match)
- **85-95**: High-confidence duplicates (likely match)
- **75-85**: Medium-confidence duplicates (possible match)
- **70-80**: Borderline cases (review needed)
- **< 70**: Not considered duplicates

---

## Test Dataset (15 Contact Pairs)

### Category 1: Exact Duplicates (Score ~95-100)

#### TC01: Perfect Match - All Fields Identical
**Record A:**
```json
{
  "email": "john.smith@acmecorp.com",
  "first_name": "John",
  "last_name": "Smith",
  "phone": "555-123-4567",
  "company": "Acme Corporation",
  "job_title": "Senior Software Engineer"
}
```

**Record B:**
```json
{
  "email": "john.smith@acmecorp.com",
  "first_name": "John",
  "last_name": "Smith",
  "phone": "555-123-4567",
  "company": "Acme Corporation",
  "job_title": "Senior Software Engineer"
}
```

**Expected Field Scores:**
- email: 100
- first_name: 100
- last_name: 100
- full_name: 100
- phone: 100
- company: 100
- job_title: 100

**Expected Overall Score:** 100

**Rationale:** Perfect duplicate, should score 100 across all fields.

---

#### TC02: Exact Match with Case & Whitespace Differences
**Record A:**
```json
{
  "email": "sarah.jones@techstart.io",
  "first_name": "Sarah",
  "last_name": "Jones",
  "phone": "(555) 234-5678",
  "company": "TechStart Inc",
  "job_title": "Product Manager"
}
```

**Record B:**
```json
{
  "email": "SARAH.JONES@TECHSTART.IO",
  "first_name": "  sarah  ",
  "last_name": "JONES",
  "phone": "555-234-5678",
  "company": "TechStart Inc.",
  "job_title": "Product Manager"
}
```

**Expected Field Scores:**
- email: 100 (normalized)
- first_name: 100 (normalized)
- last_name: 100 (normalized)
- full_name: 100 (normalized)
- phone: 100 (normalized to digits/chars)
- company: 100 (special char removed)
- job_title: 100

**Expected Overall Score:** 100

**Rationale:** Tests normalization - case, whitespace, and special characters should be removed.

---

### Category 2: Near Duplicates - High Confidence (Score ~85-95)

#### TC03: Single Character Typo in First Name
**Record A:**
```json
{
  "email": "michael.chen@dataflow.com",
  "first_name": "Michael",
  "last_name": "Chen",
  "phone": "555-345-6789",
  "company": "DataFlow Systems",
  "job_title": "Data Scientist"
}
```

**Record B:**
```json
{
  "email": "michael.chen@dataflow.com",
  "first_name": "Micheal",
  "last_name": "Chen",
  "phone": "555-345-6789",
  "company": "DataFlow Systems",
  "job_title": "Data Scientist"
}
```

**Expected Field Scores:**
- email: 100
- first_name: ~86 (1 char difference in 7-char string)
- last_name: 100
- full_name: ~93 (1 char difference in longer string)
- phone: 100
- company: 100
- job_title: 100

**Expected Overall Score:** 96-98

**Rationale:** Single typo in lower-weight field, all other fields match perfectly.

---

#### TC04: Typo in Last Name
**Record A:**
```json
{
  "email": "robert.johnson@marketing.co",
  "first_name": "Robert",
  "last_name": "Johnson",
  "phone": "555-456-7890",
  "company": "Marketing Solutions LLC",
  "job_title": "Marketing Director"
}
```

**Record B:**
```json
{
  "email": "robert.johnson@marketing.co",
  "first_name": "Robert",
  "last_name": "Jonson",
  "phone": "555-456-7890",
  "company": "Marketing Solutions LLC",
  "job_title": "Marketing Director"
}
```

**Expected Field Scores:**
- email: 100
- first_name: 100
- last_name: ~86 (1 char missing in 7-char string)
- full_name: ~93 (1 char in longer combined name)
- phone: 100
- company: 100
- job_title: 100

**Expected Overall Score:** 96-98

**Rationale:** Single character omission in last name, everything else perfect.

---

#### TC05: Phone Number Formatting Variation
**Record A:**
```json
{
  "email": "emily.davis@startupventures.com",
  "first_name": "Emily",
  "last_name": "Davis",
  "phone": "5551234567",
  "company": "Startup Ventures",
  "job_title": "CEO"
}
```

**Record B:**
```json
{
  "email": "emily.davis@startupventures.com",
  "first_name": "Emily",
  "last_name": "Davis",
  "phone": "+1 (555) 123-4567",
  "company": "Startup Ventures",
  "job_title": "CEO"
}
```

**Expected Field Scores:**
- email: 100
- first_name: 100
- last_name: 100
- full_name: 100
- phone: ~63 (extra formatting chars: +1, parens, dashes)
- company: 100
- job_title: 100

**Expected Overall Score:** 92-95

**Rationale:** Phone formatting differs significantly but core digits match. Lower phone weight (1.0) prevents major score impact.

---

#### TC06: Nickname vs Full First Name
**Record A:**
```json
{
  "email": "william.brown@consulting.net",
  "first_name": "William",
  "last_name": "Brown",
  "phone": "555-567-8901",
  "company": "Brown Consulting Group",
  "job_title": "Principal Consultant"
}
```

**Record B:**
```json
{
  "email": "william.brown@consulting.net",
  "first_name": "Bill",
  "last_name": "Brown",
  "phone": "555-567-8901",
  "company": "Brown Consulting Group",
  "job_title": "Principal Consultant"
}
```

**Expected Field Scores:**
- email: 100
- first_name: ~50 (completely different strings)
- last_name: 100
- full_name: ~71 (bill brown vs william brown)
- phone: 100
- company: 100
- job_title: 100

**Expected Overall Score:** 88-92

**Rationale:** First name differs significantly, but high-weight email + other fields compensate.

---

#### TC07: Company Name Abbreviation
**Record A:**
```json
{
  "email": "jennifer.white@ibm.com",
  "first_name": "Jennifer",
  "last_name": "White",
  "phone": "555-678-9012",
  "company": "International Business Machines",
  "job_title": "Systems Architect"
}
```

**Record B:**
```json
{
  "email": "jennifer.white@ibm.com",
  "first_name": "Jennifer",
  "last_name": "White",
  "phone": "555-678-9012",
  "company": "IBM",
  "job_title": "Systems Architect"
}
```

**Expected Field Scores:**
- email: 100
- first_name: 100
- last_name: 100
- full_name: 100
- phone: 100
- company: ~23 (IBM vs internationalbusinessmachines)
- job_title: 100

**Expected Overall Score:** 90-94

**Rationale:** Company has low weight (0.8), so poor company match doesn't drastically reduce overall score.

---

### Category 3: Medium Confidence (Score ~75-85)

#### TC08: Multiple Minor Typos
**Record A:**
```json
{
  "email": "david.martinez@cloudtech.io",
  "first_name": "David",
  "last_name": "Martinez",
  "phone": "555-789-0123",
  "company": "CloudTech Solutions",
  "job_title": "DevOps Engineer"
}
```

**Record B:**
```json
{
  "email": "david.martinez@cloudtech.io",
  "first_name": "Davd",
  "last_name": "Martines",
  "phone": "555-789-0123",
  "company": "CloudTech Solutions",
  "job_title": "DevOps Enginear"
}
```

**Expected Field Scores:**
- email: 100
- first_name: ~80 (1 char missing)
- last_name: ~88 (1 char different)
- full_name: ~85 (2 chars different in combined)
- phone: 100
- company: 100
- job_title: ~94 (1 char different in longer string)

**Expected Overall Score:** 92-95

**Rationale:** Multiple small typos across different fields, but email (high weight) is perfect.

---

#### TC09: Different Job Title Same Person
**Record A:**
```json
{
  "email": "amanda.lee@growth.io",
  "first_name": "Amanda",
  "last_name": "Lee",
  "phone": "555-890-1234",
  "company": "Growth Analytics Inc",
  "job_title": "Junior Data Analyst"
}
```

**Record B:**
```json
{
  "email": "amanda.lee@growth.io",
  "first_name": "Amanda",
  "last_name": "Lee",
  "phone": "555-890-1234",
  "company": "Growth Analytics Inc",
  "job_title": "Senior Data Analyst"
}
```

**Expected Field Scores:**
- email: 100
- first_name: 100
- last_name: 100
- full_name: 100
- phone: 100
- company: 100
- job_title: ~76 (junior vs senior, rest matches)

**Expected Overall Score:** 96-98

**Rationale:** Job title changed (promotion), but low weight (0.6) means minimal impact. Likely same person.

---

#### TC10: Email Domain Changed, Name Intact
**Record A:**
```json
{
  "email": "christopher.taylor@oldcompany.com",
  "first_name": "Christopher",
  "last_name": "Taylor",
  "phone": "555-901-2345",
  "company": "Old Company LLC",
  "job_title": "Account Executive"
}
```

**Record B:**
```json
{
  "email": "christopher.taylor@newcompany.com",
  "first_name": "Christopher",
  "last_name": "Taylor",
  "phone": "555-901-2345",
  "company": "New Company Inc",
  "job_title": "Account Executive"
}
```

**Expected Field Scores:**
- email: ~77 (same username, different domain)
- first_name: 100
- last_name: 100
- full_name: 100
- phone: 100
- company: ~50 (completely different company names)
- job_title: 100

**Expected Overall Score:** 85-89

**Rationale:** Person changed jobs. Email username matches but domain differs. Medium confidence duplicate.

---

### Category 4: Borderline Cases (Score ~70-80)

#### TC11: Same Name, Different Email & Company
**Record A:**
```json
{
  "email": "james.wilson@techcorp.com",
  "first_name": "James",
  "last_name": "Wilson",
  "phone": "555-012-3456",
  "company": "TechCorp Industries",
  "job_title": "Software Developer"
}
```

**Record B:**
```json
{
  "email": "j.wilson@innovate.co",
  "first_name": "James",
  "last_name": "Wilson",
  "phone": "555-012-3456",
  "company": "Innovate Labs",
  "job_title": "Software Developer"
}
```

**Expected Field Scores:**
- email: ~50 (j wilson vs jameswilson, different domains)
- first_name: 100
- last_name: 100
- full_name: 100
- phone: 100
- company: ~30 (very different)
- job_title: 100

**Expected Overall Score:** 77-82

**Rationale:** Common name, could be different people or job change. Phone match suggests same person.

---

#### TC12: Maiden Name Change (Marriage)
**Record A:**
```json
{
  "email": "lisa.anderson@design.com",
  "first_name": "Lisa",
  "last_name": "Anderson",
  "phone": "555-123-4567",
  "company": "Design Studio Pro",
  "job_title": "UX Designer"
}
```

**Record B:**
```json
{
  "email": "lisa.thompson@design.com",
  "first_name": "Lisa",
  "last_name": "Thompson",
  "phone": "555-123-4567",
  "company": "Design Studio Pro",
  "job_title": "UX Designer"
}
```

**Expected Field Scores:**
- email: ~73 (lisa anderson vs lisa thompson at same domain)
- first_name: 100
- last_name: ~27 (completely different)
- full_name: ~64 (first name matches, last differs)
- phone: 100
- company: 100
- job_title: 100

**Expected Overall Score:** 75-80

**Rationale:** Borderline case - same phone/company/title, but last name changed. Could be name change or different person.

---

#### TC13: Similar Email, Different Name (Typo or Different Person?)
**Record A:**
```json
{
  "email": "mark.roberts@sales.com",
  "first_name": "Mark",
  "last_name": "Roberts",
  "phone": "555-234-5678",
  "company": "Sales Force Co",
  "job_title": "Sales Representative"
}
```

**Record B:**
```json
{
  "email": "mark.roberts@sales.com",
  "first_name": "Marc",
  "last_name": "Roberts",
  "phone": "555-234-5679",
  "company": "Sales Force Co",
  "job_title": "Sales Representative"
}
```

**Expected Field Scores:**
- email: 100
- first_name: ~80 (mark vs marc)
- last_name: 100
- full_name: ~90 (1 char difference)
- phone: ~93 (1 digit different)
- company: 100
- job_title: 100

**Expected Overall Score:** 94-97

**Rationale:** Could be typo in first name or one digit phone error. High similarity suggests duplicate.

---

### Category 5: Non-Matches (Score < 70)

#### TC14: Different People, Same Company
**Record A:**
```json
{
  "email": "alice.green@megacorp.com",
  "first_name": "Alice",
  "last_name": "Green",
  "phone": "555-345-6789",
  "company": "MegaCorp International",
  "job_title": "HR Manager"
}
```

**Record B:**
```json
{
  "email": "bob.smith@megacorp.com",
  "first_name": "Bob",
  "last_name": "Smith",
  "phone": "555-456-7890",
  "company": "MegaCorp International",
  "job_title": "Finance Director"
}
```

**Expected Field Scores:**
- email: ~58 (same domain, different usernames)
- first_name: ~23 (completely different)
- last_name: ~20 (completely different)
- full_name: ~22 (completely different)
- phone: ~47 (some digits might match by chance)
- company: 100
- job_title: ~30 (both have "manager/director")

**Expected Overall Score:** 40-50

**Rationale:** Clearly different people at same company. Should NOT be flagged as duplicates.

---

#### TC15: Completely Different Records
**Record A:**
```json
{
  "email": "susan.clark@retailking.com",
  "first_name": "Susan",
  "last_name": "Clark",
  "phone": "555-567-8901",
  "company": "Retail King Corp",
  "job_title": "Store Manager"
}
```

**Record B:**
```json
{
  "email": "tony.nguyen@webdesign.io",
  "first_name": "Tony",
  "last_name": "Nguyen",
  "phone": "555-678-9012",
  "company": "Web Design Studio",
  "job_title": "Creative Director"
}
```

**Expected Field Scores:**
- email: ~30 (completely different)
- first_name: ~18 (no similarity)
- last_name: ~20 (no similarity)
- full_name: ~20 (no similarity)
- phone: ~47 (random digit overlap)
- company: ~25 (no real similarity)
- job_title: ~35 (both end in "manager/director")

**Expected Overall Score:** 25-35

**Rationale:** Completely different people. Should score very low.

---

## Test Execution Plan

### Phase 1: Unit Tests
1. **Test Normalization Function**
   - Verify lowercase conversion
   - Verify special character removal
   - Verify whitespace normalization
   - Test with null/undefined values

2. **Test Field Scoring**
   - Verify fuzzball.ratio works as expected
   - Test exact matches return 100
   - Test partial matches return expected ranges

3. **Test Weighted Average Calculation**
   - Manually calculate expected scores for 2-3 test cases
   - Verify implementation matches expected calculation
   - Test with missing fields (verify weights adjust correctly)

### Phase 2: Integration Tests
1. **Run All 15 Test Cases**
   - Create contacts in test database
   - Run fuzzy matching algorithm
   - Capture actual scores

2. **Validation Criteria**
   - Overall score within ±3 points of expected range
   - Field scores within ±5 points of expected values
   - Score bands match (exact/near/borderline/non-match)

3. **Edge Cases**
   - Empty strings vs null values
   - Very long field values
   - Unicode characters
   - Special characters in emails

### Phase 3: Boundary Testing
1. **Threshold Validation (minScore = 80)**
   - TC01-TC10 should be flagged as duplicates (score ≥ 80)
   - TC11-TC13 are borderline (may or may not be flagged)
   - TC14-TC15 should NOT be flagged (score < 70)

2. **Field Weight Sensitivity Analysis**
   - Test impact of changing weights ±20%
   - Verify high-weight fields (email) dominate scoring
   - Verify low-weight fields (job_title) have minimal impact

### Phase 4: Real-World Validation
1. **Manual Review**
   - Have domain experts review borderline cases (TC11-TC13)
   - Adjust weights if needed based on business requirements

2. **False Positive/Negative Analysis**
   - Track cases where algorithm fails
   - Refine test cases based on findings

---

## Success Criteria

### Must Pass
- ✅ TC01-TC02: Score 95-100 (exact duplicates)
- ✅ TC03-TC07: Score 85-95 (high-confidence duplicates)
- ✅ TC14-TC15: Score < 70 (non-matches)

### Should Pass
- ⚠️ TC08-TC10: Score 75-90 (medium-confidence)
- ⚠️ TC11-TC13: Score 70-85 (borderline - acceptable variance)

### Acceptable Variance
- Overall score: ±3 points from expected range
- Field scores: ±5 points from expected values

---

## Implementation Checklist

- [ ] Create unit tests for normalization function
- [ ] Create unit tests for calculateContactSimilarity
- [ ] Implement test data loader for 15 test cases
- [ ] Create automated test runner
- [ ] Generate test report with actual vs expected scores
- [ ] Document any score discrepancies > 5 points
- [ ] Review borderline cases with stakeholders
- [ ] Adjust weights if necessary based on validation results
- [ ] Add regression tests to CI/CD pipeline

---

## Notes & Observations

### Weight Discrepancy
- **IMPORTANT**: The task description mentions `last_name` weight as **1.3**, but the actual code implementation uses **1.2** (line 55 in fuzzyMatch.ts)
- Test expectations in this document use the **actual code weights** (1.2)
- Consider updating code or documentation for consistency

### Normalization Impact
- Phone number normalization may be too aggressive (removes all formatting)
- Consider implementing phone-specific normalization (extract digits only)
- Email normalization works well for case/whitespace

### Recommendations
1. **Phone Matching**: Consider using a specialized phone comparison library (e.g., libphonenumber) for better international format handling
2. **Name Matching**: Consider using phonetic matching (Soundex/Metaphone) for nickname detection
3. **Email Matching**: Current approach works well, but could weight username vs domain differently
4. **Company Matching**: Consider using fuzzy token matching for abbreviations (IBM vs International Business Machines)

---

## Appendix: Manual Score Calculations

### Example: TC03 Calculation

**Fields Compared:**
- email: 100 × 1.5 = 150
- first_name: 86 × 1.2 = 103.2
- last_name: 100 × 1.2 = 120
- full_name: 93 × 1.3 = 120.9
- phone: 100 × 1.0 = 100
- company: 100 × 0.8 = 80
- job_title: 100 × 0.6 = 60

**Calculation:**
```
Total weighted score = 150 + 103.2 + 120 + 120.9 + 100 + 80 + 60 = 734.1
Total weights = 1.5 + 1.2 + 1.2 + 1.3 + 1.0 + 0.8 + 0.6 = 7.6
Overall score = 734.1 / 7.6 = 96.6 ≈ 97
```

**Expected: 96-98 ✓**

---

*Last Updated: 2025-11-30*
*Version: 1.0*
