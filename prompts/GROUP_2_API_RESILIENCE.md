# Claude Code Prompt: Group 2 - API Resilience

## 🎯 Objective

Add retry logic with exponential backoff to HubSpot API calls. Currently, a single API failure stops the entire operation. This improvement will make the tool more resilient to:
- Temporary network issues
- HubSpot API rate limiting (429 errors)
- Transient server errors (5xx)

---

## 📁 Files to Modify

| File | Purpose |
|------|---------|
| `src/main/hubspot/client.ts` | HubSpot API client with Bottleneck rate limiting |
| `src/main/hubspot/merge.ts` | Merge operations (uses client) |
| `src/main/hubspot/import.ts` | Import operations (uses client) |

---

## 📖 Current State

Read these files to understand the current implementation:

1. **`src/main/hubspot/client.ts`** - Contains `HubSpotApiClient` class with:
   - Bottleneck rate limiter (90 req/10s)
   - `rateLimited()` wrapper method
   - Various API methods (`fetchContacts`, `fetchCompanies`, etc.)

2. **`src/main/hubspot/merge.ts`** - Contains:
   - `mergeContacts()` - loops through secondary IDs and merges one by one
   - `mergeCompanies()` - same pattern
   - `executeMerge()` - orchestrates the merge operation

---

## 🔧 Implementation Steps

### Step 1: Add Retry Utility to Client

Add a `withRetry` method to the `HubSpotApiClient` class in `src/main/hubspot/client.ts`:

```typescript
export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

// Add this method to HubSpotApiClient class
/**
 * Execute an operation with exponential backoff retry
 * Retries on network errors and specified HTTP status codes
 */
async withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry = this.isRetryableError(error, config.retryableStatusCodes);

      if (!shouldRetry || attempt === config.maxRetries) {
        console.error(`API call failed after ${attempt + 1} attempts:`, lastError.message);
        throw lastError;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
      const delay = Math.min(exponentialDelay + jitter, config.maxDelayMs);

      console.log(
        `API call failed (attempt ${attempt + 1}/${config.maxRetries + 1}). ` +
        `Retrying in ${Math.round(delay)}ms... Error: ${lastError.message}`
      );

      await this.sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Check if an error is retryable
 */
private isRetryableError(error: unknown, retryableStatusCodes: number[]): boolean {
  // Network errors are always retryable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('etimedout') ||
      message.includes('socket hang up')
    ) {
      return true;
    }
  }

  // Check for HTTP status codes in error
  const statusCode = this.extractStatusCode(error);
  if (statusCode && retryableStatusCodes.includes(statusCode)) {
    return true;
  }

  // Don't retry client errors (4xx except 429)
  if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
    return false;
  }

  return false;
}

/**
 * Extract HTTP status code from error if available
 */
private extractStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;

  // HubSpot API client errors typically have response.status
  const err = error as Record<string, unknown>;

  if (err.statusCode && typeof err.statusCode === 'number') {
    return err.statusCode;
  }

  if (err.status && typeof err.status === 'number') {
    return err.status;
  }

  if (err.response && typeof err.response === 'object') {
    const response = err.response as Record<string, unknown>;
    if (response.status && typeof response.status === 'number') {
      return response.status;
    }
    if (response.statusCode && typeof response.statusCode === 'number') {
      return response.statusCode;
    }
  }

  // Check error message for status code patterns
  if (err.message && typeof err.message === 'string') {
    const match = err.message.match(/\b(4\d{2}|5\d{2})\b/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Sleep utility
 */
private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Step 2: Expose Retry Method

Make sure the `withRetry` method is accessible from outside the class. You can either:

**Option A:** Make it a public method (already done above)

**Option B:** Create a standalone utility and import it:

```typescript
// src/main/hubspot/retry.ts
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  // ... implementation
}
```

### Step 3: Update Merge Operations

Modify `src/main/hubspot/merge.ts` to use retry logic:

```typescript
import { requireHubSpotClient } from './auth';
// ... other imports

/**
 * Merge contacts in HubSpot with retry logic
 */
async function mergeContacts(primaryId: string, secondaryIds: string[]): Promise<void> {
  const client = requireHubSpotClient();

  for (const secondaryId of secondaryIds) {
    console.log(`Merging contact ${secondaryId} into ${primaryId}...`);

    await client.withRetry(
      async () => {
        await client.getClient().crm.contacts.basicApi.merge({
          objectIdToMerge: secondaryId,
          primaryObjectId: primaryId,
        });
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000, // Start with 2s for merge operations
      }
    );

    console.log(`Successfully merged contact ${secondaryId} into ${primaryId}`);
  }
}

/**
 * Merge companies in HubSpot with retry logic
 */
async function mergeCompanies(primaryId: string, secondaryIds: string[]): Promise<void> {
  const client = requireHubSpotClient();

  for (const secondaryId of secondaryIds) {
    console.log(`Merging company ${secondaryId} into ${primaryId}...`);

    await client.withRetry(
      async () => {
        await client.getClient().crm.companies.basicApi.merge({
          objectIdToMerge: secondaryId,
          primaryObjectId: primaryId,
        });
      },
      {
        maxRetries: 3,
        baseDelayMs: 2000,
      }
    );

    console.log(`Successfully merged company ${secondaryId} into ${primaryId}`);
  }
}
```

### Step 4: Update Import Operations (Optional Enhancement)

Modify `src/main/hubspot/import.ts` to use retry for pagination:

```typescript
// In importContacts function, wrap the generator consumption
for await (const batch of client.fetchAllContacts(properties)) {
  // This already goes through rateLimited(), but for extra resilience:
  // The fetchAllContacts generator itself handles pagination
  // We could add retry at the batch level if needed
}
```

For the import, the main place to add retry is in the `fetchContacts` and `fetchCompanies` methods in `client.ts`:

```typescript
async fetchContacts(options?: {
  limit?: number;
  after?: string;
  properties?: string[];
}): Promise<{ results: unknown[]; paging?: { next?: { after: string } } }> {
  return this.withRetry(
    () => this.rateLimited(async () => {
      const response = await this.client.crm.contacts.basicApi.getPage(
        options?.limit || 100,
        options?.after,
        options?.properties,
        undefined,
        undefined,
        false
      );
      return response as { results: unknown[]; paging?: { next?: { after: string } } };
    }),
    { maxRetries: 3 }
  );
}
```

### Step 5: Add Rate Limit Specific Handling

For 429 (rate limit) errors, respect the `Retry-After` header if provided:

```typescript
private async handleRateLimitError(error: unknown): Promise<number> {
  if (!error || typeof error !== 'object') return 0;

  const err = error as Record<string, unknown>;

  // Check for Retry-After header in response
  if (err.response && typeof err.response === 'object') {
    const response = err.response as Record<string, unknown>;
    const headers = response.headers as Record<string, string> | undefined;

    if (headers?.['retry-after']) {
      const retryAfter = parseInt(headers['retry-after'], 10);
      if (!isNaN(retryAfter)) {
        console.log(`Rate limited. Waiting ${retryAfter} seconds as requested by server.`);
        return retryAfter * 1000;
      }
    }
  }

  return 0; // Use default backoff
}
```

---

## ✅ Acceptance Criteria

### Retry Logic
- [ ] Failed API calls are retried up to 3 times
- [ ] Delay doubles between retries (exponential backoff)
- [ ] Jitter is added to prevent thundering herd
- [ ] Maximum delay is capped at 30 seconds

### Error Handling
- [ ] 429 (rate limit) errors are retried
- [ ] 5xx (server) errors are retried
- [ ] 4xx (client) errors are NOT retried (except 429)
- [ ] Network errors (ECONNRESET, etc.) are retried
- [ ] Final error is thrown after all retries exhausted

### Logging
- [ ] Each retry attempt is logged with attempt number and delay
- [ ] Final failure is logged with total attempts made
- [ ] Success after retry is logged normally

### Integration
- [ ] `npm run build` completes without errors
- [ ] Merge operations use retry logic
- [ ] Import operations use retry logic
- [ ] Existing functionality is not broken

---

## 🧪 Testing Suggestions

### Manual Testing

1. **Simulate network failure:**
   - Disconnect network briefly during import
   - Verify retry attempts in console
   - Reconnect and verify operation completes

2. **Test with rate limiting:**
   - Make many rapid API calls
   - Observe retry behavior on 429 errors

3. **Test error propagation:**
   - Use invalid API key
   - Verify 401 error is NOT retried and fails fast

### Mock Testing (if adding unit tests)

```typescript
// Example test case
describe('withRetry', () => {
  it('should retry on 500 error and succeed', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) {
        const error = new Error('Internal Server Error');
        (error as any).statusCode = 500;
        throw error;
      }
      return 'success';
    };

    const result = await client.withRetry(operation);
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should not retry on 400 error', async () => {
    const operation = async () => {
      const error = new Error('Bad Request');
      (error as any).statusCode = 400;
      throw error;
    };

    await expect(client.withRetry(operation)).rejects.toThrow('Bad Request');
  });
});
```

---

## 📝 Architecture Notes

### Why Exponential Backoff?

```
Attempt 1: Immediate
Attempt 2: ~1 second delay
Attempt 3: ~2 seconds delay
Attempt 4: ~4 seconds delay (if maxRetries=4)
```

This pattern:
- Gives transient issues time to resolve
- Reduces load on failing services
- Works well with rate limiting

### Why Jitter?

Without jitter, if multiple clients retry at the same time, they'll all retry together causing another spike. Jitter spreads retries over time:

```
Client A: retry at 1.1s
Client B: retry at 1.3s
Client C: retry at 0.9s
```

### Integration with Bottleneck

The `withRetry` wraps `rateLimited`, not the other way around:

```typescript
withRetry(() => rateLimited(() => apiCall()))
```

This means:
1. Retry logic handles failures
2. Rate limiter ensures we don't exceed API limits
3. Both work together for resilient API calls

---

## 🚀 When Done

1. Run `npm run build` to verify no TypeScript errors
2. Test with `npm run dev`
3. Trigger some API calls and observe retry logging
4. Test error scenarios (invalid credentials, rate limits)
5. Commit with message: `feat: add retry with exponential backoff for HubSpot API calls`

---

## ⚠️ Important Considerations

1. **Idempotency**: Merge operations in HubSpot are idempotent - retrying a merge that partially succeeded is safe.

2. **Timeout**: Consider adding an overall timeout for operations that retry too many times.

3. **Circuit Breaker**: For future improvement, consider adding a circuit breaker pattern to avoid overwhelming a struggling service.

4. **Metrics**: In production, you'd want to track retry rates and success rates for observability.
