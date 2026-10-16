# Healthcare Emergency Analytics & Decision Support System

Generated starter system for a final-year Power BI project.

## Included
- 200 patient records
- 200 emergency visits
- 30 doctors
- 200 beds
- 1626 daily department bed-utilization records
- Node/Express backend API
- React/Vite frontend for live patient entry
- PostgreSQL database + Docker Compose
- Power BI 5-page build specification
- DAX measures
- CSV copies for validation

## Run
1. Install Docker Desktop.
2. From this folder: `docker compose up -d`
3. In `backend`: `npm install` then `npm start`
4. In `frontend`: `npm install` then `npm run dev`
5. Open the Vite URL shown in the terminal.
6. Submit a new patient.
7. In Power BI Desktop, connect to PostgreSQL using DirectQuery.
8. Build the pages according to `powerbi/5_Page_Design.txt`.
9. Enable Automatic Page Refresh for DirectQuery where supported.

## Live demo sequence
Evaluator → submit new emergency case → PostgreSQL insert → Power BI DirectQuery → automatic page refresh → KPI/visual reflects new record.

## Important
The included project is the complete source stack and Power BI-ready data/model specification. A `.pbix` cannot be safely generated outside Power BI Desktop; do not use a fabricated binary as a deliverable.

## Patient & Emergency Management

The web app now includes three sections:
- New Emergency: creates a new patient and initial emergency visit.
- Patient Management: search and edit existing patient demographics and insurance.
- Emergency Management: search and edit existing emergency visit details such as arrival time, triage, arrival mode, condition, department, waiting/treatment time, admission, outcome, length of stay and cost.

### Power BI compatibility

No existing PostgreSQL tables or columns were renamed or removed. The `patients`, `emergency_visits`, `doctors`, `beds`, and `bed_utilization` structures remain compatible with the existing Power BI model and measures.

Editing a record intentionally changes the underlying data, so Power BI metrics can change after a DirectQuery refresh. That is expected behavior; the report itself is not rebuilt or structurally changed.

The application does not hard-delete patients or emergency visits, avoiding broken foreign-key relationships and accidental loss of analytical history.
