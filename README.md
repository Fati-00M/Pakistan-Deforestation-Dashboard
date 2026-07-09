# Pakistan Deforestation Monitor & Analytics Dashboard

An interactive, high-fidelity web dashboard designed to visualize, analyze, and sort deforestation and forest canopy cover loss data in Pakistan from **2001 to 2024**.

This dashboard operates entirely client-side, using a preprocessed and aggregated dataset to deliver sub-second response times, interactive geospatial mapping, and advanced sorting/filtering controls.


- **Geospatial Hotspots Map**: Displays localized forest loss on a dark Leaflet canvas using color-coded proportional markers (radius scales with loss magnitude, color corresponds to canopy density classes).
- **KPI Metrics**: Real-time stats calculating Total Deforested Area (in Hectares & Sq Km), Peak Deforestation Year, Most Affected District, and Weighted Average Canopy Cover.
- **Visual Analytics (ApexCharts)**:
  - **Deforestation Trend**: Line/area chart mapping annual forest loss over time.
  - **Canopy Density Distribution**: Column chart mapping loss by initial canopy density.
  - **Spatiotemporal Matrix (Year vs Canopy Cover)**: A 2D density heatmap mapping years against canopy cover classes to show exactly where and when forest cover loss was concentrated.
  - **Regional Comparisons**: Charts breaking down loss across Provinces and highlight the top 10 most affected Districts.
- **Sortable Data Table**: paginated records with the ability to sort by Year and Canopy Cover in both ascending and descending order.
- **Dynamic Search**: Live search bar to filter records instantly by province or district.
- **Data Export**: A one-click export button to download the actively filtered/sorted tabular data into a clean CSV format.

## Technology Stack

- **Structure & Layout**: HTML5 (Semantic elements)
- **Styling & Theme**: Vanilla CSS3 (Slate dark theme, custom responsive grid, glassmorphism card panels)
- **Charts & Visualizations**: [ApexCharts](https://apexcharts.com/)
- **Geospatial Mapping**: [Leaflet.js](https://leafletjs.com/) with CartoDB Dark Matter tiles
- **Data Processing**: Python 3 (Preprocessing engine)

## Repository Structure

```
├── index.html         # Main dashboard interface
├── style.css          # Dark-theme style sheet
├── app.js             # Client-side filtering, map, chart & table controllers
├── data.js            # Preprocessed and aggregated data variables
├── preprocess.py      # Python script used to aggregate raw data
└── README.md          # Project documentation
```

## How to Run Locally

Since the dataset is bundled directly inside `data.js` via JSON arrays, the dashboard runs fully client-side and does not require local servers or database setups:

1. **Direct View**:
   - Simply double-click `index.html` to open it in any web browser. It operates offline and via the `file://` protocol.
2. **Local HTTP Server** (Optional):
   - Serve the files using Python's built-in server:
     ```bash
     python -m http.server 8000
     ```
   - Open [http://localhost:8000](http://localhost:8000) in your web browser.

## Preprocessing Raw Data

The dashboard data is compiled from a raw 136k-row spatial dataset (`Deforestation_by_location.csv`). To rebuild or update the aggregated dataset, run:

```bash
python preprocess.py
```

This runs in `< 2 seconds` and regenerates `data.js`.

---

## Deploying to GitHub Pages

To host this dashboard live on the web for free using GitHub Pages:

1. Create a new repository on your GitHub account (e.g., named `pakistan-deforestation-dashboard`).
2. Follow the steps below in your terminal to initialize git and push the files:
   ```bash
   # Initialize git repository
   git init -b main

   # Stage and commit the project files
   git add index.html style.css app.js data.js preprocess.py .gitignore README.md
   git commit -m "Initial commit: Pakistan Deforestation Dashboard"

   # Link to your remote GitHub repository
   git remote add origin https://github.com/YOUR_USERNAME/pakistan-deforestation-dashboard.git

   # Push to main branch
   git push -u origin main
   ```
3. On GitHub, navigate to your repository's **Settings** tab.
4. Click on **Pages** in the left sidebar.
5. Under **Build and deployment**, select **Deploy from a branch** as the source.
6. Choose the `main` branch and `/ (root)` folder, then click **Save**.
7. Within a few minutes, your site will be live at:
   `https://YOUR_USERNAME.github.io/pakistan-deforestation-dashboard/`
