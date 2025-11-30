import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Button } from './Button';
import type { ContactData, CompanyData } from '../../shared/types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SYSTEM_PROPERTY_KEYS } from '../../shared/systemProperties';

interface DataViewerProps {
  objectType: 'contact' | 'company';
}

export function DataViewer({ objectType }: DataViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactData[]>([]);
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ContactData | CompanyData | null>(null);
  const [showSystemProperties, setShowSystemProperties] = useState(false);

  const systemPropertyKeySet = useMemo(
    () => new Set(Array.from(SYSTEM_PROPERTY_KEYS).map((key) => key.toLowerCase())),
    []
  );

  const storageKey = useMemo(() => `showSystemProperties:${objectType}`, [objectType]);

  useEffect(() => {
    const storedPreference = window.localStorage.getItem(storageKey);
    setShowSystemProperties(storedPreference === 'true');
  }, [storageKey]);

  const toggleSystemProperties = useCallback(() => {
    setShowSystemProperties((prev) => {
      const next = !prev;
      window.localStorage.setItem(storageKey, String(next));
      return next;
    });
  }, [storageKey]);

  // Load count on mount and when objectType changes
  useEffect(() => {
    loadCount();
  }, [objectType]);

  // Load full data when opened
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, objectType]);

  const loadCount = async () => {
    try {
      if (objectType === 'contact') {
        const result = await window.api.getContacts(1, 0);
        setTotalCount(result.count);
      } else {
        const result = await window.api.getCompanies(1, 0);
        setTotalCount(result.count);
      }
    } catch (error) {
      console.error('Failed to load count:', error);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (objectType === 'contact') {
        const result = await window.api.getContacts(100, 0);
        setContacts(result.contacts);
        setTotalCount(result.count);
      } else {
        const result = await window.api.getCompanies(100, 0);
        setCompanies(result.companies);
        setTotalCount(result.count);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const parseProperties = (propertiesJson?: string | null): Record<string, unknown> => {
    if (!propertiesJson) return {};
    try {
      return JSON.parse(propertiesJson);
    } catch {
      return {};
    }
  };

  const renderPropertiesSection = (properties: Record<string, unknown>) => {
    if (Object.keys(properties).length === 0) return null;

    const allEntries = Object.entries(properties);
    const visibleEntries = allEntries.filter(
      ([key]) => showSystemProperties || !systemPropertyKeySet.has(key.toLowerCase())
    );
    const hiddenSystemCount = allEntries.length - visibleEntries.length;

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
            All Properties ({allEntries.length})
          </label>
          {hiddenSystemCount > 0 && (
            <Button variant="secondary" size="sm" onClick={toggleSystemProperties}>
              {showSystemProperties
                ? 'Hide system properties'
                : `Show system properties (${hiddenSystemCount})`}
            </Button>
          )}
        </div>
        {!showSystemProperties && hiddenSystemCount > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            System properties are hidden from view. Toggle to reveal them.
          </p>
        )}
        <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 max-h-64 overflow-y-auto">
          {visibleEntries.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No non-system properties to display.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 text-xs">
              {visibleEntries.map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[150px]">{key}:</span>
                  <span className="text-gray-600 dark:text-gray-400 break-all">{String(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderContactDetails = (contact: ContactData) => {
    const properties = parseProperties(contact.properties);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">HubSpot ID</label>
            <p className="text-sm text-gray-900 dark:text-white font-mono">{contact.hs_id}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</label>
            <p className="text-sm text-gray-900 dark:text-white">{contact.email || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">First Name</label>
            <p className="text-sm text-gray-900 dark:text-white">{contact.first_name || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Last Name</label>
            <p className="text-sm text-gray-900 dark:text-white">{contact.last_name || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone</label>
            <p className="text-sm text-gray-900 dark:text-white">{contact.phone || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Company</label>
            <p className="text-sm text-gray-900 dark:text-white">{contact.company || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Job Title</label>
            <p className="text-sm text-gray-900 dark:text-white">{contact.job_title || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Imported At</label>
            <p className="text-sm text-gray-900 dark:text-white">
              {new Date(contact.imported_at).toLocaleString()}
            </p>
          </div>
        </div>

        {renderPropertiesSection(properties)}
      </div>
    );
  };

  const renderCompanyDetails = (company: CompanyData) => {
    const properties = parseProperties(company.properties);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">HubSpot ID</label>
            <p className="text-sm text-gray-900 dark:text-white font-mono">{company.hs_id}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Name</label>
            <p className="text-sm text-gray-900 dark:text-white">{company.name || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Domain</label>
            <p className="text-sm text-gray-900 dark:text-white">{company.domain || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Phone</label>
            <p className="text-sm text-gray-900 dark:text-white">{company.phone || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">City</label>
            <p className="text-sm text-gray-900 dark:text-white">{company.city || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">State</label>
            <p className="text-sm text-gray-900 dark:text-white">{company.state || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Country</label>
            <p className="text-sm text-gray-900 dark:text-white">{company.country || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Industry</label>
            <p className="text-sm text-gray-900 dark:text-white">{company.industry || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Imported At</label>
            <p className="text-sm text-gray-900 dark:text-white">
              {new Date(company.imported_at).toLocaleString()}
            </p>
          </div>
        </div>

        {renderPropertiesSection(properties)}
      </div>
    );
  };

  const records = objectType === 'contact' ? contacts : companies;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <CardTitle>
            Imported {objectType === 'contact' ? 'Contacts' : 'Companies'} ({totalCount})
          </CardTitle>
          <Button variant="secondary" size="sm">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No {objectType === 'contact' ? 'contacts' : 'companies'} imported yet
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Records List */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Records (showing {Math.min(100, totalCount)} of {totalCount})
                  </h4>
                  <div className="space-y-2">
                    {records.map((record) => {
                      const displayName =
                        objectType === 'contact'
                          ? `${(record as ContactData).first_name || ''} ${
                              (record as ContactData).last_name || ''
                            }`.trim() || (record as ContactData).email || 'Unnamed Contact'
                          : (record as CompanyData).name || 'Unnamed Company';

                      return (
                        <div
                          key={record.id}
                          className={`p-3 rounded cursor-pointer transition-colors ${
                            selectedRecord?.id === record.id
                              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700'
                              : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750'
                          }`}
                          onClick={() => setSelectedRecord(record)}
                        >
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {displayName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            ID: {record.hs_id}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Record Details */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
                  {selectedRecord ? (
                    <>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        {objectType === 'contact' ? 'Contact' : 'Company'} Details
                      </h4>
                      {objectType === 'contact'
                        ? renderContactDetails(selectedRecord as ContactData)
                        : renderCompanyDetails(selectedRecord as CompanyData)}
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      Select a record to view details
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
