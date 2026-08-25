// Loaded SMTP Env Config
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import net from 'net';
import nodemailer from 'nodemailer';
import { 
  resolveTarget, 
  scanPortRange, 
  PortScanResult
} from './scanner/scanner';
import { 
  assessPortRisk, 
  calculateOverallRisk 
} from './services/riskEngine';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Track active scanning tasks in-memory
interface ActiveScan {
  id: string;
  target: string;
  resolvedIp: string;
  startPort: number;
  endPort: number;
  portsToScan: number[];
  abortSignal: { aborted: boolean };
  startTime: string;
  progress: {
    scannedCount: number;
    openCount: number;
    closedCount: number;
    filteredCount: number;
    currentPort: number;
    elapsedTime: number; // ms
  };
  results: PortScanResult[];
  clients: express.Response[];
}

const activeScans = new Map<string, ActiveScan>();

// Target host validation (IPv4 or Domain format)
function isValidTarget(target: string): boolean {
  const cleaned = target.trim();
  if (net.isIP(cleaned) === 4) return true; // IPv4
  if (net.isIP(cleaned) === 6) return false;

  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$/;
  return domainRegex.test(cleaned);
}

// REST endpoints

// 1. Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime() 
  });
});

// 2. Start Scan
app.post('/api/scan', async (req, res) => {
  const { target, startPort, endPort, customPorts, timeout = 1500, concurrency = 50 } = req.body;

  // Validation
  if (!target || typeof target !== 'string' || !isValidTarget(target)) {
    return res.status(400).json({ error: 'Invalid target host. Must be a valid IPv4 address or domain name.' });
  }

  let portsList: number[] = [];

  if (customPorts && Array.isArray(customPorts)) {
    portsList = customPorts.map(p => Number(p)).filter(p => !isNaN(p) && p >= 1 && p <= 65535);
    if (portsList.length === 0) {
      return res.status(400).json({ error: 'Custom ports list is empty or contains invalid ports.' });
    }
  } else {
    const sPort = Number(startPort);
    const ePort = Number(endPort);

    if (isNaN(sPort) || isNaN(ePort) || sPort < 1 || sPort > 65535 || ePort < 1 || ePort > 65535) {
      return res.status(400).json({ error: 'Ports must be integers between 1 and 65535.' });
    }

    if (sPort > ePort) {
      return res.status(400).json({ error: 'Start port cannot exceed end port.' });
    }
    
    for (let p = sPort; p <= ePort; p++) {
      portsList.push(p);
    }
  }

  const scanId = uuidv4();
  const startTime = new Date().toISOString();

  try {
    const resolvedIp = await resolveTarget(target);

    const activeScan: ActiveScan = {
      id: scanId,
      target,
      resolvedIp,
      startPort: customPorts ? portsList[0] : Number(startPort),
      endPort: customPorts ? portsList[portsList.length - 1] : Number(endPort),
      portsToScan: portsList,
      abortSignal: { aborted: false },
      startTime,
      progress: {
        scannedCount: 0,
        openCount: 0,
        closedCount: 0,
        filteredCount: 0,
        currentPort: 0,
        elapsedTime: 0
      },
      results: [],
      clients: []
    };

    activeScans.set(scanId, activeScan);

    // Fire off scan asynchronously
    runBackgroundScan(activeScan, Number(timeout), Number(concurrency));

    res.json({
      id: scanId,
      target,
      resolvedIp,
      startPort: activeScan.startPort,
      endPort: activeScan.endPort,
      totalPorts: portsList.length,
      status: 'scanning'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. SSE Streaming endpoint for real-time progress update
app.get('/api/scans/:id/stream', (req, res) => {
  const scanId = req.params.id;
  const activeScan = activeScans.get(scanId);

  if (!activeScan) {
    res.status(404).json({ error: 'Active scan not found.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const keepAliveInterval = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  // Register client
  activeScan.clients.push(res);

  // Send initial state
  res.write(`event: init\n`);
  res.write(`data: ${JSON.stringify({
    id: activeScan.id,
    target: activeScan.target,
    resolvedIp: activeScan.resolvedIp,
    totalPorts: activeScan.portsToScan.length,
    progress: activeScan.progress,
    results: activeScan.results
  })}\n\n`);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    if (activeScan) {
      activeScan.clients = activeScan.clients.filter(c => c !== res);
    }
  });
});

// 4. Stop Active Scan
app.post('/api/scans/:id/stop', async (req, res) => {
  const scanId = req.params.id;
  const activeScan = activeScans.get(scanId);

  if (!activeScan) {
    return res.status(404).json({ error: 'Active scan not found.' });
  }

  activeScan.abortSignal.aborted = true;
  res.json({ message: 'Stop scan request received.' });
});

// Background Scan Loop
async function runBackgroundScan(scan: ActiveScan, timeout: number, concurrency: number) {
  const startScanTime = Date.now();
  const allResults: PortScanResult[] = [];

  const broadcast = (event: string, data: any) => {
    scan.clients.forEach(client => {
      client.write(`event: ${event}\n`);
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  };

  try {
    await scanPortRange(
      scan.resolvedIp,
      scan.portsToScan,
      timeout,
      concurrency,
      (port, result) => {
        scan.progress.scannedCount++;
        scan.progress.currentPort = port;
        scan.progress.elapsedTime = Date.now() - startScanTime;

        allResults.push(result);

        if (result.state === 'OPEN') {
          scan.progress.openCount++;
          scan.results.push(result);
          broadcast('port', result);
        } else if (result.state === 'CLOSED') {
          scan.progress.closedCount++;
        } else {
          scan.progress.filteredCount++;
        }

        broadcast('progress', scan.progress);
      },
      scan.abortSignal
    );

    // Compute final payload stats in memory upon completion
    const endScanTime = Date.now();
    const duration = Math.round((endScanTime - startScanTime) / 1000);
    const status = scan.abortSignal.aborted ? 'stopped' : 'completed';

    const openPortsAssessment = scan.results.map(r => ({ port: r.port, service: r.service }));
    const riskEvaluation = calculateOverallRisk(openPortsAssessment);

    const finalScanPayload = {
      id: scan.id,
      target: scan.target,
      resolvedIp: scan.resolvedIp,
      start_port: scan.startPort,
      end_port: scan.endPort,
      status,
      start_time: scan.startTime,
      end_time: new Date().toISOString(),
      duration,
      ports_scanned: scan.progress.scannedCount,
      open_ports: scan.progress.openCount,
      closed_ports: scan.progress.closedCount,
      filtered_ports: scan.progress.filteredCount,
      risk_score: riskEvaluation.score,
      risk_level: riskEvaluation.level
    };

    const finalResultsPayload = allResults.map(r => {
      const risk = assessPortRisk(r.port, r.service);
      return {
        port: r.port,
        protocol: r.protocol,
        state: r.state,
        service: r.service,
        banner: r.banner,
        risk_level: risk.riskLevel,
        risk_explanation: risk.explanation,
        recommendation: risk.recommendation
      };
    });

    broadcast('completed', { scan: finalScanPayload, results: finalResultsPayload });

  } catch (err: any) {
    console.error('Scan error:', err.message);
    broadcast('error', { error: err.message });
  } finally {
    scan.clients.forEach(client => client.end());
    activeScans.delete(scan.id);
  }
}

// Email report sending endpoint using Nodemailer
app.post('/api/reports/email', async (req, res) => {
  const { recipientEmail, scanRecord } = req.body;
  if (!recipientEmail || !scanRecord) {
    return res.status(400).json({ error: 'Missing recipientEmail or scanRecord payload' });
  }

  try {
    const { scan, results } = scanRecord;

    // Set up Nodemailer transporter using saved SMTP credentials from .env
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'portscanit@gmail.com',
        pass: process.env.SMTP_PASS || 'yqli sbhp gamw wvqz'
      }
    });

    const openPortsCards = results
      .filter((r: any) => r.state === 'OPEN')
      .map((r: any) => `
        <div style="margin-bottom: 15px; padding: 12px 15px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #f8fafc; font-family: sans-serif;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; margin-bottom: 8px;">
            <span style="font-weight: bold; font-family: monospace; font-size: 15px; color: #0f172a;">Port ${r.port}/${r.protocol || 'TCP'}</span>
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; 
              ${r.risk_level === 'Critical' ? 'background-color: #fef2f2; color: #ef4444; border: 1px solid #fca5a5;' :
                r.risk_level === 'High' ? 'background-color: #fff7ed; color: #f97316; border: 1px solid #fdba74;' :
                r.risk_level === 'Medium' ? 'background-color: #fef9c3; color: #eab308; border: 1px solid #fef08a;' :
                'background-color: #f0fdf4; color: #10b981; border: 1px solid #86efac;'}">
              ${r.risk_level || 'Low'}
            </span>
          </div>
          <div style="font-size: 13px; color: #334155; margin-bottom: 4px;">
            <strong>Service Exposure:</strong> <span style="font-weight: 600; color: #0f172a;">${r.service}</span>
          </div>
          ${r.banner ? `
            <div style="margin-top: 6px;">
              <span style="font-size: 11px; font-weight: bold; color: #64748b; display: block; margin-bottom: 3px; font-family: monospace;">GRABBED_BANNER://</span>
              <div style="font-family: monospace; font-size: 11px; background-color: #0f172a; color: #38bdf8; padding: 10px; border-radius: 6px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; border: 1px solid #1e293b; line-height: 1.4;">${r.banner}</div>
            </div>
          ` : ''}
        </div>
      `).join('');

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; border-bottom: 2px solid #06b6d4; padding-bottom: 15px; margin-bottom: 20px;">
          <h1 style="color: #0f172a; margin: 0; font-size: 24px; letter-spacing: -0.025em;">PortScan<span style="color: #06b6d4;">IT</span> Security Report</h1>
          <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Automated Vulnerability Exposure Scan Report</p>
        </div>

        <h3 style="color: #0f172a; margin-top: 0;">Scan Summary</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Target Host</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; font-family: monospace; color: #0f172a;">${scan.target}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Scan Time</td>
            <td style="padding: 8px 0; text-align: right; color: #0f172a;">${new Date(scan.start_time).toLocaleString()}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Duration</td>
            <td style="padding: 8px 0; text-align: right; color: #0f172a;">${(scan.duration / 1000).toFixed(1)}s</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Total Open Ports</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #10b981;">${scan.open_ports}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; color: #64748b;">Risk Exposure Index</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${scan.risk_score >= 71 ? '#ef4444' : scan.risk_score >= 36 ? '#f97316' : scan.risk_score >= 11 ? '#eab308' : '#10b981'};">${scan.risk_score}/100</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Threat Level</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold; color: ${scan.risk_level === 'Critical' ? '#ef4444' : scan.risk_level === 'High' ? '#f97316' : scan.risk_level === 'Medium' ? '#eab308' : '#10b981'};">${scan.risk_level}</td>
          </tr>
        </table>

        <h3 style="color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 25px;">Exposed Interfaces (Open Ports)</h3>
        ${openPortsCards.length > 0 ? `
          <div style="margin-bottom: 25px;">
            ${openPortsCards}
          </div>
        ` : `
          <div style="padding: 20px; text-align: center; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #15803d; font-size: 14px; margin-bottom: 25px;">
            <strong>No vulnerabilities identified!</strong> No open ports were detected on this host.
          </div>
        `}

        <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; color: #94a3b8; font-size: 11px;">
          <p>This is an automated security advisory report generated by PortScanIT.</p>
          <p style="margin-top: 5px;"><strong>Security Advisory:</strong> Use this scan data strictly in accordance with authorized target sweeps.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || '"PortScanIt" <portscanit@gmail.com>',
      to: recipientEmail,
      subject: `[PortScanIT] Exposure Audit Advisory - Host ${scan.target}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: `Scan report emailed successfully to ${recipientEmail}` });
  } catch (err: any) {
    console.error('Email sending error:', err);
    res.status(500).json({ error: `Failed to send email: ${err.message}` });
  }
});

// Start API server directly
app.listen(PORT, () => {
  console.log(`PortScanIT backend listening on port ${PORT}`);
});
