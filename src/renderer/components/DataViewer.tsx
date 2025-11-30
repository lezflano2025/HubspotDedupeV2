import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { Button } from './Button';
import type { ContactData, CompanyData } from '../../shared/types';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
  const [showProperties, setShowProperties] = useState(false);

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

  useEffect(() => {
    setShowProperties(false);
  }, [selectedRecord]);

  const renderPropertiesSection = (properties: Record<string, unknown>) => {
    const entries = Object.entries(properties);

    if (entries.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            All Properties ({entries.length})
          </h5>
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setShowProperties((prev) => !prev)}
          >
            {showProperties ? 'Hide' : 'Show'}
            {showProperties ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {showProperties ? (
            <div className="max-h-48 overflow-y-auto p-3">
              <div className="grid grid-cols-1 gap-2 text-xs">
                {entries.map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300 min-w-[150px]">{key}:</span>
                    <span className="text-gray-600 dark:text-gray-400 break-all">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 text-xs text-gray-500 dark:text-gray-400">Expand to view all properties.</div>
          )}
        </div>
      </div>
    );
  };

  const renderContactDetails = (contact: ContactData) => {
    const properties = parseProperties(contact.properties);
    const propertyCount = Object.keys(properties).length;

    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Core Info</h5>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
        </div>

        <div className="space-y-3">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Metadata</h5>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">HubSpot ID</label>
              <p className="text-sm text-gray-900 dark:text-white font-mono">{contact.hs_id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Imported At</label>
              <p className="text-sm text-gray-900 dark:text-white">
                {new Date(contact.imported_at).toLocaleString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Property Count</label>
              <p className="text-sm text-gray-900 dark:text-white">{propertyCount}</p>
            </div>
          </div>
        </div>

        {renderPropertiesSection(properties)}
      </div>
    );
  };

  const renderCompanyDetails = (company: CompanyData) => {
    const properties = parseProperties(company.properties);
    const propertyCount = Object.keys(properties).length;

    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Core Info</h5>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
        </div>

        <div className="space-y-3">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Metadata</h5>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">HubSpot ID</label>
              <p className="text-sm text-gray-900 dark:text-white font-mono">{company.hs_id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Imported At</label>
              <p className="text-sm text-gray-900 dark:text-white">
                {new Date(company.imported_at).toLocaleString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Property Count</label>
              <p className="text-sm text-gray-900 dark:text-white">{propertyCount}</p>
            </div>
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
