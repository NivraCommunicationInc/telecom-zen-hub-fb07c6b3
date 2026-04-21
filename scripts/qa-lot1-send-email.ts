/**
 * QA Lot 1 — Envoi des 5 PDFs par courriel à support@nivra-telecom.ca
 */
import { readFileSync, readdirSync } from "node:fs";

const SUPABASE_URL = "https://xtgngmtxggascbxnswvb.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z25nbXR4Z2dhc2NieG5zd3ZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDE2MzYsImV4cCI6MjA4MjY3NzYzNn0.BYQ3k1-N2_bbXCRTRcJ6FWoI6HuDP6BdhSrmCYhJai8";

const DIR = "/mnt/documents/qa-lot1";
const files = readdirSync(DIR).filter(f => f.endsWith(".pdf"));

const attachments = files.map(filename => ({
  filename,
  content: readFileSync(`${DIR}/${filename}`).toString("base64"),
  contentType: "application/pdf",
}));

console.log(`Sending ${attachments.length} PDFs to support@nivra-telecom.ca`);
attachments.forEach(a => console.log(`  - ${a.filename} (${Math.round(a.content.length * 3 / 4 / 1024)} KB)`));

const res = await fetch(`${SUPABASE_URL}/functions/v1/send-pdf-templates-email`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${ANON_KEY}`,
    "apikey": ANON_KEY,
  },
  body: JSON.stringify({
    email: "support@nivra-telecom.ca",
    kind: "blank_templates_v2_5",
    watermark: "QA Lot 1 — Documents financiers — Données test Table Lakay",
    attachments,
  }),
});

const json = await res.json();
console.log("Response:", res.status, JSON.stringify(json, null, 2));
