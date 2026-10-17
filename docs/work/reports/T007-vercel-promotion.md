# T007 Vercel production promotion

Date: 2026-10-16

Promoted the previously validated production deployment to the verified Tretta project domain in the Seibel Hobby team.

- Vercel team: `seibel` (Hobby)
- Project: `tretta` (`prj_CYHWGKoqqCZEGVVXN3Tbx1nnBMw8`)
- Deployment: `dpl_4oPaKQDrLFLVjoQmSJgQgcHm4DUc`
- Source commit: `8967e94` (functional source version `10367a6`)
- Staged deployment URL: `https://tretta-c0lhivjhc-seibel.vercel.app`
- Production domain: `https://tretta.vercel.app`

At 2026-10-16 17:12 UTC, `vercel promote dpl_4oPaKQDrLFLVjoQmSJgQgcHm4DUc --scope seibel --yes` completed successfully and reported that deployment as READY production. The CLI's promotion output assigned the generated deployment URL, while the initial deployment inspection listed only the team alias. Since the project's verified `tretta.vercel.app` domain was not listed, I used `vercel alias set dpl_4oPaKQDrLFLVjoQmSJgQgcHm4DUc tretta.vercel.app --scope seibel`. Vercel confirmed that the exact domain now points to that deployment. The subsequent alias registry listed `tretta-c0lhivjhc-seibel.vercel.app` paired with `tretta.vercel.app`.

Validation after the alias assignment: deployment inspection returned the requested deployment ID, `target=production`, and `readyState=READY`; unauthenticated `curl` to `https://tretta.vercel.app/` returned HTTP 200 with `text/html; charset=utf-8`.

No rebuild, billing change, protection change, or other domain/project change was made.
