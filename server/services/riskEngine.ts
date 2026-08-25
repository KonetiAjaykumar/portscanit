export interface PortRiskAssessment {
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  explanation: string;
  recommendation: string;
}

export function assessPortRisk(port: number, service: string): PortRiskAssessment {
  switch (port) {
    case 23: // Telnet
      return {
        riskLevel: 'Critical',
        explanation: 'Telnet transmits all communications, including login credentials, in clear plaintext. It has no built-in encryption and is highly vulnerable to sniffing and man-in-the-middle attacks.',
        recommendation: 'Disable the Telnet service immediately. Migrate remote command-line access to SSH (Port 22).'
      };
    case 445: // SMB
      return {
        riskLevel: 'Critical',
        explanation: 'Server Message Block (SMB) is heavily targeted by ransomware, wormable exploits (such as EternalBlue/WannaCry), and lateral movement attacks. Exposing SMB directly to the public internet is a severe vulnerability.',
        recommendation: 'Block port 445 at your external firewall immediately. Ensure SMB is only accessible locally or through a secure VPN.'
      };
    case 6379: // Redis
      return {
        riskLevel: 'Critical',
        explanation: 'Redis in-memory databases are often configured without authentication by default. Public exposure allows unauthorized actors to read, write, or destroy data, and can lead to remote code execution.',
        recommendation: 'Configure strong password authentication, bind Redis to localhost (127.0.0.1) only, and restrict external firewall access.'
      };
    case 21: // FTP
      return {
        riskLevel: 'High',
        explanation: 'File Transfer Protocol (FTP) sends credentials and files over the network without encryption. Login details can easily be intercepted by an attacker.',
        recommendation: 'Decommission FTP and transition to a secure transfer protocol such as SFTP (SSH File Transfer Protocol) or HTTPS.'
      };
    case 3306: // MySQL
      return {
        riskLevel: 'High',
        explanation: 'Exposing MySQL databases to the internet invites constant brute-force credential stuffing attacks, SQL injection probing, and exploitation of potential server-side vulnerabilities.',
        recommendation: 'Restrict MySQL access to local services or trusted IPs. Enable SSL/TLS for connections and utilize SSH tunneling for remote management.'
      };
    case 5432: // PostgreSQL
      return {
        riskLevel: 'High',
        explanation: 'Public exposure of PostgreSQL database servers leaves them open to brute-force attacks and security bypass vulnerabilities.',
        recommendation: 'Modify pg_hba.conf to disable public access. Restrict listening interfaces to local addresses (127.0.0.1) and enforce strict TLS validation.'
      };
    case 3389: // RDP
      return {
        riskLevel: 'High',
        explanation: 'Remote Desktop Protocol (RDP) is a major vector for ransomware attacks, persistent credential brute-forcing, and remote takeover exploits.',
        recommendation: 'Never expose RDP directly to the internet. Enforce Network Level Authentication (NLA), change the default port, or require a VPN to connect.'
      };
    case 22: // SSH
      return {
        riskLevel: 'Medium',
        explanation: 'SSH provides encrypted remote administration. While secure, public SSH interfaces are subject to non-stop automated dictionary brute-force attempts.',
        recommendation: 'Disable password authentication and require cryptographic SSH key pairs. Restrict SSH access to whitelisted IP addresses or use a non-standard port.'
      };
    case 25: // SMTP
      return {
        riskLevel: 'Medium',
        explanation: 'Simple Mail Transfer Protocol (SMTP) servers can be exploited for email spoofing, user enumeration, or hijacked as open relays to distribute spam.',
        recommendation: 'Disable open relay configurations. Enforce SMTP authentication and require STARTTLS encryption for all message transmissions.'
      };
    case 80: // HTTP
      return {
        riskLevel: 'Low',
        explanation: 'HTTP connections are unencrypted. Any data, credentials, or session cookies transmitted over HTTP can be intercepted by eavesdroppers.',
        recommendation: 'Install an SSL/TLS certificate and configure the web server to automatically redirect all HTTP traffic to HTTPS (Port 443).'
      };
    case 443: // HTTPS
      return {
        riskLevel: 'Low',
        explanation: 'HTTPS provides encrypted web communication. Exposing it is standard for web services, assuming the underlying application and SSL/TLS configuration are secure.',
        recommendation: 'Keep web server software patched. Disable legacy protocols (TLS 1.0, 1.1) and outdated cipher suites in favor of TLS 1.2 or TLS 1.3.'
      };
    case 8080: // HTTP Alternate
      return {
        riskLevel: 'Low',
        explanation: 'Port 8080 is commonly used for secondary web servers or admin panels. Raw HTTP traffic on this port is unencrypted.',
        recommendation: 'Enforce HTTPS for alternate web ports or proxy them behind a secure reverse proxy.'
      };
    default:
      return {
        riskLevel: 'Low',
        explanation: `An open port was detected running the '${service}' service. While not immediately indicating a vulnerability, exposing unnecessary ports increases the system's attack surface.`,
        recommendation: 'Verify if this port is strictly required for business operations. If not, close the port or limit access to specific IP ranges using a local firewall.'
      };
  }
}

export function calculateOverallRisk(openPorts: { port: number; service: string }[]): {
  score: number;
  level: 'Low' | 'Medium' | 'High' | 'Critical';
  factors: string[];
} {
  if (openPorts.length === 0) {
    return {
      score: 0,
      level: 'Low',
      factors: ['No open ports were discovered.']
    };
  }

  let totalScore = 0;
  const factors: string[] = [];
  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  for (const item of openPorts) {
    const assessment = assessPortRisk(item.port, item.service);
    if (assessment.riskLevel === 'Critical') {
      totalScore += 35;
      criticalCount++;
    } else if (assessment.riskLevel === 'High') {
      totalScore += 20;
      highCount++;
    } else if (assessment.riskLevel === 'Medium') {
      totalScore += 10;
      mediumCount++;
    } else {
      totalScore += 2;
      lowCount++;
    }
  }

  // Cap score at 100
  const finalScore = Math.min(100, totalScore);

  if (criticalCount > 0) {
    factors.push(`${criticalCount} exposed Critical risk service(s) (e.g. Telnet, SMB, Redis) detected.`);
  }
  if (highCount > 0) {
    factors.push(`${highCount} exposed High risk service(s) (e.g. FTP, Databases, RDP) detected.`);
  }
  if (mediumCount > 0) {
    factors.push(`${mediumCount} exposed Medium risk service(s) (e.g. SSH, SMTP) detected.`);
  }
  if (lowCount > 0) {
    factors.push(`${lowCount} exposed Low risk service(s) (e.g. HTTP, HTTPS, generic) detected.`);
  }

  let level: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';
  if (finalScore >= 71) {
    level = 'Critical';
  } else if (finalScore >= 36) {
    level = 'High';
  } else if (finalScore >= 11) {
    level = 'Medium';
  }

  return {
    score: finalScore,
    level,
    factors
  };
}
