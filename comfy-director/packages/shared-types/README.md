# shared-types

Non ancora popolato. Da Fase 2 in poi, quando i contratti API (`apps/bridge/bridge/schemas.py`)
crescono oltre le poche risposte di Fase 1 (già consumate direttamente e tipizzate a mano in
`apps/frontend/src/api/bridgeClient.ts`), qui verranno generati i tipi TypeScript a partire
dallo schema OpenAPI esposto dal Bridge (`/openapi.json`), per non mantenere manualmente due
copie dei contratti (vedi `ARCHITECTURE_DECISION.md` §8).

In Fase 1 la duplicazione manuale (poche interfacce in `bridgeClient.ts`) è accettabile e
più semplice di introdurre una pipeline di generazione per 4 endpoint.
