---
type: llm
---

The project's short.json has this narration for beat 2:
"Tabs pile up, bookmarks lose their context, and notes turn into a pile of pasted text with no source."
Its on-screen items enter on the cue words "tabs", "bookmarks" and "notes".

PASS only if all of these hold:
1. The reply shows beat 2's current narration (quoted or clearly restated) and a proposed new narration line for beat 2.
2. The proposed line begins a sentence with an ordinary word, not a number, digit or symbol.
3. Each of the words "tabs", "bookmarks" and "notes" appears in the proposed line as the start of a word, ignoring letter case and punctuation ("Tabs," counts; "tab" does not, because the engine matches a cue word as the start of a spoken word), OR the reply says which cue was changed and the new cue word is in the new line.

FAIL if the reply shows no proposed line for beat 2, or the proposed line starts with a number or symbol, or a cue word is dropped or shortened (such as "tab" for "tabs") without the reply saying its cue was updated to a word in the new line.
