import { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recipientEmail, scanRecord } = req.body;
  if (!recipientEmail || !scanRecord) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const { scan, results } = scanRecord;

    // Mail server configuration from environment variables
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'ajaykumarkoneti0@gmail.com',
        pass: process.env.SMTP_PASS || 'yqlisbhpgamwwvqz'
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
    res.status(200).json({ success: true, message: `Report successfully emailed to ${recipientEmail}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
