<!-- vos:begin (written by vos setup; the block is replaced on the next run) -->
## Product videos (vosso)
- Skill: product-video (npx skills add vosjs/skills) records the real product from actions.json
- Look before you cut: vos frames take --at-zooms; edit take/doc.json and re-render, never re-record
- Hand back: vos open take serves the take into the studio at vos.so, doc.json intact
- Local by default: vos push only when asked for a link, the shelf or a cloud render
- Deleting: vos delete moves a vos to Trash and vos restore brings it back; if you deleted by mistake, restore it and say so. Only the person can delete forever, at vos.so/app/trash
- Credentials: VOS_API_KEY, then the account in use at ~/.config/vos/credentials (vos whoami says which; vos switch <handle> changes it), then vos login; never print one
- Reference: https://vos.so/llms-full.txt
<!-- vos:end -->
