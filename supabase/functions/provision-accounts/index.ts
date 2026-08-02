import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS Preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Verify token and authenticate caller
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized user session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Verify caller is admin
    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (profileErr || callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin privilege required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch all existing Auth users to create a map of email -> id (removes getUserByEmail calls)
    const authUserMap = new Map<string, string>();
    let page = 1;
    while (true) {
      const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000
      });
      if (listErr || !users || users.length === 0) break;
      for (const u of users) {
        if (u.email) {
          authUserMap.set(u.email.toLowerCase().trim(), u.id);
        }
      }
      if (users.length < 1000) break;
      page++;
    }

    // 4. Fetch unprovisioned faculty
    const { data: unprovisionedFaculty, error: facErr } = await supabaseAdmin
      .from('faculty')
      .select('id, employee_code, name, email')
      .is('profile_id', null);

    if (facErr) throw facErr;

    // 5. Fetch unprovisioned students
    const { data: unprovisionedStudents, error: studErr } = await supabaseAdmin
      .from('students')
      .select('id, roll_no, name, official_email')
      .is('profile_id', null);

    if (studErr) throw studErr;

    let created = 0;
    let skippedNoEmail = 0;
    let alreadyExisting = 0;
    const skippedRows: Array<{ type: 'faculty' | 'student'; identifier: string; name: string; reason: string }> = [];

    // Helper to provision a single user account
    const provisionUser = async (
      email: string,
      name: string,
      role: 'faculty' | 'student',
      identifier: string,
      recordId: string,
      tableName: 'faculty' | 'students'
    ) => {
      const normalizedEmail = email.toLowerCase().trim();
      let userId: string | null = null;

      // Check if user already exists in our pre-fetched auth mapping
      if (authUserMap.has(normalizedEmail)) {
        userId = authUserMap.get(normalizedEmail)!;
        alreadyExisting++;
      } else {
        // Attempt to create auth user
        const { data: authUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password: 'abes@1234',
          email_confirm: true,
          user_metadata: { role, identifier }
        });

        if (createErr) {
          // If error indicates user/email already exists, handle gracefully
          const errMsg = createErr.message.toLowerCase();
          if (errMsg.includes('already exists') || errMsg.includes('already registered') || errMsg.includes('conflict')) {
            // Find existing user ID by re-querying list or checking database profile
            const { data: profileCheck } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('email', normalizedEmail)
              .maybeSingle();

            if (profileCheck?.id) {
              userId = profileCheck.id;
            }
            alreadyExisting++;
          } else {
            skippedRows.push({ type: role, identifier, name, reason: createErr.message });
            return;
          }
        } else {
          userId = authUser.user.id;
          created++;
        }
      }

      if (userId) {
        // Upsert Profile
        await supabaseAdmin.from('profiles').upsert({
          id: userId,
          full_name: name,
          email: normalizedEmail,
          role,
          password_changed: false
        });

        // Link Roster table profile_id
        await supabaseAdmin.from(tableName).update({ profile_id: userId }).eq('id', recordId);
      }
    };

    // 6. Process Faculty
    if (unprovisionedFaculty) {
      for (const fac of unprovisionedFaculty) {
        const email = fac.email?.trim();
        const identifier = fac.employee_code;
        const name = fac.name;

        if (!email) {
          skippedNoEmail++;
          skippedRows.push({ type: 'faculty', identifier, name, reason: 'Email is empty/blank' });
          continue;
        }

        try {
          await provisionUser(email, name, 'faculty', identifier, fac.id, 'faculty');
        } catch (err: any) {
          skippedRows.push({ type: 'faculty', identifier, name, reason: err.message || 'Unknown error' });
        }
      }
    }

    // 7. Process Students
    if (unprovisionedStudents) {
      for (const stud of unprovisionedStudents) {
        const email = stud.official_email?.trim();
        const identifier = stud.roll_no;
        const name = stud.name;

        if (!email) {
          skippedNoEmail++;
          skippedRows.push({ type: 'student', identifier, name, reason: 'Official email is empty/blank' });
          continue;
        }

        try {
          await provisionUser(email, name, 'student', identifier, stud.id, 'students');
        } catch (err: any) {
          skippedRows.push({ type: 'student', identifier, name, reason: err.message || 'Unknown error' });
        }
      }
    }

    return new Response(
      JSON.stringify({
        created,
        skippedNoEmail,
        alreadyExisting,
        skippedRows,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
