# Power BI connection

Use Power BI Desktop:
1. Start PostgreSQL using `docker compose up -d`.
2. Install/enable the PostgreSQL connector/driver if Power BI asks for it.
3. Get Data → PostgreSQL database.
4. Server: `localhost:5432`, database: `healthcare`.
5. Choose DirectQuery (not Import) for the live-demo architecture.
6. Load `patients`, `doctors`, `emergency_visits`, `beds`, `bed_utilization`.
7. Create a Date table and relationships listed in DAX_Measures.txt.
8. Add the measures and build the 5 pages from 5_Page_Design.txt.
9. For a live demonstration, enable Automatic Page Refresh for the DirectQuery report page where supported by your Power BI environment/capacity.

Important:
- Power BI Pro scheduled refresh is not the right mechanism for a 10-minute live demo. Scheduled refresh intervals have service/licensing limits.
- DirectQuery + Automatic Page Refresh is the appropriate architecture for near-real-time database changes.
- A genuine .pbix must be authored/saved by Power BI Desktop. This package deliberately does not fake or fabricate a PBIX binary.
