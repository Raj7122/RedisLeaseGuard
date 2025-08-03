# Project Plan: Climate Tech Funding Tracker

## 1. Project Overview
* **Application Type:** Web Application (Streamlit-based)
* **Target Platform:** Browser-based web app (Desktop-first, responsive)
* **Motivation:** Provide low-cost, open-source funding intelligence for climate tech startups, democratizing access to investment data that's currently expensive and proprietary
* **Target Audience:** Investors, analysts, climate tech founders, researchers (intermediate tech comfort)
* **User Journey Map:** 
  1. User opens web app via browser
  2. App displays funding events with filtering options
  3. User applies filters (sector, geography, investor, stage)
  4. System returns filtered funding event cards
  5. User clicks cards for detailed info or mini-profiles
  6. User optionally exports data to CSV
  7. User closes app after data review

## 2. Technical Architecture & Design

### **Technology Stack:**
* **Frontend:** Streamlit (Python-based UI) + Plotly for visualizations
* **Backend:** Python (Flask/FastAPI optional for API expansion)
* **Database:** SQLite (MVP) with CSV fallback
* **Testing:** pytest + Streamlit testing framework
* **Deployment:** Local development with free-tier cloud options (Heroku/Railway)

### **UI/UX Design System:**
* **Component Library:** Streamlit native components with custom CSS styling
* **Design Methodology:** Component-driven development with atomic design principles
* **UX Principles Applied:**
  * **Fitts's Law Implementation:** Large, easily clickable filter buttons and card elements (44px minimum touch targets)
  * **Hick's Law Application:** Simplified filter categories (sector, geography, investor, stage) with familiar LinkedIn/Crunchbase patterns
  * **Miller's Rule Adherence:** Information chunked into digestible cards (3-5 high-value fields visible at glance)
  * **Jakob's Law Compliance:** Familiar data table and card layouts users expect from professional platforms
  * **Krug's Usability Principles:** Self-evident interface with clear labeling and minimal cognitive load for research workflows
* **Accessibility Standard:** WCAG 2.1 AA compliance with semantic components and contrast-friendly design
* **Responsive Strategy:** Desktop-first with mobile-adaptive design (read-only mobile views)
* **Information Architecture:** Sidebar filtering + top bar for global actions (search, dashboard, settings)
* **Color System:** 
  * Primary: #2E8B57 (Sea Green - climate theme)
  * Accent: #20B2AA (Light Sea Green)
  * Neutral: #f8f9fa (Soft Gray), #2e2e2e (Charcoal)
  * Background: #ffffff (White)
  * Text: #2e2e2e (Charcoal), #6c757d (Secondary Text)
* **Typography:** Inter, Open Sans, or Source Sans Pro for clean, modern readability
* **Content Hierarchy:**
  * **Primary Fields:** startup_name, amount_usd, funding_stage
  * **Secondary Fields:** investors, announcement_date, location, sector
  * **Progressive Disclosure:** Expandable rows/cards for full investor list, source links, raw snippets
* **Data Visualization:** Clean bar charts and time series for funding trends, pie/donut for categorical distributions
* **Navigation Pattern:** Flat sidebar filtering with persistent top bar (no tabs or nested menus)
* **Cognitive Load Strategy:** Speed and scannability prioritized, batch workflows supported, keyboard shortcuts planned for future

### **Security & Threat Model:**
* **Authentication:** None required (public data access)
* **Authorization:** Not applicable (no user accounts)
* **Data Protection:** Public data only, no sensitive information
* **OWASP Top 10 Mitigations:**
  * **Injection:** Input validation for search terms and filters
  * **Broken Authentication:** Not applicable (no auth)
  * **Sensitive Data Exposure:** Not applicable (public data only)
  * **XSS:** Sanitize user inputs displayed in search results
  * **Security Misconfiguration:** Safe defaults in Streamlit configuration
  * **Known Vulnerabilities:** Regular dependency updates
* **CIS Benchmark Compliance:** Basic web application security controls

## 3. High-level Task Breakdown
- [ ] **Task 1: Environment Setup & Security Hardening**
  - **Description:** Set up Python environment with Streamlit, configure security settings, establish project structure
  - **Success Criteria:** Development environment ready, security scanners configured, baseline tests passing
  - **Testing Strategy:** Environment validation tests, dependency security scans

- [ ] **Task 2: Data Pipeline Architecture**
  - **Description:** Implement multi-source data collection system (APIs, CSV, scraping) with NLP entity extraction
  - **Success Criteria:** Data pipeline operational, entity extraction working, 25-50 sample events collected
  - **Testing Strategy:** Unit tests for data parsers, integration tests for pipeline, NLP accuracy validation

- [ ] **Task 3: Core Database & Storage System**
  - **Description:** Design and implement SQLite schema with CSV fallback, data normalization logic
  - **Success Criteria:** Database operational, data properly normalized, deduplication working
  - **Testing Strategy:** Database schema tests, data integrity validation, performance benchmarks

- [ ] **Task 4: Search & Filter Engine**
  - **Description:** Build search functionality with filtering by investor, sector, geography, and funding stage
  - **Success Criteria:** Search working, filters operational, sub-second response times
  - **Testing Strategy:** Search accuracy tests, filter validation, performance testing

- [ ] **Task 5: Streamlit Frontend Interface**
  - **Description:** Create responsive web interface with funding event cards, filtering sidebar, and export functionality
  - **Success Criteria:** UI functional, responsive design, all user journeys working
  - **Testing Strategy:** UI component tests, user flow testing, accessibility validation
  - **UI Components:** Top navigation bar, sidebar filters, funding event cards, data table view
  - **Design Implementation:** Custom CSS for climate theme, WCAG 2.1 AA compliance, mobile-adaptive layout

- [ ] **Task 6: Data Export & Visualization**
  - **Description:** Implement CSV export functionality and basic dashboard visualizations
  - **Success Criteria:** Export working, visualizations displaying correctly, dashboard functional
  - **Testing Strategy:** Export format validation, visualization accuracy tests
  - **Visualization Components:** Funding trends bar chart, sector distribution donut chart, geographic heatmap
  - **Dashboard Layout:** Clean, scannable design with 3-5 key metrics visible at glance

- [ ] **Task 7: Error Handling & Resilience**
  - **Description:** Implement comprehensive error handling, logging, and graceful failure recovery
  - **Success Criteria:** System resilient to failures, proper error messages, logging operational
  - **Testing Strategy:** Error simulation tests, logging validation, recovery testing

- [ ] **Task 8: Integration Testing & Deployment**
  - **Description:** End-to-end testing, performance optimization, deployment preparation
  - **Success Criteria:** All tests passing, performance targets met, deployment ready
  - **Testing Strategy:** Full integration testing, performance benchmarking, deployment validation

## 4. Data Architecture
* **Primary Data Sources:** NetZeroInsights API, OpenVC, public funding announcements
* **Data Processing:** NLP entity extraction using Gemini Flash 1.5 + spaCy
* **Storage Strategy:** SQLite for structured data, CSV for backup and export
* **Data Quality:** Deduplication, normalization, confidence scoring

## 4.1 UI Component Specifications

### **Layout Components:**
* **Top Navigation Bar:** 
  - Logo/Brand (left)
  - Global search bar (center)
  - Dashboard link, Settings, Export button (right)
  - Height: 60px, background: #ffffff, border-bottom: 1px solid #e9ecef

* **Sidebar Filter Panel:**
  - Width: 280px (collapsible to 60px)
  - Background: #f8f9fa
  - Filter sections: Funding Stage, Sector, Geography, Investor, Date Range
  - Apply/Reset buttons at bottom

* **Main Content Area:**
  - Flexible width (responsive to sidebar)
  - Padding: 24px
  - Background: #ffffff

### **Data Display Components:**
* **Funding Event Cards:**
  - Layout: Horizontal cards with expandable details
  - Primary info: Startup name (bold), Amount (highlighted), Stage (badge)
  - Secondary info: Investors (truncated), Date, Location, Sector
  - Expandable: Full investor list, source links, raw data snippet
  - Hover effects: Subtle shadow and border highlight

* **Data Table (Alternative View):**
  - Sortable columns: Startup, Amount, Stage, Date, Location
  - Row highlighting on hover
  - Expandable rows for detailed information

### **Filter Components:**
* **Multi-Select Dropdowns:**
  - Max height: 200px with scroll
  - Search within options
  - Selected items displayed as chips/tags
  - Clear all option

* **Date Range Picker:**
  - Preset ranges: Last 30 days, Last 3 months, Last year, Custom
  - Date inputs with calendar picker

* **Search Bar:**
  - Global search across startup names, investors, sectors
  - Autocomplete suggestions
  - Search history (local storage)

### **Visualization Components:**
* **Funding Trends Chart:**
  - Bar chart showing funding amounts over time
  - X-axis: Months/quarters, Y-axis: Total funding amount
  - Interactive tooltips with detailed information

* **Sector Distribution:**
  - Donut chart showing funding distribution by sector
  - Hover effects with percentage and amount details

* **Geographic Heatmap:**
  - Simple bar chart of funding by region/country
  - Color-coded by funding amount

### **Interactive Elements:**
* **Buttons:**
  - Primary: #2E8B57 background, white text
  - Secondary: Transparent with #2E8B57 border and text
  - Hover states with opacity changes
  - Minimum 44px height for accessibility

* **Badges/Tags:**
  - Funding stage badges with color coding
  - Sector tags with subtle background colors
  - Investor chips with hover tooltips

### **Responsive Breakpoints:**
* **Desktop:** > 1024px (full sidebar, detailed cards)
* **Tablet:** 768px - 1024px (collapsed sidebar, medium cards)
* **Mobile:** < 768px (minimal sidebar, compact cards, read-only)

## 5. Security Implementation Plan
* **Input Validation:** All user inputs sanitized and validated
* **Dependency Management:** Regular security updates and vulnerability scanning
* **Error Handling:** Secure error messages without information disclosure
* **Data Protection:** Public data only, no PII collection

## 6. Testing Strategy
* **Unit Testing:** pytest for all core functions and data processing
* **Integration Testing:** End-to-end pipeline testing
* **UI Testing:** Streamlit testing framework for user interface
* **Security Testing:** Dependency vulnerability scanning
* **Performance Testing:** Response time and load testing

## 7. Deployment Strategy
* **Development:** Local Streamlit development server
* **Demo:** Free-tier cloud deployment (Heroku/Railway)
* **Monitoring:** Basic logging and error tracking
* **Backup:** CSV export functionality for data backup 