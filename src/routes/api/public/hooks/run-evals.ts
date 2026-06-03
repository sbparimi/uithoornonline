import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chatTurn } from "@/lib/chat.functions";

type EvalCase = {
  question: string;
  expected_keywords: string[];
  must_cite: boolean;
};

// Small factuality regression suite. Extend freely.
const CASES: EvalCase[] = [
  {
    question: "Welke postcodes in Uithoorn vallen in de overschrijdingszone?",
    expected_keywords: ["1420", "1424"],
    must_cite: false, // deterministic checkAddress answers this
  },
  {
    question: "Hoeveel compensatie kan ik ongeveer per jaar krijgen?",
    expected_keywords: ["150", "2.200"],
    must_cite: false,
  },
  {
    question: "Wie is BAS en wat doet die organisatie?",
    expected_keywords: ["BAS", "Schiphol"],
    must_cite: true,
  },
  {
    question: "Waar kan ik officieel een klacht over vliegtuiglawaai melden?",
    expected_keywords: ["BAS"],
    must_cite: true,
  },
];

export const Route = createFileRoute("/api/public/hooks/run-evals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }
        const run_id = randomUUID();
        const results: {
          question: string;
          passed: boolean;
          citation_count: number;
          actual: string;
        }[] = [];
        for (const c of CASES) {
          try {
            const r = await chatTurn({
              data: { messages: [{ role: "user", content: c.question }], slots: {} },
            });
            const answer = r.message ?? "";
            const sources = (r as { sources?: { url: string }[] }).sources ?? [];
            const kwOk = c.expected_keywords.every((k) =>
              answer.toLowerCase().includes(k.toLowerCase()),
            );
            const citeOk = c.must_cite ? sources.length > 0 : true;
            const passed = kwOk && citeOk;
            results.push({
              question: c.question,
              passed,
              citation_count: sources.length,
              actual: answer,
            });
            await supabaseAdmin.from("chat_eval_runs").insert({
              run_id,
              question: c.question,
              expected_keywords: c.expected_keywords,
              must_cite: c.must_cite,
              actual_answer: answer,
              citation_count: sources.length,
              passed,
              notes: passed
                ? null
                : `kw=${kwOk ? "ok" : "miss"} cite=${citeOk ? "ok" : "miss"}`,
            });
          } catch (e) {
            results.push({
              question: c.question,
              passed: false,
              citation_count: 0,
              actual: e instanceof Error ? e.message : String(e),
            });
          }
        }
        const passed = results.filter((r) => r.passed).length;
        return Response.json({ ok: true, run_id, total: CASES.length, passed, results });
      },
    },
  },
});
