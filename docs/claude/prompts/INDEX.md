# Claude Implementation Prompts (Multipart Index)

Usage:
1. Open each part in order: part_aa → part_ab → part_ac → part_ad → part_ae → part_af → part_ag.
2. Paste the entire content of a part, run it, wait for the model to finish, then paste the next part.
3. The model should preserve memory across parts and continue appending outputs (no rework).

Parts:
- part_aa: Header, file plan, docs/claude/Claude.md (start) and module beginnings
- part_ab: Remaining integration doc and modules
- part_ac: Modules continued
- part_ad: Modules + coverage config
- part_ae: Integration specs (real-time, stock analysis flows)
- part_af: Unit specs (auth, market data, stock analysis)
- part_ag: Tail end and closing markers

Note: The content is split mechanically; boundaries may occur mid-section. Claude should treat parts as a continuous stream.
