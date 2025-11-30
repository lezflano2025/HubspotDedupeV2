import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { clsx } from 'clsx';
import type { FieldSimilarity } from '../../shared/types';
import { SYSTEM_PROPERTY_KEYS } from '../../shared/systemProperties';

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

// System fields to exclude
const EXCLUDED_FIELDS = new Set<string>([
  ...Array.from(SYSTEM_PROPERTY_KEYS),
  'id',
  'hs_id',
  'created_at',
  'updated_at',
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
  const badgeVariant = similarityScore !== undefined
    ? similarityScore >= 90
      ? 'success'
      : similarityScore >= 70
      ? 'warning'
      : 'danger'
    : 'info';

  const uniqueValues = new Set(values.filter((v) => v !== null && v !== undefined));
  const allSame = uniqueValues.size === 1 && !uniqueValues.has(null) && !uniqueValues.has(undefined);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 py-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
            {label.replace(/_/g, ' ')}
          </span>
          {similarityScore !== undefined && (
            <div className="group relative">
              <Badge variant={badgeVariant}>{Math.round(similarityScore)}% match</Badge>
              <div className="invisible group-hover:visible absolute z-10 px-3 py-2 text-xs font-normal text-white bg-gray-900 rounded-lg shadow-lg bottom-full left-0 mb-2 w-48">
                {similarityScore >= 90
                  ? 'Strong match - values are nearly identical'
                  : similarityScore >= 70
                  ? 'Partial match - values have some differences'
                  : 'Weak match - values differ significantly'}
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          {(() => {
            const uniqueNonEmptyValues = new Set(values.filter((v) => v !== null && v !== undefined && v !== ''));
            if (uniqueNonEmptyValues.size === 1) {
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
            if (values.some((v) => v === null || v === undefined || v === '')) {
              return <span className="text-yellow-600 dark:text-yellow-400">Missing data</span>;
            }
            return <span className="text-orange-600 dark:text-orange-400">Different values</span>;
          })()}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {values.map((value, idx) => {
          const isGolden = goldenIndex === idx;
          const val = value?.toString() || '';
          const isEmpty = !val;
          const isDifferent = !allSame && !isEmpty;

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
                similarityScore >= 95 ? 'success' :
                similarityScore >= 85 ? 'warning' :
                'danger'
              }
            >
              {similarityScore}% Overall Match
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
                The <strong>{similarityScore}% overall match</strong> is calculated by comparing all fields between these records.
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
                {/* Show key info in card */}
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  {isContact ? (
                    <>
                      {record.email && <div className="truncate">📧 {record.email as string}</div>}
                      {record.company && <div className="truncate">🏢 {record.company as string}</div>}
                      {record.phone && <div className="truncate">📱 {record.phone as string}</div>}
                    </>
                  ) : (
                    <>
                      {record.domain && <div className="truncate">🌐 {record.domain as string}</div>}
                      {record.phone && <div className="truncate">📱 {record.phone as string}</div>}
                      {record.city && record.state && (
                        <div className="truncate">📍 {record.city as string}, {record.state as string}</div>
                      )}
                    </>
                  )}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate mt-2">
                  ID: {record.hs_id}
                </div>
              </button>
            ))}
          </div>
        </div>

        {similarityScore < 85 && (
          <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-1">Low Confidence Match</h4>
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  This group has less than 85% similarity. Review carefully to ensure these are actually duplicates before
                  merging.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {fieldScores?.filter((f) => f.score >= 90).length || 0}
            </div>
            <div className="text-sm text-green-600 dark:text-green-300 mt-1">Exact/Strong Matches</div>
            <div className="text-xs text-green-700 dark:text-green-400 mt-1">Fields with 90%+ similarity</div>
          </div>

          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
              {fieldScores?.filter((f) => f.score >= 70 && f.score < 90).length || 0}
            </div>
            <div className="text-sm text-yellow-600 dark:text-yellow-300 mt-1">Partial Matches</div>
            <div className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">Fields with 70-89% similarity</div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-400">
              {(() => {
                const allFields = new Set<string>();
                records.forEach((r) => {
                  Object.keys(r.properties || {}).forEach((k) => allFields.add(k));
                });
                return allFields.size - (fieldScores?.length || 0);
              })()}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">Different/Empty</div>
            <div className="text-xs text-gray-700 dark:text-gray-400 mt-1">Fields that don't match</div>
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
      </CardContent>
    </Card>
  );
}
