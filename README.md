# FANUC Industrial AI Command Center — AIonOS Static Demo

A fully static GitHub Pages-ready demo for showing a client like FANUC India how AIonOS can orchestrate:

- Robot telemetry in action
- A running industrial inspection video
- Real-time defect detection overlays
- Predictive maintenance and remaining useful life insights
- SOP Copilot with synthetic RAG-style answers
- AI-generated work orders
- Dashboard KPIs
- Contracts, SOPs and past production data sheets stored as JSON

## How to run locally

Because the page fetches `data/demo-data.json`, run it through a static server:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## How to deploy on GitHub Pages

1. Create a GitHub repository.
2. Upload all files in this folder to the repository root.
3. Go to **Settings → Pages**.
4. Select **Deploy from branch**.
5. Select `main` branch and `/root`.
6. Open the GitHub Pages URL after deployment.

## File structure

```text
fanuc-industrial-ai-demo/
  index.html
  styles.css
  app.js
  data/
    demo-data.json
  assets/
    robot_inspection_demo.mp4
  docs/
    demo-script.md
```

## Data model

All demo data is synthetic and lives in `data/demo-data.json`:

- `robots`
- `telemetry`
- `defectEvents`
- `sops`
- `workOrders`
- `contracts`
- `pastDataSheets`
- `knowledgeQuestions`

The UI can also export the current state as JSON and import a JSON file to replay a scenario.

## Demo storyline

1. Start live scenario.
2. Vision AI detects a surface scratch on a moving part.
3. Robot telemetry shows R-07 torque and vibration drift.
4. Predictive maintenance calculates downtime and RUL risk.
5. SOP Copilot retrieves gripper alignment SOP.
6. Supervisor Agent creates a high-priority work order.

## Notes

This is a reference implementation designed to awe a client in a web demo while remaining honest: no production FANUC data, no backend, and no external dependencies are required.
