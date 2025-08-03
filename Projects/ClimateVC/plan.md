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
  * **Fitts's Law Implementation:** Large, easily clickable filter buttons and card elements
  * **Hick's Law Application:** Simplified filter categories (sector, geography, investor, stage)
  * **Miller's Rule Adherence:** Information chunked into digestible cards (7±2 items per view)
  * **Jakob's Law Compliance:** Familiar data table and card layouts users expect
  * **Krug's Usability Principles:** Self-evident interface with clear labeling and minimal cognitive load
* **Accessibility Standard:** WCAG 2.1 AA compliance
* **Responsive Strategy:** Desktop-first with mobile adaptation
* **Information Architecture:** Flat navigation with sidebar filtering
* **Color System:** 
  * Primary: #2E8B57 (Sea Green - climate theme)
  * Secondary: #20B2AA (Light Sea Green)
  * Neutral: #F5F5F5 (Light Gray), #333333 (Dark Gray)
* **Typography:** System fonts with clear hierarchy for data readability

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

- [ ] **Task 6: Data Export & Visualization**
  - **Description:** Implement CSV export functionality and basic dashboard visualizations
  - **Success Criteria:** Export working, visualizations displaying correctly, dashboard functional
  - **Testing Strategy:** Export format validation, visualization accuracy tests

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