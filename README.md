# PortScanIT — Professional Port Scanner & SOC Audit Console

PortScanIT is a secure, web-based cyber auditing platform that provides network penetration testing metrics, real-time TCP port sweeps, service banner analysis, and rule-based risk calculations.

> [!WARNING]
> **Authorized Security Testing Only:** Scan only systems you own or have explicit permission to test. Exposing or sweeping networks without consent is prohibited and may violate local and international cyber regulations.

---

## 🛠️ Architecture & Technical Stack

- **Frontend:** React (v18) + TypeScript + Vite + Tailwind CSS v3
- **Data Charts:** Recharts (visualization panels)
- **Reports:** jsPDF (vector document compiler) & CSV builders
- **Backend:** Node.js + Express + TypeScript (`ts-node-dev`)
- **Persistence:** SQLite (`sqlite3` lightweight local store)
- **Scanning Module:** Raw Node.js `net.Socket` connectivity (zero native wrap dependencies)

---

## 🚀 Installation & Local Startup

### 1. Prerequisites
Ensure you have **Node.js** (v18 or higher) and **npm** installed.

### 2. Dependency Synchronization
From the project root directory, install all package trees concurrently:
```bash
# Bypasses execution policies on Windows if needed
cmd /c npm run install:all
```
This script populates `node_modules` for root, `/client`, and `/server`.

### 3. Running Services
Start the development server configurations for both client (Port 5173) and backend API (Port 3000):
```bash
cmd /c npm run dev
```
Navigate to `http://localhost:5173` to access the console interface.

---

## 🔍 How TCP Connect Scanning Works

PortScanIT implements a **TCP Connect Scanner** utilizing the Node.js `net` library:

1. **DNS Target Resolution:** Resolves input hostnames using `dns.lookup` before connection loops start.
2. **Controlled Concurrency:** Launches connection routines using a Promise-based worker pool (defaults to 50 concurrent sockets) to prevent local file descriptor leaks.
3. **Connect Routines:**
   - A standard TCP socket handshake is initiated to the target IP and Port.
   - If the connection completes (`connect` event), the port state is set to `OPEN`.
   - If the connection fails with `ECONNREFUSED`, the port is marked `CLOSED`.
   - If connection limits exceed the default timeout (1500ms) or drop with routing errors, it returns `FILTERED`.
4. **Banner Harvesting:**
   - For services that self-announce (e.g. SSH on 22, FTP on 21), the scanner reads the initial handshake banner.
   - For HTTP/HTTPS web endpoints, it writes a `HEAD / HTTP/1.0` probe to parse the server software header.
5. **SQLite Commits:** Results are processed in a single fast database transaction.

---

## 📋 API Documentation

### 1. Backend Diagnostics
- **Endpoint:** `GET /api/health`
- **Description:** Verifies SQLite connectivity and reports system uptime metrics.

### 2. Begin Audit
- **Endpoint:** `POST /api/scan`
- **Payload:**
  ```json
  {
    "target": "127.0.0.1",
    "startPort": 1,
    "endPort": 1024,
    "timeout": 1500,
    "concurrency": 50
  }
  ```
- **Response:**
  ```json
  {
    "id": "c1f7a0b3-f0a9-4679-bfa2-9388f61536b2",
    "target": "127.0.0.1",
    "resolvedIp": "127.0.0.1",
    "startPort": 1,
    "endPort": 1024,
    "totalPorts": 1024,
    "status": "scanning"
  }
  ```

### 3. Server-Sent Events (SSE) Live Feed
- **Endpoint:** `GET /api/scans/:id/stream`
- **Description:** Emits real-time scanning logs (`progress`, `port`, `completed` events) to updates panels.

### 4. Halt Action
- **Endpoint:** `POST /api/scans/:id/stop`
- **Description:** Sets internal abort flags, writing completed results to the DB.

### 5. Fetch Archives
- **Endpoint:** `GET /api/scans`
- **Description:** Returns lists of historic scans.

### 6. Delete Archives
- **Endpoint:** `DELETE /api/scans/:id`

---

## 🔒 Security Principles & Limitations

1. **No Exploits:** PortScanIT identifies exposed socket interfaces. It does not exploit buffer overflows, execute brute force credentials, or test vulnerabilities.
2. **Not Simulated:** Scans perform full three-way handshakes to collect active banners.
3. **No Root Requirement:** Running connect scans does not require administrative root/raw socket privileges, ensuring safe application environment sandboxing.
