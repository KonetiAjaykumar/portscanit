import { VercelRequest, VercelResponse } from '@vercel/node';
import net from 'net';
import dns from 'dns';
import { v4 as uuidv4 } from 'uuid';

export const SERVICE_MAP: Record<number, string> = {
  20: 'FTP Data',
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  443: 'HTTPS',
  445: 'SMB',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  6379: 'Redis',
  8080: 'HTTP Alternate'
};

function getServiceForPort(port: number): string {
  return SERVICE_MAP[port] || 'Unknown';
}

function resolveTarget(target: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleaned = target.trim();
    if (net.isIP(cleaned)) {
      return resolve(cleaned);
    }
    dns.lookup(cleaned, { family: 4 }, (err, address) => {
      if (err) {
        reject(new Error(`DNS resolution failed for target '${cleaned}': ${err.message}`));
      } else {
        resolve(address);
      }
    });
  });
}

function scanPort(host: string, port: number, timeoutMs: number): Promise<any> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let state: 'OPEN' | 'CLOSED' | 'FILTERED' = 'FILTERED';
    let banner = 'Not detected';
    let timer: NodeJS.Timeout;
    let finished = false;

    const done = (finalState: 'OPEN' | 'CLOSED' | 'FILTERED', finalBanner: string) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.destroy();
      resolve({
        port,
        state: finalState,
        banner: finalBanner
      });
    };

    timer = setTimeout(() => {
      done('FILTERED', banner);
    }, timeoutMs);

    socket.connect(port, host, () => {
      state = 'OPEN';
      const webPorts = [80, 443, 8080];
      let dataReceived = false;

      socket.on('data', (chunk) => {
        dataReceived = true;
        const content = chunk.toString('utf8');
        if (webPorts.includes(port)) {
          const serverMatch = content.match(/Server:\s*([^\r\n]+)/i);
          banner = serverMatch ? serverMatch[1].trim() : content.split('\n')[0].trim().substring(0, 60);
        } else {
          banner = content.trim().replace(/[\r\n]+/g, ' ').substring(0, 80);
        }
        done('OPEN', banner);
      });

      if (webPorts.includes(port)) {
        socket.write('HEAD / HTTP/1.0\r\n\r\n');
        setTimeout(() => {
          if (!dataReceived) done('OPEN', 'Not detected');
        }, 400);
      } else {
        socket.write('\r\n');
        setTimeout(() => {
          if (!dataReceived) done('OPEN', 'Not detected');
        }, 300);
      }
    });

    socket.on('error', (err: any) => {
      if (err.code === 'ECONNREFUSED') {
        done('CLOSED', banner);
      } else {
        done('FILTERED', banner);
      }
    });
  });
}

function assessPortRisk(port: number, service: string): any {
  switch (port) {
    case 23:
      return {
        riskLevel: 'Critical',
        explanation: 'Telnet transmits all communications in clear plaintext, making credentials vulnerable to interception.',
        recommendation: 'Disable the Telnet service immediately. Migrate remote command-line access to SSH (Port 22).'
      };
    case 445:
      return {
        riskLevel: 'Critical',
        explanation: 'SMB is heavily targeted by ransomware, wormable exploits (EternalBlue), and lateral movement attacks.',
        recommendation: 'Block port 445 at external firewalls. Ensure SMB is only accessible locally or via VPN.'
      };
    case 6379:
      return {
        riskLevel: 'Critical',
        explanation: 'Redis in-memory databases are unsecured by default, risking data theft or remote code execution.',
        recommendation: 'Configure strong password authentication, bind Redis to localhost, and restrict external firewall access.'
      };
    case 21:
      return {
        riskLevel: 'High',
        explanation: 'FTP sends credentials and files over the network without encryption, making logins easily sniffable.',
        recommendation: 'Decommission FTP and transition to a secure transfer protocol such as SFTP or HTTPS.'
      };
    case 3306:
      return {
        riskLevel: 'High',
        explanation: 'Exposing MySQL database ports publically invites brute-force credential stuffing and exploit injection attacks.',
        recommendation: 'Restrict database access to trusted IPs and utilize SSH tunneling for remote management.'
      };
    case 5432:
      return {
        riskLevel: 'High',
        explanation: 'Public exposure of PostgreSQL database servers leaves them open to brute-force attacks and authentication bypasses.',
        recommendation: 'Disable public access, configure listening interfaces to local addresses, and enforce TLS validation.'
      };
    case 3389:
      return {
        riskLevel: 'High',
        explanation: 'RDP is a primary vector for ransomware attacks, credential brute-forcing, and remote takeover exploits.',
        recommendation: 'Never expose RDP directly. Require NLA, restrict IP endpoints, or require a VPN to connect.'
      };
    case 22:
      return {
        riskLevel: 'Medium',
        explanation: 'SSH is encrypted but public interfaces face constant automated login brute-force attempts.',
        recommendation: 'Disable password logins and require cryptographic SSH key pairs. Restrict host access to whitelisted IPs.'
      };
    case 25:
      return {
        riskLevel: 'Medium',
        explanation: 'SMTP mail ports are vulnerable to email spoofing, user discovery probes, or hijacked open relay spamming.',
        recommendation: 'Disable open relay configurations, enforce SMTP authentication, and require STARTTLS encryption.'
      };
    case 80:
      return {
        riskLevel: 'Low',
        explanation: 'HTTP connections are unencrypted. Credentials and session tokens transmitted here can be sniffed.',
        recommendation: 'Install an SSL certificate and redirect all unencrypted HTTP traffic to HTTPS (Port 443).'
      };
    case 443:
      return {
        riskLevel: 'Low',
        explanation: 'HTTPS provides encrypted communication. Secure configuration requires modern cipher libraries.',
        recommendation: 'Keep SSL software packages patched and disable outdated TLS protocols (TLS 1.0, 1.1) in server settings.'
      };
    default:
      return {
        riskLevel: 'Low',
        explanation: `An open port was detected running '${service}'. Exposing unnecessary ports increases attack surfaces.`,
        recommendation: 'Verify if this port is required. If not, restrict exposure using local firewall rules.'
      };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { target, startPort, endPort, customPorts, timeout = 300, concurrency = 50 } = req.body;

  if (!target) {
    return res.status(400).json({ error: 'Missing target hostname or IP address' });
  }

  try {
    const resolvedIp = await resolveTarget(target);

    // Build ports range list
    let portsList: number[] = [];
    if (customPorts && Array.isArray(customPorts)) {
      portsList = customPorts.map(Number).filter(p => !isNaN(p) && p >= 1 && p <= 65535);
    } else {
      const sPort = Math.max(1, Number(startPort || 1));
      const ePort = Math.min(65535, Number(endPort || 1024));
      for (let p = sPort; p <= ePort; p++) {
        portsList.push(p);
      }
    }

    // Limit maximum ports per single serverless scan to avoid Vercel 10s timeout
    const maxPorts = 200;
    const finalPorts = portsList.slice(0, maxPorts);

    // Scan concurrently in chunks
    const allResults: any[] = [];
    const timeoutVal = Math.min(Number(timeout), 400);
    const chunkSize = Math.min(Number(concurrency), 60);

    for (let i = 0; i < finalPorts.length; i += chunkSize) {
      const chunk = finalPorts.slice(i, i + chunkSize);
      const promises = chunk.map(p => scanPort(resolvedIp, p, timeoutVal));
      const chunkRes = await Promise.all(promises);
      allResults.push(...chunkRes);
    }

    let openCount = 0;
    let closedCount = 0;
    let filteredCount = 0;
    let accumulatedRiskScore = 0;

    const formattedResults = allResults.map(r => {
      const service = getServiceForPort(r.port);
      let riskLevel = 'Low';
      let risk_explanation = '';
      let recommendation = '';

      if (r.state === 'OPEN') {
        openCount++;
        const risk = assessPortRisk(r.port, service);
        riskLevel = risk.riskLevel;
        risk_explanation = risk.explanation;
        recommendation = risk.recommendation;

        if (riskLevel === 'Critical') accumulatedRiskScore += 35;
        else if (riskLevel === 'High') accumulatedRiskScore += 20;
        else if (riskLevel === 'Medium') accumulatedRiskScore += 10;
        else accumulatedRiskScore += 2;
      } else if (r.state === 'CLOSED') {
        closedCount++;
      } else {
        filteredCount++;
      }

      return {
        port: r.port,
        protocol: 'TCP',
        state: r.state,
        service,
        banner: r.banner,
        risk_level: riskLevel,
        risk_explanation,
        recommendation
      };
    });

    const riskScore = Math.min(accumulatedRiskScore, 100);
    let riskLevel = 'Low';
    if (riskScore >= 71) riskLevel = 'Critical';
    else if (riskScore >= 36) riskLevel = 'High';
    else if (riskScore >= 11) riskLevel = 'Medium';

    const finalScan = {
      id: uuidv4(),
      target,
      start_port: finalPorts[0] || 1,
      end_port: finalPorts[finalPorts.length - 1] || 1024,
      status: 'COMPLETED',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      duration: 1200,
      ports_scanned: finalPorts.length,
      open_ports: openCount,
      closed_ports: closedCount,
      filtered_ports: filteredCount,
      risk_score: riskScore,
      risk_level: riskLevel
    };

    res.status(200).json({ scan: finalScan, results: formattedResults });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
