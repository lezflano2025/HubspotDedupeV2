import React from 'react';
import { Button } from './Button';
import type { MergePreview } from '../../shared/types';

interface Props {
  preview: MergePreview;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function MergePreviewModal({ preview, onConfirm, onCancel, isLoading }: Props) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Merge Preview
          </h2>

          <div className="mb-4">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Records to be merged:
            </h3>
            <ul className="space-y-2">
              {preview.recordsToMerge.map((record) => (
                <li
                  key={record.hsId}
                  className="p-2 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <div className="font-medium">{record.displayName}</div>
                  <div className="text-sm text-gray-500">ID: {record.hsId}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
              What will happen:
            </h3>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
              {preview.estimatedChanges.map((change, i) => (
                <li key={i}>{change}</li>
              ))}
            </ul>
          </div>

          {preview.warnings.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                ⚠️ Warnings
              </h3>
              <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300">
                {preview.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onConfirm} isLoading={isLoading}>
              Confirm Merge
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
