import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OutreachEmailRequest {
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  subject: string;
  body: string;
  fromEmail: string;
  fromName: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { 
      candidateId, 
      candidateName, 
      candidateEmail, 
      subject, 
      body, 
      fromEmail,
      fromName 
    }: OutreachEmailRequest = await req.json();

    // Validate required fields
    if (!candidateEmail || !subject || !body) {
      throw new Error("Missing required fields: candidateEmail, subject, and body are required");
    }

    console.log(`Sending outreach email to ${candidateEmail} for candidate ${candidateName}`);

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: fromEmail ? `${fromName || 'Recruiter'} <${fromEmail}>` : "Recruiter <onboarding@resend.dev>",
      to: [candidateEmail],
      subject: subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${body.replace(/\n/g, '<br>')}
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Store email record in database
    const { data: outreachRecord, error: dbError } = await supabaseClient
      .from("email_outreach")
      .insert({
        user_id: user.id,
        candidate_id: candidateId,
        candidate_name: candidateName,
        candidate_email: candidateEmail,
        subject: subject,
        body: body,
        status: "sent",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Failed to store email record:", dbError);
      // Don't throw - email was sent successfully, just log the db error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: emailResponse.data?.id,
        outreachRecord 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-outreach-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
