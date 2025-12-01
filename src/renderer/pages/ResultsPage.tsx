import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { ComparisonView } from '../components/ComparisonView';
import { DataViewer } from '../components/DataViewer';
import type { DuplicateGroup, DeduplicationResult, DuplicateStatusCounts, FieldSimilarity } from '../../shared/types';
import { formatSimilarity, normalizeSimilarityScore } from '../../shared/formatSimilarity';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';
type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';

const TooltipBadge = ({
  children,
  tooltip,
  variant,
}: {
  children: React.ReactNode;
  tooltip: string;
  variant: BadgeVariant;
}) => {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="cursor-help"
      >
        <Badge variant={variant}>{children}</Badge>
      </div>
      {showTooltip && (
        <div className="absolute z-10 px-3 py-2 text-xs font-normal text-white bg-gray-900 rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64">
          {tooltip}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export function ResultsPage() {
  const [objectType, setObjectType] = useState<'contact' | 'company'>('contact');
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DeduplicationResult | null>(null);
  const [importStatus, setImportStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [sortBy, setSortBy] = React.useState<'confidence' | 'recordCount'>('confidence');
  
  // Codex: Use strict ConfidenceFilter type
  const [filterConfidence, setFilterConfidence] = React.useState<ConfidenceFilter>('all');

  // Main: Status counts for progress bar
  const [statusCounts, setStatusCounts] = React.useState<DuplicateStatusCounts>({
    pending: 0,
    reviewed: 0,
    merged: 0,
    total: 0,
  });
   
  // Main: Search state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
    }, 250);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const formatFieldName = (field: string) => field.replace(/_/g, ' ');

  // Main: Helper functions
  const getTopContributingFields = (
    fieldScores?: FieldSimilarity[],
    matchedFields: string[] = []
  ): FieldSimilarity[] => {
    const scoredFields =
      fieldScores
        ?.filter((fs) => typeof fs.score === 'number' && fs.score >= 70)
        .sort((a, b) => b.score - a.score) || [];

    if (scoredFields.length > 0) {
      return scoredFields;
    }

    if (matchedFields.length > 0) {
      return matchedFields.map((field) => ({ field, score: 100 }));
    }

    return [];
  };

  const buildDuplicateReasonSentence = (fields: FieldSimilarity[]): string => {
    if (!fields.length) {
      return 'These records share similarities across multiple fields.';
    }

    const highlighted = fields
      .slice(0, 3)
      .map((f) => `${formatFieldName(f.field)} (${Math.round(f.score)}%)`);

    if (highlighted.length === 1) {
      return `Likely duplicates because ${highlighted[0]} is very similar.`;
    }

    if (highlighted.length === 2) {
      return `Likely duplicates because ${highlighted[0]} and ${highlighted[1]} closely match.`;
    }

    const last = highlighted.pop();
    return `Likely duplicates because ${highlighted.join(', ')} and ${last} all show strong matches.`;
  };

  // Load groups on mount and when object type changes
  useEffect(() => {
    loadGroups();
  }, [objectType]);

  const loadStatusCounts = async () => {
    try {
      const counts = await window.api.dedupGetStatusCounts(objectType);
      setStatusCounts(counts);
    } catch (err) {
      console.error('Failed to load status counts:', err);
    }
  };

  const loadGroups = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Main: Concurrent fetching
      const [fetchedGroups, counts] = await Promise.all([
        window.api.dedupGetGroups(objectType, 'pending'),
        window.api.dedupGetStatusCounts(objectType),
      ]);

      // Codex: Score normalization
      const normalizedGroups = fetchedGroups.map((group) => ({
        ...group,
        similarityScore: normalizeSimilarityScore(group.similarityScore),
      }));

      setStatusCounts(counts);
      setGroups(normalizedGroups);
    } catch (err) {
      console.error('Failed to load groups:', err);
      setError(err instanceof Error ? err.message : 'Failed to load duplicate groups');
    } finally {
      setIsLoading(false);
    }
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError('');

    try {
      const result = await window.api.dedupRunAnalysis(objectType);
      setAnalysisResult(result);

      // Reload groups after analysis
      await loadGroups();
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Deduplication analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runImport = async () => {
    setIsImporting(true);
    setError('');
    setImportStatus(`Importing ${objectType}s from HubSpot...`);

    try {
      const result =
        objectType === 'contact'
          ? await window.api.hubspotImportContacts()
          : await window.api.hubspotImportCompanies();

      if (result.success) {
        setImportStatus(
          `Import complete! Fetched ${result.totalFetched} ${objectType}s, saved ${result.totalSaved} to database.`
        );
      } else {
        setError(result.error || 'Import failed');
        setImportStatus('');
      }
    } catch (err) {
      console.error('Import failed:', err);
      setError(err instanceof Error ? err.message : 'Import failed');
      setImportStatus('');
    } finally {
      setIsImporting(false);
    }
  };

  const handleMerge = async (groupId: string, primaryId: string) => {
    setIsMerging(true);
    setError('');

    try {
      const result = await window.api.dedupMerge(groupId, primaryId);

      if (result.success) {
        // Remove the merged group from the list
        setGroups((prev) => prev.filter((g) => g.id !== groupId));
        loadStatusCounts();
        setSelectedGroup(null);
        alert(`Successfully merged ${result.mergedIds.length} records!`);
      } else {
        setError(result.error || 'Merge failed');
      }
    } catch (err) {
      console.error('Merge failed:', err);
      setError(err instanceof Error ? err.message : 'Merge operation failed');
    } finally {
      setIsMerging(false);
    }
  };

  const getConfidenceBadgeVariant = (score: number): BadgeVariant => {
    if (score >= 0.95) return 'success';
    if (score >= 0.85) return 'warning';
    return 'danger';
  };

  // Codex: Calculate counts for filter chips
  const confidenceCounts = React.useMemo<Record<ConfidenceFilter, number>>(() => {
    const counts: Record<ConfidenceFilter, number> = {
      all: groups.length,
      high: 0,
      medium: 0,
      low: 0,
    };

    groups.forEach(({ similarityScore }) => {
      if (similarityScore >= 0.95) counts.high += 1;
      else if (similarityScore >= 0.85) counts.medium += 1;
      else counts.low += 1;
    });

    return counts;
  }, [groups]);

  // Main: Get styles
  const getConfidenceStyles = (score: number) => {
    if (score >= 0.95) {
      return {
        borderClass: 'border-l-4 border-l-green-500',
        priorityClass: 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200',
        priorityLabel: 'High Priority',
      };
    }

    if (score >= 0.85) {
      return {
        borderClass: 'border-l-4 border-l-amber-400',
        priorityClass: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
        priorityLabel: 'Medium Priority',
      };
    }

    return {
      borderClass: 'border-l-4 border-l-red-400',
      priorityClass: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200',
      priorityLabel: 'Low Priority',
    };
  };

  const filteredGroups = React.useMemo(() => {
    return groups.filter((group) => {
      // 1. Confidence Filter
      if (filterConfidence !== 'all') {
        if (filterConfidence === 'high' && group.similarityScore < 0.95) return false;
        if (filterConfidence === 'medium' && (group.similarityScore < 0.85 || group.similarityScore >= 0.95))
          return false;
        if (filterConfidence === 'low' && group.similarityScore >= 0.85) return false;
      }

      // 2. Search Filter
      if (!debouncedSearch) return true;

      return group.records.some((record) => {
        const r = record as any;
        const name = `${r.first_name || ''} ${r.last_name || ''}`;
        
        const valuesToSearch = [
          name.trim(),
          r.email,
          r.company,
          r.name,
          r.domain,
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        return valuesToSearch.some((value) => value.includes(debouncedSearch));
      });
    });
  }, [debouncedSearch, filterConfidence, groups]);

  const sortedGroups = React.useMemo(() => {
    return [...filteredGroups].sort((a, b) => {
      if (sortBy === 'confidence') {
        return b.similarityScore - a.similarityScore;
      }
      return b.records.length - a.records.length;
    });
  }, [filteredGroups, sortBy]);

  // Codex: Define filters config
  const confidenceFilters: { level: ConfidenceFilter; label: string }[] = [
    { level: 'all', label: 'All' },
    { level: 'high', label: 'High' },
    { level: 'medium', label: 'Medium' },
    { level: 'low', label: 'Low' },
  ];

  // Main: Progress calculations
  const processedCount = statusCounts.reviewed + statusCounts.merged;
  const totalCount = statusCounts.total || groups.length;
  const progressPercentage = totalCount > 0 ? Math.min(100, Math.round((processedCount / totalCount) * 100)) : 0;

  if (selectedGroup) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="mb-4">
          <Button variant="secondary" onClick={() => setSelectedGroup(null)}>
            ← Back to Groups
          </Button>
        </div>
        <ComparisonView
          records={selectedGroup.records}
          goldenRecordId={selectedGroup.records[0]?.hs_id}
          onMerge={(primaryId) => handleMerge(selectedGroup.id, primaryId)}
          onCancel={() => setSelectedGroup(null)}
          isMerging={isMerging}
          fieldScores={selectedGroup.fieldScores}
          similarityScore={selectedGroup.similarityScore}
        />
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Duplicate Detection</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Find and merge duplicate records in your HubSpot account
          </p>
        </div>

        <Card className="mb-6">
          <CardContent>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Object Type:
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={objectType === 'contact' ? 'primary' : 'secondary'}
                      onClick={() => setObjectType('contact')}
                      disabled={isAnalyzing}
                    >
                      Contacts
                    </Button>
                    <Button
                      variant={objectType === 'company' ? 'primary' : 'secondary'}
                      onClick={() => setObjectType('company')}
                      disabled={isAnalyzing}
                    >
                      Companies
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" onClick={loadGroups} disabled={isLoading || isAnalyzing || isImporting}>
                  Refresh
                </Button>
                <Button variant="secondary" onClick={runImport} isLoading={isImporting} disabled={isAnalyzing}>
                  Import {objectType === 'contact' ? 'Contacts' : 'Companies'}
                </Button>
                <Button variant="primary" onClick={runAnalysis} isLoading={isAnalyzing} disabled={isImporting}>
                  Run Analysis
                </Button>
              </div>
            </div>

            {importStatus && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-300">{importStatus}</p>
              </div>
            )}

            {analysisResult && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-blue-900 dark:text-blue-200 font-medium">Total Records</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {analysisResult.totalRecords}
                    </div>
                  </div>
                  <div>
                    <div className="text-blue-900 dark:text-blue-200 font-medium">Exact Matches</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {analysisResult.exactMatchGroups}
                    </div>
                  </div>
                  <div>
                    <div className="text-blue-900 dark:text-blue-200 font-medium">Fuzzy Matches</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {analysisResult.fuzzyMatchGroups}
                    </div>
                  </div>
                  <div>
                    <div className="text-blue-900 dark:text-blue-200 font-medium">Processing Time</div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {(analysisResult.processingTimeMs / 1000).toFixed(1)}s
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <DataViewer objectType={objectType} />

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Duplicate Groups ({groups.length})</CardTitle>
              {isLoading && <Badge variant="info">Loading...</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 space-y-2">
              <div className="flex flex-wrap items-center justify-between text-sm">
                <div className="font-medium text-gray-900 dark:text-gray-100">Review Progress</div>
                <div className="text-gray-600 dark:text-gray-400">
                  Reviewed: {statusCounts.reviewed} • Merged: {statusCounts.merged} • Total: {totalCount}
                </div>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                <div
                  className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Processed {processedCount} of {totalCount} groups
              </div>
            </div>

            {groups.length === 0 && !isLoading ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p className="text-lg mb-2">No duplicate groups found</p>
                <p className="text-sm">Run an analysis to find duplicates</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="mb-6 flex gap-4 items-center flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'confidence' | 'recordCount')}
                      className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="confidence">Highest Confidence First</option>
                      <option value="recordCount">Most Records First</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</label>
                    <div className="flex gap-2">
                      {confidenceFilters.map(({ level, label }) => {
                        const isActive = filterConfidence === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setFilterConfidence(level)}
                            aria-pressed={isActive}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500 ${
                              isActive
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            {`${label}${level === 'all' ? ' Groups' : ' Confidence'} (${confidenceCounts[level]})`}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="ml-auto flex flex-wrap items-center gap-3">
                    <div>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by name, email, or company"
                        className="w-64 max-w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {filteredGroups.length} of {groups.length} groups
                    </div>
                  </div>
                </div>

                {filteredGroups.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                    <p className="text-lg">No groups match this search</p>
                  </div>
                ) : (
                  sortedGroups.map((group) => {
                    const isContact = group.type === 'contact';
                    const similarityPercentage = formatSimilarity(group.similarityScore);
                    const topFields = getTopContributingFields(group.fieldScores, group.matchedFields);
                    const duplicateReason = buildDuplicateReasonSentence(topFields);
                    const { borderClass, priorityClass, priorityLabel } = getConfidenceStyles(group.similarityScore);

                    return (
                      <div
                        key={group.id}
                        className={`flex flex-col gap-3 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm bg-white dark:bg-gray-800 hover:shadow-md transition-all cursor-pointer ${borderClass}`}
                        onClick={() => setSelectedGroup(group)}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${priorityClass}`}>
                                {priorityLabel}
                              </span>
                              <Badge variant="default">Group ID: {group.id}</Badge>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {group.records.length} Duplicate Records · {similarityPercentage}% Match
                            </div>
                            <div className="flex gap-2 items-center flex-wrap">
                              <TooltipBadge
                                variant="info"
                                tooltip="Overall similarity based on matching fields. Higher percentages indicate more identical data between these records."
                              >
                                {similarityPercentage}% Match
                              </TooltipBadge>

                              <TooltipBadge
                                variant={getConfidenceBadgeVariant(group.similarityScore)}
                                tooltip={
                                  group.similarityScore >= 0.95
                                    ? 'High confidence: 95%+ match. These records are very likely duplicates.'
                                    : group.similarityScore >= 0.85
                                    ? 'Medium confidence: 85-94% match. Review carefully before merging.'
                                    : 'Low confidence: <85% match. May be false positives - verify before merging.'
                                }
                              >
                                {group.similarityScore >= 0.95
                                  ? 'High'
                                  : group.similarityScore >= 0.85
                                  ? 'Medium'
                                  : 'Low'}{' '}
                                Confidence
                              </TooltipBadge>

                              <Badge variant="default">{group.records.length} Records</Badge>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={getConfidenceBadgeVariant(group.similarityScore)}>{similarityPercentage}% Confidence</Badge>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroup(group);
                              }}
                            >
                              Review →
                            </Button>
                          </div>
                        </div>

                        {/* Show key fields for each record */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                          {group.records.slice(0, 3).map((record, idx) => (
                            <div
                              key={idx}
                              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2"
                            >
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                Record {idx + 1}
                              </div>
                              {isContact ? (
                                <div className="space-y-1 text-xs">
                                  {record.first_name || record.last_name ? (
                                    <div className="font-medium text-gray-900 dark:text-white truncate">
                                      {record.first_name} {record.last_name}
                                    </div>
                                  ) : null}
                                  {record.email && (
                                    <div className="text-gray-600 dark:text-gray-400 truncate">
                                      📧 {record.email as string}
                                    </div>
                                  )}
                                  {record.company && (
                                    <div className="text-gray-600 dark:text-gray-400 truncate">
                                      🏢 {record.company as string}
                                    </div>
                                  )}
                                  {record.job_title && (
                                    <div className="text-gray-600 dark:text-gray-400 truncate">
                                      💼 {record.job_title as string}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1 text-xs">
                                  {record.name && (
                                    <div className="font-medium text-gray-900 dark:text-white truncate">
                                      {record.name as string}
                                    </div>
                                  )}
                                  {record.domain && (
                                    <div className="text-gray-600 dark:text-gray-400 truncate">
                                      🌐 {record.domain as string}
                                    </div>
                                  )}
                                  {record.phone && (
                                    <div className="text-gray-600 dark:text-gray-400 truncate">
                                      📱 {record.phone as string}
                                    </div>
                                  )}
                                  {record.city && record.state && (
                                    <div className="text-gray-600 dark:text-gray-400 truncate">
                                      📍 {record.city as string}, {record.state as string}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          {group.records.length > 3 && (
                            <div className="flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                              +{group.records.length - 3} more
                            </div>
                          )}
                        </div>

                        <div className="mt-3 mb-2">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Why these might be duplicates:
                          </div>
                          {/* Render the human-readable reason */}
                          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{duplicateReason}</p>
                          
                          <div className="flex flex-wrap gap-1.5">
                            {topFields.slice(0, 5).map((field) => (
                              <span
                                key={field.field}
                                className="inline-flex items-center px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800"
                              >
                                {formatFieldName(field.field)} • {Math.round(field.score)}%
                              </span>
                            ))}
                            {topFields.length > 5 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                                +{topFields.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                          Group ID: {group.id}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}