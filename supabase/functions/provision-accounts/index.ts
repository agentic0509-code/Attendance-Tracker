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

    // 3. Fetch unprovisioned faculty
    const { data: unprovisionedFaculty, error: facErr } = await supabaseAdmin
      .from('faculty')
      .select('id, employee_code, name, email')
      .is('profile_id', null);

    if (facErr) throw facErr;

    // 4. Fetch unprovisioned students
    const { data: unprovisionedStudents, error: studErr } = await supabaseAdmin
      .from('students')
      .select('id, roll_no, name, official_email')
      .is('profile_id', null);

    if (studErr) throw studErr;

    let created = 0;
    let skippedNoEmail = 0;
    let alreadyExisting = 0;
    const skippedRows: Array<{ type: 'faculty' | 'student'; identifier: string; name: string; reason: string }> = [];

    // 5. Process Faculty (Roster rows)
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
          let userId: string | null = null;
          
          // Check if user already exists in auth.users by email
          const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);
          if (existingUser?.user) {
            userId = existingUser.user.id;
            alreadyExisting++;
          } else {
            // Create Auth User
            const { data: authUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
              email: email,
              password: 'abes@1234',
              email_confirm: true,
              user_metadata: { role: 'faculty', identifier: identifier }
            });

            if (createErr) {
              skippedRows.push({ type: 'faculty', identifier, name, reason: createErr.message });
              continue;
            }
            userId = authUser.user.id;
            created++;
          }

          if (userId) {
            // Upsert Profile
            await supabaseAdmin.from('profiles').upsert({
              id: userId,
              full_name: name,
              email: email,
              role: 'faculty',
              password_changed: false
            });

            // Link Faculty table profile_id
            await supabaseAdmin.from('faculty').update({ profile_id: userId }).eq('id', fac.id);
          }
        } catch (err: any) {
          skippedRows.push({ type: 'faculty', identifier, name, reason: err.message || 'Unknown error' });
        }
      }
    }

    // 6. Process Students (Roster rows)
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
          let userId: string | null = null;

          // Check if user already exists
          const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);
          if (existingUser?.user) {
            userId = existingUser.user.id;
            alreadyExisting++;
          } else {
            // Create Auth User
            const { data: authUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
              email: email,
              password: 'abes@1234',
              email_confirm: true,
              user_metadata: { role: 'student', identifier: identifier }
            });

            if (createErr) {
              skippedRows.push({ type: 'student', identifier, name, reason: createErr.message });
              continue;
            }
            userId = authUser.user.id;
            created++;
          }

          if (userId) {
            // Upsert Profile
            await supabaseAdmin.from('profiles').upsert({
              id: userId,
              full_name: name,
              email: email,
              role: 'student',
              password_changed: false
            });

            // Link Students table profile_id
            await supabaseAdmin.from('students').update({ profile_id: userId }).eq('id', stud.id);
          }
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
