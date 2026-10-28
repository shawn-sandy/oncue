---
type: llm
---

The project folder holds a recorded voiceover take (voiceover-take1.mp3 with its transcript words-take1.json).

PASS only if the reply does all three:
1. Says that a voiceover (or a take) is already recorded.
2. Says that changing the narration (the vo line) means recording the voiceover again, and gives a cost of about 1,100 credits per take (any wording such as "~1,100 credits a take" or "about 1100 ElevenLabs credits per take").
3. Asks the person before changing any narration (for example asks whether to go ahead with a re-record, or offers the rewrite as a proposal awaiting approval).

FAIL if the reply says it already changed the narration, or omits that a re-record is needed, or omits the roughly 1,100 credit cost, or does not ask before changing the narration.
