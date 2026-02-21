# AI Eval Replay Fixtures

Run replay:

```bash
npm run ai:eval
```

This harness replays fixed scenarios against deterministic guardrails and reports:

- contract valid rate
- guardrail block precision/recall
- stale-data block correctness
- evidence completeness
- latency and fallback rate

Fixtures live in `docs/ai-evals/*.json` and use this shape:

```json
{
  "scenarios": [
    {
      "id": "scenario-id",
      "feature": "feed_summary_overview",
      "context": { "snapshotAgeMs": 120000, "dataCoverage": 0.9 },
      "contract": {
        "risk": "short risk statement",
        "action": "short action statement",
        "confidence": 0.8,
        "evidence": ["fact-1", "fact-2"],
        "expiresAtOffsetMs": 300000
      },
      "contractStatus": "validated",
      "expectedVerdict": "warn"
    }
  ]
}
```
