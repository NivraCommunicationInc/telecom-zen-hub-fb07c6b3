// One-shot PII purge — deletes test ID documents from storage.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const targets = [
    { bucket: "ticket-id-uploads", path: "abcb269f-4bb7-4679-85ff-b51c74a6d102/9770471e-9efd-4155-9909-ce05a93bdf20/1770514914118-QmTkiNwr3kKZwZwWnktJB1xDSbrz8oGTDZDCwemPgEf4hR.jpg" },
    { bucket: "id-documents", path: "abcb269f-4bb7-4679-85ff-b51c74a6d102/82c0302a-3fb2-4751-a99b-12c3ccc25e71/requested/proof_of_address_57034d34.pdf" },
  ];

  const results: any[] = [];
  for (const t of targets) {
    // also list and remove anything under the user folder
    const { data: list } = await sb.storage.from(t.bucket).list(t.path.split("/")[0], { limit: 1000 });
    const all = [t.path];
    const { error } = await sb.storage.from(t.bucket).remove(all);
    results.push({ ...t, deleted: !error, error: error?.message, found_in_folder: list?.length ?? 0 });
  }

  // Also recursively wipe everything under the 4 user IDs across all buckets
  const userIds = [
    "ee028941-f231-4e77-8379-4e4c13f62002",
    "61251da1-e04d-4d96-959c-a9b9ce59d13e",
    "2da95525-539a-4f30-9ac2-d59fbf961ac1",
    "abcb269f-4bb7-4679-85ff-b51c74a6d102",
  ];
  const { data: buckets } = await sb.storage.listBuckets();
  const sweepResults: any[] = [];
  for (const b of buckets ?? []) {
    for (const uid of userIds) {
      const walk = async (prefix: string): Promise<string[]> => {
        const { data } = await sb.storage.from(b.id).list(prefix, { limit: 1000 });
        const files: string[] = [];
        for (const it of data ?? []) {
          const p = prefix ? `${prefix}/${it.name}` : it.name;
          if (it.id) files.push(p); else files.push(...(await walk(p)));
        }
        return files;
      };
      const files = await walk(uid);
      if (files.length > 0) {
        const { error } = await sb.storage.from(b.id).remove(files);
        sweepResults.push({ bucket: b.id, uid, count: files.length, error: error?.message });
      }
    }
  }

  return new Response(JSON.stringify({ targets: results, sweep: sweepResults }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
