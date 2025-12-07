import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Restrict CORS to allowed origins
const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const searchRequestSchema = z.object({
  booleanString: z.string()
    .min(1, "Search query cannot be empty")
    .max(300, "Search query must be under 300 characters")
    .regex(/^[a-zA-Z0-9\s"()ANDORNOT\-@.]+$/, "Search query contains invalid characters")
});

interface SearchRequest {
  booleanString: string;
}

// Helper function to calculate years of experience
const calculateYearsOfExperience = (experience: any[]): number => {
  if (!experience || experience.length === 0) return 0;
  return Math.min(experience.length * 2, 20);
};

// Helper function to extract photo URL from various formats
const extractPhotoUrl = (photoData: any): string | null => {
  if (!photoData) return null;
  
  // Handle nested object structures
  if (typeof photoData === 'object') {
    return photoData.url || photoData.photoUrl || photoData.image || null;
  }
  
  // Handle string URLs
  if (typeof photoData === 'string') {
    return photoData;
  }
  
  return null;
};

// Helper function to extract current position and company from experience
const extractCurrentRole = (item: any) => {
  let position = item.position || item.title || item.currentTitle || item.jobTitle || '';
  let company = item.company || item.currentCompany || item.companyName || '';
  
  // If not found at top level, check first experience entry
  if ((!position || !company) && item.experience && Array.isArray(item.experience) && item.experience.length > 0) {
    const currentExp = item.experience[0];
    if (!position) position = currentExp.title || currentExp.position || currentExp.jobTitle || '';
    if (!company) company = currentExp.companyName || currentExp.company || '';
  }
  
  return { position, company };
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client for rate limiting
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit (10 searches per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: rateLimitData } = await supabase
      .from('search_rate_limit')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (rateLimitData) {
      const windowStart = new Date(rateLimitData.window_start);
      if (windowStart > new Date(oneHourAgo)) {
        if (rateLimitData.search_count >= 10) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // Increment count
        await supabase
          .from('search_rate_limit')
          .update({ search_count: rateLimitData.search_count + 1 })
          .eq('user_id', user.id);
      } else {
        // Reset window
        await supabase
          .from('search_rate_limit')
          .update({ search_count: 1, window_start: new Date().toISOString() })
          .eq('user_id', user.id);
      }
    } else {
      // Create new rate limit entry
      await supabase
        .from('search_rate_limit')
        .insert({ user_id: user.id, search_count: 1 });
    }

    const apiToken = Deno.env.get("APIFY_API_TOKEN");
    const actorId = Deno.env.get("APIFY_ACTOR_ID");

    if (!apiToken || !actorId) {
      console.error("API configuration missing");
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody: SearchRequest = await req.json();
    
    // Validate input
    const validation = searchRequestSchema.safeParse(requestBody);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid search query", 
          details: validation.error.errors[0].message 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { booleanString } = validation.data;

    // Build input for Apify
    const input: any = {
      searchQuery: booleanString,
      maxItems: 25,
      profileScraperMode: "Full",
      startPage: 1,
    };

    // Call Apify API
    const runResponse = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      console.error(`Apify API error: ${runResponse.status}`);
      throw new Error(`Failed to start search: ${runResponse.statusText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    const defaultDatasetId = runData.data.defaultDatasetId;

    // Poll for completion
    const maxWaitTime = 120000;
    const pollInterval = 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${apiToken}` },
      });

      const statusData = await statusResponse.json();
      const status = statusData.data.status;

      if (status === 'SUCCEEDED') {
        break;
      } else if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        throw new Error(`Search ${status.toLowerCase()}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    if (Date.now() - startTime >= maxWaitTime) {
      throw new Error('Search timeout');
    }

    // Fetch results
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${defaultDatasetId}/items`,
      { headers: { 'Authorization': `Bearer ${apiToken}` } }
    );

    if (!resultsResponse.ok) {
      throw new Error(`Failed to fetch results: ${resultsResponse.statusText}`);
    }

    const items = await resultsResponse.json();

    // Transform results - minimal logging
    console.log(`Search completed: ${items.length} results found`);

    const transformedCandidates = items.map((item: any, index: number) => {
      const photoUrl = extractPhotoUrl(item.photoUrl || item.profilePictureUrl || item.profilePicture);
      
      const linkedInUrl = item.url 
        || item.profileUrl 
        || item.linkedInUrl 
        || (item.publicIdentifier ? `https://www.linkedin.com/in/${item.publicIdentifier}` : '')
        || '';
      
      const { position, company } = extractCurrentRole(item);
      
      return {
        id: index,
        fullName: item.fullName || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Unknown',
        headline: item.headline || '',
        location: typeof item.location === 'string' 
          ? item.location 
          : (item.location?.linkedinText || item.location?.parsed || ''),
        photoUrl,
        linkedInUrl,
        currentCompany: company,
        currentPosition: position,
        experience: item.experience || [],
        skills: (item.skills || [])
          .slice(0, 5)
          .map((skill: any) => typeof skill === 'string' ? skill : skill.name || skill),
        summary: item.summary || '',
        yearsOfExperience: calculateYearsOfExperience(item.experience || []),
      };
    });

    return new Response(
      JSON.stringify({ candidates: transformedCandidates, count: transformedCandidates.length }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Search error:', error.message);
    
    const errorMessage = error.message === 'Search timeout' 
      ? 'Search took too long. Please try with more specific criteria.'
      : 'Unable to search. Please try again later.';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
