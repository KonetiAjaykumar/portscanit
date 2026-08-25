import net from 'net';
import dns from 'dns';

export interface PortScanResult {
  port: number;
  protocol: 'TCP';
  state: 'OPEN' | 'CLOSED' | 'FILTERED';
  service: string;
  banner: string;
}

// Service mapping as specified in requirements
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

export function getServiceForPort(port: number): string {
  return SERVICE_MAP[port] || 'Unknown';
}

// Resolve IP address from target string (domain or IP)
export function resolveTarget(target: string): Promise<string> {
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

// Scans a single port and attempts banner grabbing on OPEN ports
export function scanPort(host: string, port: number, timeoutMs: number): Promise<PortScanResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let state: 'OPEN' | 'CLOSED' | 'FILTERED' = 'FILTERED';
    let banner = 'Not detected';
    let timer: NodeJS.Timeout;
    let finished = false;

    const cleanup = () => {
      clearTimeout(timer);
      socket.destroy();
      socket.unref();
    };

    const done = (finalState: 'OPEN' | 'CLOSED' | 'FILTERED', finalBanner: string) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve({
        port,
        protocol: 'TCP',
        state: finalState,
        service: getServiceForPort(port),
        banner: finalBanner
      });
    };

    // Set connection timeout
    timer = setTimeout(() => {
      done('FILTERED', banner);
    }, timeoutMs);

    socket.connect(port, host, () => {
      state = 'OPEN';

      const portsWithGreetings = [21, 22, 23, 25, 110, 143];
      const webPorts = [80, 443, 8080];
      let dataReceived = false;

      // Handle banner reading
      socket.on('data', (chunk) => {
        dataReceived = true;
        const content = chunk.toString('utf8');
        
        // Parse HTTP server banners
        if (webPorts.includes(port)) {
          const serverMatch = content.match(/Server:\s*([^\r\n]+)/i);
          if (serverMatch) {
            banner = serverMatch[1].trim();
          } else {
            const firstLine = content.split('\n')[0].trim();
            if (firstLine.startsWith('HTTP/')) {
              banner = firstLine;
            } else {
              banner = content.trim().substring(0, 60);
            }
          }
        } else {
          // Standard banner / raw string greeting
          banner = content.trim().replace(/[\r\n]+/g, ' ').substring(0, 80);
        }
        done('OPEN', banner);
      });

      if (portsWithGreetings.includes(port)) {
        // Wait up to 800ms for greeting data
        setTimeout(() => {
          if (!dataReceived) done('OPEN', 'Not detected');
        }, 800);
      } else if (webPorts.includes(port)) {
        // Send a simple HTTP request to prompt header banner
        socket.write('HEAD / HTTP/1.0\r\n\r\n');
        setTimeout(() => {
          if (!dataReceived) done('OPEN', 'Not detected');
        }, 800);
      } else {
        // Write standard carriage return to prompt greeting (e.g. databases, redis)
        socket.write('\r\n');
        setTimeout(() => {
          if (!dataReceived) done('OPEN', 'Not detected');
        }, 600);
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

// Scans a list of ports with controlled concurrency and abort signaling
export async function scanPortRange(
  host: string,
  ports: number[],
  timeoutMs: number,
  maxConcurrency: number,
  onProgress: (port: number, result: PortScanResult) => void,
  abortSignal: { aborted: boolean }
): Promise<PortScanResult[]> {
  const results: PortScanResult[] = [];
  let index = 0;

  async function worker() {
    while (index < ports.length && !abortSignal.aborted) {
      const port = ports[index++];
      const result = await scanPort(host, port, timeoutMs);
      results.push(result);
      onProgress(port, result);
    }
  }

  const workers: Promise<void>[] = [];
  const activeWorkersCount = Math.min(maxConcurrency, ports.length);
  for (let i = 0; i < activeWorkersCount; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}
