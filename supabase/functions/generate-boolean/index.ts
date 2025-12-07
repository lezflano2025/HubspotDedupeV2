import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a Boolean String Assistant specializing in creating optimized search strings for recruiting and talent sourcing.

Your task is to generate platform-specific boolean search strings based on user input.

RULES:
1. Generate boolean strings that are under 300 characters when possible
2. Use proper boolean operators: AND, OR, NOT, parentheses, quotation marks for exact phrases
3. Be concise - prioritize the most important terms
4. For LinkedIn: focus on title variations, skills, and avoid overly complex strings
5. For Google: include "site:linkedin.com/in" prefix
6. For GitHub: focus on technical skills and programming languages
7. Always infer related job titles and alternative skill names

OUTPUT FORMAT:
You must respond with a JSON object containing:
{
  "normalized_role": "the standardized job title",
  "inferred_seniority": "Junior/Mid/Senior/Lead/Director/VP/Any",
  "skills": ["array of inferred skills"],
  "alternative_titles": ["array of related job titles"],
  "boolean_strings": {
    "linkedin": "boolean string optimized for LinkedIn search",
    "google": "boolean string with site:linkedin.com/in prefix",
    "github": "boolean string for GitHub/X-Ray search",
    "generic": "general boolean string for any platform"
  },
  "search_tips": "brief tips for this specific search"
}

Only output valid JSON, no markdown formatting or code blocks.`;

interface SimpleRequest {
  mode: "simple";
  hiring_sentence: string;
}

interface AdvancedRequest {
  mode: "advanced";
  role: string;
  seniority?: string;
  locations?: string[];
  must_have_skills?: string[];
  nice_to_have_skills?: string[];
  exclude_terms?: string[];
  employment_type?: string;
  target_platforms?: string[];
}

type BooleanRequest = SimpleRequest | AdvancedRequest;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const body: BooleanRequest = await req.json();
    
    let userPrompt: string;
    
    if (body.mode === "simple") {
      userPrompt = `Generate optimized boolean search strings for: "${body.hiring_sentence}"
      
Extract the job title, location, skills, and any other relevant information from this sentence.`;
    } else {
      const parts: string[] = [];
      parts.push(`Role: ${body.role}`);
      if (body.seniority) parts.push(`Seniority: ${body.seniority}`);
      if (body.locations?.length) parts.push(`Locations: ${body.locations.join(', ')}`);
      if (body.must_have_skills?.length) parts.push(`Must-have skills: ${body.must_have_skills.join(', ')}`);
      if (body.nice_to_have_skills?.length) parts.push(`Nice-to-have skills: ${body.nice_to_have_skills.join(', ')}`);
      if (body.exclude_terms?.length) parts.push(`Exclude terms: ${body.exclude_terms.join(', ')}`);
      if (body.employment_type) parts.push(`Employment type: ${body.employment_type}`);
      if (body.target_platforms?.length) parts.push(`Target platforms: ${body.target_platforms.join(', ')}`);
      
      userPrompt = `Generate optimized boolean search strings for the following criteria:

${parts.join('\n')}

Focus especially on the must-have skills and exclude terms. Generate strings optimized for each target platform.`;
    }

    console.log('Generating boolean strings for:', body.mode);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service temporarily unavailable. Please try again later.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    let parsedContent;
    try {
      // Clean up potential markdown formatting
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedContent = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse AI response');
    }

    console.log('Successfully generated boolean strings');

    return new Response(
      JSON.stringify(parsedContent),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-boolean:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
