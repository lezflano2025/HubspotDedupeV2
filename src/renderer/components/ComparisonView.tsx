import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { clsx } from 'clsx';
import type { FieldSimilarity } from '../../shared/types';

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
const EXCLUDED_FIELDS = new Set([
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
  // Check if all values are the same
  const uniqueValues = [...new Set(values.map((v) => v?.toString() || ''))];
  const allSame = uniqueValues.length === 1 && uniqueValues[0] !== '';

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium text-sm text-gray-700 dark:text-gray-300">{label}</div>
        {similarityScore !== undefined && (
          <div className="flex items-center gap-2">
            <Badge
              variant={
                similarityScore >= 90 ? 'success' :
                similarityScore >= 70 ? 'warning' :
                'danger'
              }
            >
              {similarityScore}% match
            </Badge>
          </div>
        )}
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
      </CardHeader>

      <CardContent>
        {/* Record Selection with Key Info */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Primary Record (to keep):
          </label>
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
