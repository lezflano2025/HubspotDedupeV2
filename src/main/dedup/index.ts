/**
 * Deduplication module exports
 */

export { runContactDeduplication, runCompanyDeduplication, runFullDeduplication } from './engine';

export type { DeduplicationOptions, DeduplicationResult } from './engine';

export { getDuplicateGroupStats, clearDuplicateGroups } from './grouping';

export { selectGoldenContact, selectGoldenCompany, explainGoldenSelection } from './goldenRecord';
