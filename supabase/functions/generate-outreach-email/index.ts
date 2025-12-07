import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompanyContext {
  companyName?: string | null;
  companyWebsite?: string | null;
  companyAbout?: string | null;
  sellingPoints?: string | null;
  tonePreference?: string;
  emailSignature?: string | null;
}

interface GenerateEmailRequest {
  jobBrief: {
    role: string;
    location: string;
    skills: string[];
    seniority?: string;
  };
  candidateProfile: {
    name: string;
    title: string;
    company: string;
    location: string;
    skills?: string[];
    linkedInUrl?: string;
    yearsOfExperience?: number;
  };
  companyContext?: CompanyContext;
}

const TONE_DESCRIPTIONS: Record<string, string> = {
  friendly_professional: "Warm and friendly while maintaining professional standards. Use a conversational but respectful tone.",
  concise_direct: "Get straight to the point. Be clear, efficient, and respect the reader's time. Avoid unnecessary pleasantries.",
  warm_conversational: "Write as if chatting with a friend. Be personable, casual, and genuinely engaging. Use contractions and informal language.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { jobBrief, candidateProfile, companyContext }: GenerateEmailRequest = await req.json();

    console.log("Generating outreach email for:", candidateProfile.name);
    console.log("Job brief:", jobBrief);
    console.log("Company context:", companyContext);

    const toneInstruction = companyContext?.tonePreference 
      ? TONE_DESCRIPTIONS[companyContext.tonePreference] || TONE_DESCRIPTIONS.friendly_professional
      : TONE_DESCRIPTIONS.friendly_professional;

    const companyInfo = companyContext?.companyName || companyContext?.companyAbout || companyContext?.sellingPoints
      ? `
COMPANY INFORMATION (use this to represent the hiring company):
${companyContext.companyName ? `- Company Name: ${companyContext.companyName}` : ""}
${companyContext.companyWebsite ? `- Website: ${companyContext.companyWebsite}` : ""}
${companyContext.companyAbout ? `- About: ${companyContext.companyAbout}` : ""}
${companyContext.sellingPoints ? `- Key Selling Points:\n${companyContext.sellingPoints}` : ""}
`
      : "";

    const signatureInstruction = companyContext?.emailSignature
      ? `\nIMPORTANT: End the email body with this signature:\n${companyContext.emailSignature}`
      : "";

    const systemPrompt = `You are an expert recruiter writing personalized outreach emails. Your emails are:
- Highly personalized based on the candidate's background
- Concise (under 150 words for the body, not including signature)
- Show genuine interest in the candidate's experience
- Include a clear but soft call-to-action

TONE INSTRUCTIONS: ${toneInstruction}

Always respond with ONLY a JSON object in this exact format:
{
  "subject": "email subject line",
  "body": "email body text",
  "note": "1-2 sentence explanation of why this candidate is a strong fit for the role"
}

Do not include any other text, markdown formatting, or code blocks. Just the raw JSON object.`;

    const userPrompt = `Generate a personalized recruiting outreach email for:

CANDIDATE:
- Name: ${candidateProfile.name}
- Current Role: ${candidateProfile.title}
- Company: ${candidateProfile.company}
- Location: ${candidateProfile.location}
${candidateProfile.skills?.length ? `- Skills: ${candidateProfile.skills.slice(0, 5).join(", ")}` : ""}
${candidateProfile.yearsOfExperience ? `- Years of Experience: ${candidateProfile.yearsOfExperience}` : ""}

JOB OPPORTUNITY:
- Role: ${jobBrief.role}
- Location: ${jobBrief.location}
${jobBrief.seniority ? `- Seniority: ${jobBrief.seniority}` : ""}
${jobBrief.skills?.length ? `- Key Skills: ${jobBrief.skills.slice(0, 5).join(", ")}` : ""}
${companyInfo}
Write a compelling, personalized email that:
1. Opens by referencing something specific about their current role or company
2. Briefly mentions the opportunity${companyContext?.companyName ? ` at ${companyContext.companyName}` : ""} and why they'd be a great fit
${companyContext?.sellingPoints ? "3. Subtly weave in 1-2 company selling points that would appeal to this candidate" : ""}
4. Ends with a soft ask for a quick chat
${signatureInstruction}

Remember: Output ONLY the JSON object with "subject", "body", and "note" fields.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response:", content);

    // Parse the JSON response
    let emailData;
    try {
      // Try to extract JSON from the response (in case there's any extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        emailData = JSON.parse(jsonMatch[0]);
      } else {
        emailData = JSON.parse(content);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Fallback: create a basic email
      const companyMention = companyContext?.companyName ? ` at ${companyContext.companyName}` : "";
      emailData = {
        subject: `Exciting ${jobBrief.role} Opportunity${companyMention}`,
        body: `Hi ${candidateProfile.name.split(" ")[0]},\n\nI came across your profile and was impressed by your experience at ${candidateProfile.company}. I'm reaching out about a ${jobBrief.role} opportunity${companyMention} in ${jobBrief.location} that I think would be a great fit for your background.\n\nWould you be open to a quick chat to learn more?\n\n${companyContext?.emailSignature || "Best regards"}`,
        note: `${candidateProfile.name} has relevant experience at ${candidateProfile.company} that aligns with the ${jobBrief.role} position.`,
      };
    }

    return new Response(
      JSON.stringify({
        subject: emailData.subject,
        body: emailData.body,
        note: emailData.note || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error generating email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
