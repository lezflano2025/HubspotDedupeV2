import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { clsx } from 'clsx';
import type { FieldSimilarity } from '../../shared/types';
// RESOLUTION: Import both the system keys (Codex) and formatter (Main)
import { SYSTEM_PROPERTY_KEYS } from '../../shared/systemProperties';
import { formatSimilarity } from '../../shared/formatSimilarity';

interface Record {
  hs_id: string;
  [key: string]: unknown;
}

interface ComparisonViewProps {
  records: Record[];
  goldenRecordId?: string;
  onMerge: (primaryId: string) => void;
  onCancel: () => void;
  isMerging?: boolean;
  fieldScores?: FieldSimilarity[];
  similarityScore?: number;
}

// Key fields to show at the top for contacts
const CONTACT_KEY_FIELDS = ['email', 'first_name', 'last_name', 'company', 'job_title'];

// Key fields to show at the top for companies
const COMPANY_KEY_FIELDS = ['name', 'domain', 'phone', 'city', 'state'];

// RESOLUTION: Use dynamic exclusions (Codex) instead of hardcoded list
const EXCLUDED_FIELDS = new Set<string>([
  ...Array.from(SYSTEM_PROPERTY_KEYS),
  'id',
  'hs_id',
  'hs_object_id',
  'created_at',
  'createdate',
  'updated_at',
  'lastmodifieddate',
  'imported_at',
  'properties',
  'retry_count',
  'last_error',
]);

function FieldComparison({
  label,
  values,
  goldenIndex,
  similarityScore,
}: {
  label: string;
  values: (string | null | undefined)[];
  goldenIndex?: number;
  similarityScore?: number;
}) {
  const formattedSimilarity =
    similarityScore !== undefined ? formatSimilarity(similarityScore) : undefined;

  const badgeVariant = formattedSimilarity !== undefined
    ? formattedSimilarity >= 90
      ? 'success'
      : formattedSimilarity >= 70
      ? 'warning'
      : 'danger'
    : 'info';

  const displayValues = values.map((value) => (value === null || value === undefined ? '' : value.toString()));
  const normalizedValues = displayValues.map((value) => value.trim());
  const uniqueNormalizedValues = new Set(normalizedValues);
  const hasDifferences = uniqueNormalizedValues.size > 1;
  const allSame = !hasDifferences;

  return (
    <div
      className={clsx(
        'border-b border-gray-200 dark:border-gray-700 py-3 rounded-md transition-colors',
        {
          'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700': hasDifferences,
        },
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
              {label.replace(/_/g, ' ')}
            </span>
            {hasDifferences && (
              <div className="group relative text-orange-600 dark:text-orange-400" aria-label="Values differ between records">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M7 4a1 1 0 011 1v2h2a1 1 0 010 2H8v2a1 1 0 11-2 0V9H4a1 1 0 010-2h2V5a1 1 0 011-1zm6 6a1 1 0 10-2 0v2h-2a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2v-2z" />
                </svg>
                <div className="invisible group-hover:visible absolute z-10 px-3 py-2 text-xs font-normal text-white bg-gray-900 rounded-lg shadow-lg bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap">
                  Values differ between records
                </div>
              </div>
            )}
          </div>
          {formattedSimilarity !== undefined && (
            <div className="group relative">
              <Badge variant={badgeVariant}>{formattedSimilarity}% match</Badge>
              <div className="invisible group-hover:visible absolute z-10 px-3 py-2 text-xs font-normal text-white bg-gray-900 rounded-lg shadow-lg bottom-full left-0 mb-2 w-48">
                {formattedSimilarity >= 90
                  ? 'Strong match - values are nearly identical'
                  : formattedSimilarity >= 70
                  ? 'Partial match - values have some differences'
                  : 'Weak match - values differ significantly'}
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          {(() => {
            const uniqueNonEmptyValues = new Set(normalizedValues.filter((v) => v !== ''));
            const hasMissingValues = normalizedValues.some((v) => v === '');
            if (!hasDifferences && uniqueNonEmptyValues.size === 1) {
              return (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Exact match
                </span>
              );
            }
            if (hasMissingValues) {
              return <span className="text-yellow-600 dark:text-yellow-400">Missing data</span>;
            }
            return <span className="text-orange-600 dark:text-orange-400">Different values</span>;
          })()}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {values.map((value, idx) => {
          const isGolden = goldenIndex === idx;
          const val = displayValues[idx];
          const normalizedValue = normalizedValues[idx];
          const isEmpty = !normalizedValue;
          const isDifferent = hasDifferences && !isEmpty;

          return (
            <div
              key={idx}
              className={clsx('p-2 rounded text-sm', {
                'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800':
                  isGolden && !isEmpty,
                'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800':
                  isDifferent && !isGolden,
                'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400': isEmpty,
              })}
            >
              {isEmpty ? <em>Empty</em> : val}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ComparisonView({
  records,
  goldenRecordId,
  onMerge,
  onCancel,
  isMerging = false,
  fieldScores = [],
  similarityScore = 0,
}: ComparisonViewProps) {
  const [selectedPrimary, setSelectedPrimary] = React.useState<string>(goldenRecordId || records[0]?.hs_id || '');
  const similarityPercent = formatSimilarity(similarityScore);

  // Determine object type based on fields
  const isContact = records.some(r => 'email' in r || 'first_name' in r);
  const keyFields = isContact ? CONTACT_KEY_FIELDS : COMPANY_KEY_FIELDS;

  // Get all unique field names across all records (excluding system fields)
  const allFields = React.useMemo(() => {
    const fields = new Set<string>();
    records.forEach((record) => {
      Object.keys(record).forEach((key) => {
        if (!EXCLUDED_FIELDS.has(key.toLowerCase())) {
          fields.add(key);
        }
      });
    });
    return Array.from(fields);
  }, [records]);

  // Create field score map for easy lookup
  const fieldScoreMap = React.useMemo(() => {
    const map = new Map<string, number>();
    fieldScores.forEach(fs => {
      map.set(fs.field, fs.score);
    });
    return map;
  }, [fieldScores]);

  // Separate key fields and other fields
  const displayedKeyFields = keyFields.filter(f => allFields.includes(f));
  const otherFields = allFields.filter(f => !keyFields.includes(f));

  // Sort other fields by similarity score (highest first)
  const sortedOtherFields = React.useMemo(() => {
    return [...otherFields].sort((a, b) => {
      const scoreA = fieldScoreMap.get(a) || 0;
      const scoreB = fieldScoreMap.get(b) || 0;
      return scoreB - scoreA; // Descending order
    });
  }, [otherFields, fieldScoreMap]);

  const goldenIndex = records.findIndex((r) => r.hs_id === selectedPrimary);

  const handleMerge = () => {
    if (selectedPrimary) {
      onMerge(selectedPrimary);
    }
  };

  // Helper to get display name for a record
  const getRecordDisplayName = (record: Record, idx: number) => {
    if (isContact) {
      const firstName = record.first_name as string || '';
      const lastName = record.last_name as string || '';
      const email = record.email as string || '';
      return `${firstName} ${lastName}`.trim() || email || `Record ${idx + 1}`;
    } else {
      const name = record.name as string || '';
      return name || `Record ${idx + 1}`;
    }
  };

  return (
    <Card className="max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Review Duplicates</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Compare records and select which one to keep as primary
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant={
                similarityPercent >= 95 ? 'success' :
                similarityPercent >= 85 ? 'warning' :
                'danger'
              }
            >
              {similarityPercent}% Overall Match
            </Badge>
            <Badge variant="info">{records.length} Duplicates</Badge>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 dark:text-blue-400 mt-0.5">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">How Similarity Works</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                The <strong>{similarityPercent}% overall match</strong> is calculated by comparing all fields between these records.
                Green highlights show the recommended "golden record" values. Yellow highlights indicate differences you should review.
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Record Selection with Key Info */}
        <div className="mb-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Select Primary Record (to keep):
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Choose which record's ID and metadata to preserve. The "Recommended" record has the most complete data.
              You can customize individual field values below.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {records.map((record, idx) => (
              <button
                key={record.hs_id}
                onClick={() => setSelectedPrimary(record.hs_id)}
                className={clsx(
                  'p-4 rounded-lg border-2 text-left transition-all',
                  selectedPrimary === record.hs_id
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {getRecordDisplayName(record, idx)}
                  </span>
                  {selectedPrimary === record.hs_id && <Badge variant="success">Primary</Badge>}
                  {goldenRecordId === record.hs_id && selectedPrimary !== record.hs_id && (
                    <Badge variant="info">Recommended</Badge>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                  ID: {record.hs_id}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Field Comparison */}
        <div className="space-y-1">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Field Comparison</h4>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {records.map((record, idx) => (
              <div key={record.hs_id}>
                Record {idx + 1}
                {selectedPrimary === record.hs_id && <span className="ml-2 text-green-600 dark:text-green-400">★</span>}
              </div>
            ))}
          </div>

          {/* Key Fields First */}
          {displayedKeyFields.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                Key Fields
              </h5>
              {displayedKeyFields.map((field) => (
                <FieldComparison
                  key={field}
                  label={field.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  values={records.map((r) => r[field] as string)}
                  goldenIndex={goldenIndex}
                  similarityScore={fieldScoreMap.get(field)}
                />
              ))}
            </div>
          )}

          {/* Other Fields Sorted by Similarity */}
          {sortedOtherFields.length > 0 && (
            <div>
              <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                Other Fields (sorted by similarity)
              </h5>
              {sortedOtherFields.map((field) => (
                <FieldComparison
                  key={field}
                  label={field.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  values={records.map((r) => r[field] as string)}
                  goldenIndex={goldenIndex}
                  similarityScore={fieldScoreMap.get(field)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onCancel} disabled={isMerging}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleMerge} isLoading={isMerging} disabled={!selectedPrimary}>
            {isMerging ? 'Merging...' : 'Merge Records'}
          </Button>
        </div>

        {/* Legend */}
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Legend:</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded"></div>
              <span>Primary/Golden Record</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded"></div>
              <span>Different Value</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 dark:bg-gray-800 rounded"></div>
              <span>Empty Field</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}