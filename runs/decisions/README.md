# Decision Records

`runs/decisions/` is the tracked home for secret-free decision-record templates and public-safe summaries.

Operational runs may also write local decision records under `.run-next/` or another ignored state directory. A decision record must name the exact boundary type, workflow state transition, evidence used, approval identifier when applicable, and the exact input required from John when the run cannot continue automatically.

Records must not contain credentials, authorization headers, Supabase project references, raw production logs, request payloads, or secret values. A vague phrase such as "human decision needed" is not enough; the run must classify the boundary as credential, production mutation, destructive action, repository policy, independent review, product/legal/security decision, waiting condition, safety failure, or no external boundary.
