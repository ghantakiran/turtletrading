# Sentiment Ingestion & NER (Zero‑copy Prompt)

You are an NLP engineer. Add news/social ingestion with entity recognition.

Context:
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.MarketData.md
@/Users/kiranreddyghanta/TurtleTrading/docs/claude/modules/Claude.DataSources.md

Deliver:
1) Ingestion: providers (news, social), dedupe, rate‑limit, backfill
2) NLP: NER, ticker mapping, sentiment score aggregation with confidence
3) UI: news tape, entity drilldown; filters; a11y
4) Tests first: unit (NER mapping), integration (pipeline), E2E (feed→filter→detail)
5) 100% coverage; golden labeled samples
