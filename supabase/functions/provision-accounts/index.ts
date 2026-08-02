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

    // Read body parameters for limit and offset
    let limit = 50;
    let offset = 0;
    try {
      const body = await req.json();
      if (typeof body.limit === 'number') limit = body.limit;
      if (typeof body.offset === 'number') offset = body.offset;
    } catch (_) {
      // Body may be empty, fallback to defaults
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

    // 3. Fetch all existing Auth users to create a mapping of email -> id
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

    // 4. Fetch all Faculty
    const { data: facultyList, error: facErr } = await supabaseAdmin
      .from('faculty')
      .select('id, employee_code, name, email, profile_id');

    if (facErr) throw facErr;

    // 5. Fetch all Students
    const { data: studentsList, error: studErr } = await supabaseAdmin
      .from('students')
      .select('id, roll_no, name, official_email, profile_id');

    if (studErr) throw studErr;

    // 6. Combine records with a stable sort order
    const allRecords = [
      ...(facultyList || []).map(f => ({
        id: f.id,
        identifier: f.employee_code,
        name: f.name,
        email: f.email,
        profile_id: f.profile_id,
        role: 'faculty' as const,
        tableName: 'faculty' as const
      })),
      ...(studentsList || []).map(s => ({
        id: s.id,
        identifier: s.roll_no,
        name: s.name,
        email: s.official_email,
        profile_id: s.profile_id,
        role: 'student' as const,
        tableName: 'students' as const
      }))
    ];

    // Sort by id for stable pagination slicing
    allRecords.sort((a, b) => a.id.localeCompare(b.id));

    // Slice based on requested batch parameters
    const batch = allRecords.slice(offset, offset + limit);

    let createdCount = 0;
    let skippedCount = 0;
    let alreadyExistingCount = 0;
    const skippedRows: Array<{ type: 'faculty' | 'student'; identifier: string; name: string; reason: string }> = [];

    // 7. Process slice batch
    for (const record of batch) {
      // If record is already linked to a profile in the DB, it is already existing
      if (record.profile_id) {
        alreadyExistingCount++;
        continue;
      }

      const email = record.email?.trim();
      const name = record.name;
      const role = record.role;
      const identifier = record.identifier;

      if (!email) {
        skippedCount++;
        skippedRows.push({ type: role, identifier, name, reason: 'Email is empty/blank' });
        continue;
      }

      const normalizedEmail = email.toLowerCase().trim();
      let userId: string | null = null;

      try {
        if (authUserMap.has(normalizedEmail)) {
          userId = authUserMap.get(normalizedEmail)!;
          alreadyExistingCount++;
        } else {
          // Attempt to create auth user
          const { data: authUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password: 'abes@1234',
            email_confirm: true,
            user_metadata: { role, identifier }
          });

          if (createErr) {
            const errMsg = createErr.message.toLowerCase();
            if (errMsg.includes('already exists') || errMsg.includes('already registered') || errMsg.includes('conflict')) {
              const { data: profileCheck } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('email', normalizedEmail)
                .maybeSingle();

              if (profileCheck?.id) {
                userId = profileCheck.id;
              }
              alreadyExistingCount++;
            } else {
              skippedCount++;
              skippedRows.push({ type: role, identifier, name, reason: createErr.message });
              continue;
            }
          } else {
            userId = authUser.user.id;
            createdCount++;
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
          await supabaseAdmin.from(record.tableName).update({ profile_id: userId }).eq('id', record.id);
        }
      } catch (err: any) {
        skippedCount++;
        skippedRows.push({ type: role, identifier, name, reason: err.message || 'Unknown error' });
      }
    }

    const remainingCount = Math.max(0, allRecords.length - (offset + batch.length));

    return new Response(
      JSON.stringify({
        processedCount: batch.length,
        createdCount,
        alreadyExistingCount,
        skippedCount,
        remainingCount,
        skippedRows,
        totalCount: allRecords.length
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
