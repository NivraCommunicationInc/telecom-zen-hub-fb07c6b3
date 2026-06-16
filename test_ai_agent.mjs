import { createClient } from './node_modules/@supabase/supabase-js/dist/index.mjs';

const SUPABASE_URL = 'https://lacxnbjvcyvhrttprkxr.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhY3huYmp2Y3l2aHJ0dHBya3hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MjI2NjMsImV4cCI6MjA5NTk5ODY2M30.Jcc89WC7CofMuMc9IRpxzsDsEb-_C7AVgLEbNzdLa2g';
const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function runTest(label, ticket_id) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${label}`);
  console.log('='.repeat(60));

  const { data, error } = await supabase.functions.invoke('support-ai-responder', {
    body: { ticket_id }
  });

  if (error) { console.log('ERROR:', error.message); return; }
  console.log('Invoke result:', JSON.stringify(data));

  const { data: tk } = await supabase
    .from('support_tickets')
    .select('status, ai_confidence, ai_response, category, escalated_reason, ai_responded_at')
    .eq('id', ticket_id)
    .single();

  console.log('\nTicket status:', tk?.status);
  console.log('Category:', tk?.category);
  console.log('Confidence:', Math.round((tk?.ai_confidence ?? 0) * 100) + '%');
  if (tk?.status === 'escalated') {
    console.log('ESCALADE:', tk?.escalated_reason?.slice(0, 200));
  } else if (tk?.ai_response) {
    console.log('\n--- Réponse IA ---');
    console.log(tk.ai_response.slice(0, 1200));
  }
}

// Tickets créés via SQL (RLS bypass)
const tickets = [
  { id: 'c446c5a2-ddca-4c38-adf5-8046604f9001', label: 'Client inconnu — Forfaits/Prix (FR)', number: 'TKT-0C2D1D3D' },
  { id: 'a52e2ef0-25f1-4258-9951-9b3cc3ff0405', label: 'Client inconnu — Panne + Remboursement (EN)', number: 'TKT-CB339482' },
];

for (const t of tickets) {
  console.log(`Ticket ${t.number}: ${t.id}`);
  await runTest(t.label, t.id);
}

console.log('\n✅ Tests terminés');
