import { BrowserWindow } from 'electron';
import { requireHubSpotClient } from './auth';
import { ContactRepository, CompanyRepository, ImportBatchRepository } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { IPC_CHANNELS } from '../../shared/ipcChannels';

/**
 * HubSpot data import operations
 * Fetches contacts/companies from HubSpot and stores them in the local database
 */

/**
 * Emit import progress update to renderer via IPC
 */
function emitImportProgress(
  objectType: 'contact' | 'company',
  fetched: number,
  saved: number,
  isComplete: boolean
) {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(win => {
    win.webContents.send(IPC_CHANNELS.PROGRESS_UPDATE, {
      type: 'import',
      stage: isComplete ? 'Complete' : 'Importing',
      current: saved,
      total: fetched,
      objectType,
      message: `Imported ${saved} of ${fetched} ${objectType}s`,
    });
  });
}

export interface ImportProgress {
  batchId: string;
  objectType: 'contact' | 'company';
  totalFetched: number;
  totalSaved: number;
  isComplete: boolean;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  batchId: string;
  objectType: 'contact' | 'company';
  totalFetched: number;
  totalSaved: number;
  error?: string;
}

/**
 * Import contacts from HubSpot
 */
export async function importContacts(
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const batchId = uuidv4();
  let totalFetched = 0;
  let totalSaved = 0;

  console.log('=== Starting Contact Import ===');
  console.log(`Batch ID: ${batchId}`);

  try {
    const client = requireHubSpotClient();

    // Create import batch record
    ImportBatchRepository.create({
      batch_id: batchId,
      object_type: 'contact',
      total_count: 0,
      success_count: 0,
      error_count: 0,
      status: 'in_progress',
    });

    // Fetch all contacts with pagination
    const properties = [
      'firstname',
      'lastname',
      'email',
      'phone',
      'company',
      'jobtitle',
      'createdate',
      'lastmodifieddate',
    ];

    const toNullableString = (value: unknown): string | null => {
      if (value === undefined || value === null) return null;
      return String(value);
    };

    for await (const batch of client.fetchAllContacts(properties)) {
      console.log(`Fetched batch of ${batch.length} contacts`);
      totalFetched += batch.length;

      // Save contacts to database
      for (const contact of batch) {
        const contactData = contact as any;

        try {
          // Log first contact structure (safely)
          if (totalSaved === 0 && totalFetched <= 100) {
            console.log('First contact ID:', contactData.id);
            console.log('First contact has properties:', !!contactData.properties);
            console.log('Sample property keys:', Object.keys(contactData.properties || {}).slice(0, 5));
          }

          const hsId = toNullableString(contactData.id);

          if (!hsId) {
            console.error('Contact missing ID');
            continue;
          }

          // Fix: Ensure all fields are explicitly string, number, or null. No undefined. No Objects.
          const contactToSave = {
            hs_id: hsId,
            first_name: toNullableString(contactData.properties?.firstname),
            last_name: toNullableString(contactData.properties?.lastname),
            email: toNullableString(contactData.properties?.email),
            phone: toNullableString(contactData.properties?.phone),
            company: toNullableString(contactData.properties?.company),
            job_title: toNullableString(contactData.properties?.jobtitle),
            // Ensure dates are primitives or null
            created_at: toNullableString(
              contactData.createdAt ?? contactData.properties?.createdate
            ),
            updated_at: toNullableString(
              contactData.updatedAt ?? contactData.properties?.lastmodifieddate
            ),
            // Fix the specific bug: Ensure properties is a JSON string or null
            properties: contactData.properties ? JSON.stringify(contactData.properties) : null,
          };

          if (totalSaved === 0) {
            console.log('Attempting to save first contact:', { hs_id: contactToSave.hs_id, email: contactToSave.email });
          }

          ContactRepository.upsert(contactToSave);

          if (totalSaved === 0) {
            console.log('First contact saved successfully!');
          }

          totalSaved++;
        } catch (error) {
          console.error(`Failed to save contact ${contactData.id}`);
          if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
          }
        }
      }

      // Emit progress via IPC
      emitImportProgress('contact', totalFetched, totalSaved, false);

      // Report progress
      if (onProgress) {
        onProgress({
          batchId,
          objectType: 'contact',
          totalFetched,
          totalSaved,
          isComplete: false,
        });
      }

      console.log(`Progress: ${totalFetched} fetched, ${totalSaved} saved`);
    }

    // Emit completion progress via IPC
    emitImportProgress('contact', totalFetched, totalSaved, true);

    // Update batch record
    ImportBatchRepository.update(batchId, {
      total_count: totalFetched,
      success_count: totalSaved,
      error_count: totalFetched - totalSaved,
      status: 'completed',
    });

    console.log('=== Contact Import Complete ===');
    console.log(`Total fetched: ${totalFetched}`);
    console.log(`Total saved: ${totalSaved}`);

    return {
      success: true,
      batchId,
      objectType: 'contact',
      totalFetched,
      totalSaved,
    };
  } catch (error) {
    console.error('=== Contact Import Failed ===');
    console.error(error);

    // Update batch record with error
    ImportBatchRepository.update(batchId, {
      total_count: totalFetched,
      success_count: totalSaved,
      error_count: totalFetched - totalSaved,
      status: 'failed',
      metadata: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
    });

    return {
      success: false,
      batchId,
      objectType: 'contact',
      totalFetched,
      totalSaved,
      error: error instanceof Error ? error.message : 'Import failed',
    };
  }
}

/**
 * Import companies from HubSpot
 */
export async function importCompanies(
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const batchId = uuidv4();
  let totalFetched = 0;
  let totalSaved = 0;

  console.log('=== Starting Company Import ===');
  console.log(`Batch ID: ${batchId}`);

  try {
    const client = requireHubSpotClient();

    // Create import batch record
    ImportBatchRepository.create({
      batch_id: batchId,
      object_type: 'company',
      total_count: 0,
      success_count: 0,
      error_count: 0,
      status: 'in_progress',
    });

    // Fetch all companies with pagination
    const properties = [
      'name',
      'domain',
      'phone',
      'city',
      'state',
      'country',
      'industry',
      'createdate',
      'hs_lastmodifieddate',
    ];

    for await (const batch of client.fetchAllCompanies(properties)) {
      console.log(`Fetched batch of ${batch.length} companies`);
      totalFetched += batch.length;

      // Save companies to database
      for (const company of batch) {
        const companyData = company as any;

        try {
          // Log first company structure (safely)
          if (totalSaved === 0 && totalFetched <= 100) {
            console.log('First company ID:', companyData.id);
            console.log('First company has properties:', !!companyData.properties);
            console.log('Sample property keys:', Object.keys(companyData.properties || {}).slice(0, 5));
          }

          const hsId = String(companyData.id || '');

          if (!hsId) {
            console.error('Company missing ID');
            continue;
          }

          CompanyRepository.upsert({
            hs_id: hsId,
            name: companyData.properties?.name || null,
            domain: companyData.properties?.domain || null,
            phone: companyData.properties?.phone || null,
            city: companyData.properties?.city || null,
            state: companyData.properties?.state || null,
            country: companyData.properties?.country || null,
            industry: companyData.properties?.industry || null,
            created_at: companyData.createdAt || companyData.properties?.createdate || null,
            updated_at: companyData.updatedAt || companyData.properties?.hs_lastmodifieddate || null,
            properties: companyData.properties ? JSON.stringify(companyData.properties) : null,
          });
          totalSaved++;
        } catch (error) {
          console.error(`Failed to save company ${companyData.id}`);
          if (error instanceof Error) {
            console.error('Error message:', error.message);
          }
        }
      }

      // Emit progress via IPC
      emitImportProgress('company', totalFetched, totalSaved, false);

      // Report progress
      if (onProgress) {
        onProgress({
          batchId,
          objectType: 'company',
          totalFetched,
          totalSaved,
          isComplete: false,
        });
      }

      console.log(`Progress: ${totalFetched} fetched, ${totalSaved} saved`);
    }

    // Emit completion progress via IPC
    emitImportProgress('company', totalFetched, totalSaved, true);

    // Update batch record
    ImportBatchRepository.update(batchId, {
      total_count: totalFetched,
      success_count: totalSaved,
      error_count: totalFetched - totalSaved,
      status: 'completed',
    });

    console.log('=== Company Import Complete ===');
    console.log(`Total fetched: ${totalFetched}`);
    console.log(`Total saved: ${totalSaved}`);

    return {
      success: true,
      batchId,
      objectType: 'company',
      totalFetched,
      totalSaved,
    };
  } catch (error) {
    console.error('=== Company Import Failed ===');
    console.error(error);

    // Update batch record with error
    ImportBatchRepository.update(batchId, {
      total_count: totalFetched,
      success_count: totalSaved,
      error_count: totalFetched - totalSaved,
      status: 'failed',
      metadata: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
    });

    return {
      success: false,
      batchId,
      objectType: 'company',
      totalFetched,
      totalSaved,
      error: error instanceof Error ? error.message : 'Import failed',
    };
  }
}
