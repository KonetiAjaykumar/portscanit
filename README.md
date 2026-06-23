# PortScanIt – Advanced Network Port Scanner & Security Dashboard

PortScanIt is a premium, responsive, commercial-grade cybersecurity diagnostic dashboard designed to visualize network audits, service mapping, and threat intelligence. 

It is built as a self-contained, single-page web application featuring high-fidelity diagnostic simulations. It allows developers and security enthusiasts to showcase dashboard UI/UX patterns, frontend engineering, and networking concepts directly in their portfolio.

👉 **Live Demo / How to Run:** Simply clone this repository and double-click `index.html` to open it in Google Chrome, Microsoft Edge, Firefox, or Safari.

---

## 🚀 Key Features

* **Premium SOC Aesthetics:** Sleek dark-mode interface styled with glassmorphism cards (`backdrop-filter`) and ambient glows.
* **Animated Network Background:** An interactive HTML5 `<canvas>` rendering connecting network nodes in the background.
* **Scanner Configuration Panel:** Options to define target IP/domains, port ranges (Common, Full, Custom), scan profiles (Normal, Fast, Deep), and concurrent thread limits.
* **Real-time Diagnostics Monitor:**
  - An animated conic gradient **radar scanner** responding to the chosen scan speed profile.
  - A monospaced **live logging terminal console** streaming diagnostic details (`[INFO]`, `[SCAN]`, `[OSINT]`, and `[ALERT]`).
  - Circular and linear percentage metrics indicating audit completeness.
* **Interactive Findings Table:**
  - Real-time updates as open ports are identified.
  - Filter by port state (Open/Filtered) or search by keyword (port number or service name).
  - One-click copy utility to save payload details to clipboard.
* **Visual Analytics (Chart.js):**
  - **Audit Distribution:** Doughnut chart detailing Open/Filtered/Closed port states.
  - **Target Threat Index:** A semi-doughnut risk meter calculating an overall threat score (Secure, Vulnerable, or Critical Risk).
* **Passive Threat Intel (Shodan Integration Simulator):** Displays cached records (ISP, operating systems, and vulnerabilities) without generating active network traffic.
* **Report Exporter:** Instantly download audit details in structured **JSON** and **CSV** formats, or use the print-optimized styles to export a formatted **PDF Report**.
* **Scan History Archive:** Simulated SQLite database storing and reloading previous scan summaries.
* **Educational Center:** Theoretical guides covering TCP 3-way handshakes, SYN stealth scans, banner grabbing, and defensive mitigations (firewalls, rate-limiting, port knocking).

---

## 🛠️ Technology Stack

* **Structure & UI:** HTML5 & Vanilla CSS3 (Custom Glassmorphism and Animations)
* **Styling Framework:** Tailwind CSS (via CDN)
* **Charts & Visualizations:** Chart.js (via CDN)
* **Iconography:** Lucide Icons (via CDN)
* **Animations:** Canvas Particle System & CSS Keyframes

---

## 🔒 Security Compliance

This application is built for **portfolio demonstration and educational purposes**:
- **Simulated Scanning:** It executes standard diagnostic audits through a high-fidelity simulation engine. It does not open sockets to scan remote networks or expose your system to local networking failures.
- **API Key Security:** No tokens or API keys are hardcoded in the frontend, preventing credential leakage in production or version control.

---

## 📄 License

This project is licensed under the MIT License. Feel free to modify and expand upon it for your resume and portfolio showcase!
