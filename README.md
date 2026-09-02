# Uithoorn Online

Evidence-based local information and resident services for Uithoorn and the surrounding area.

## What it does

- **Address check** — validates addresses against official PDOK/BAG data.
- **Vliegtuig & geluid** — resident noise reporting and evidence-oriented aircraft-noise information, with clear boundaries between resident observations and official sources.
- **Local services** — residents can describe what they need and submit a local-service request.
- **Governed AI assistant** — uses authoritative sources where available and avoids presenting resident reports or derived information as official measurements or determinations.

## Tech stack

- TanStack Start / React / Vite
- Tailwind CSS
- Supabase for authentication and application data
- Vercel with Nitro runtime for deployment
- TypeScript, Playwright and GitHub Actions for quality and release automation

## Local development

```sh
npm install
npm run dev
```

## Deployment

`main` is the production source branch. Vercel handles deployments for the project. Feature flags are used to keep new functionality controlled while it is validated.

## Project structure

```
src/
├── routes/            # TanStack Router routes
├── components/        # Shared UI components
├── lib/               # Application and server utilities
└── integrations/      # External service integrations
```

## License

Public interest project. See individual upstream data-source licenses for reuse conditions.
