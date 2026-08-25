import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { 
  FileSpreadsheet, 
  Info,
  CheckCircle,
  FileDown,
  Mail
} from 'lucide-react';
import { ScanRecord } from '../App';

interface ReportsProps {
  scansHistory: ScanRecord[];
  theme?: 'dark' | 'light';
}

export const Reports: React.FC<ReportsProps> = ({ scansHistory, theme }) => {
  const [selectedScanId, setSelectedScanId] = useState<string>('');
  const [selectedScan, setSelectedScan] = useState<any | null>(null);
  const [scanResults, setScanResults] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [emailing, setEmailing] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [emailMessage, setEmailMessage] = useState('');

  const scans = scansHistory.map(item => item.scan);

  // Set default selection
  useEffect(() => {
    if (scansHistory.length > 0) {
      const redirectScanId = sessionStorage.getItem('portscanit_view_scan_id');
      if (redirectScanId && scansHistory.some(s => s.scan.id === redirectScanId)) {
        setSelectedScanId(redirectScanId);
        sessionStorage.removeItem('portscanit_view_scan_id');
      } else if (!selectedScanId || !scansHistory.some(s => s.scan.id === selectedScanId)) {
        setSelectedScanId(scansHistory[0].scan.id);
      }
    }
  }, [scansHistory]);

  // Load details locally from props
  useEffect(() => {
    if (!selectedScanId) {
      setSelectedScan(null);
      setScanResults([]);
      return;
    }

    const match = scansHistory.find(item => item.scan.id === selectedScanId);
    if (match) {
      setSelectedScan(match.scan);
      setScanResults(match.results);
    }
  }, [selectedScanId, scansHistory]);

  const handleExportCSV = () => {
    if (!selectedScan || scanResults.length === 0) return;

    const headers = ['Port', 'Protocol', 'State', 'Service', 'Banner', 'Risk Level', 'Explanation', 'Recommendation'];
    const rows = scanResults.map(r => [
      r.port,
      r.protocol,
      r.state,
      r.service,
      `"${(r.banner || 'Not detected').replace(/"/g, '""')}"`,
      r.risk_level,
      `"${r.risk_explanation.replace(/"/g, '""')}"`,
      `"${r.recommendation.replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `portscanit_report_${selectedScan.target.replace(/\./g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (!selectedScan || scanResults.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 15;

    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 20) {
        doc.addPage();
        y = 20;
        // Page border/header in new page
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.5);
        doc.line(15, 12, pageWidth - 15, 12);
      }
    };

    // --- Page 1 Header Bar ---
    doc.setFillColor(8, 12, 20); // Cyber BG
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(6, 182, 212); // Cyan Accent
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('PortScanIT', 15, 20);

    doc.setTextColor(243, 244, 246); // Off-white
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('PROFESSIONAL PENETRATION TESTING & AUDIT REPORT', 15, 30);

    // Date
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 70, 30);

    y = 55;

    // --- Target Information Card ---
    doc.setFillColor(248, 250, 252); // Light gray panel
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, pageWidth - 30, 42, 3, 3, 'FD');

    doc.setTextColor(15, 23, 42); // Slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('SCAN PARAMETERS & METRICS', 20, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105); // Slate-600

    doc.text(`Target Hostname / IP:`, 20, y + 17);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(selectedScan.target, 65, y + 17);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Scan Date Range:`, 20, y + 24);
    doc.text(`${new Date(selectedScan.start_time).toLocaleString()}`, 65, y + 24);

    doc.text(`Scan Duration:`, 20, y + 31);
    doc.text(`${selectedScan.duration || 0} seconds`, 65, y + 31);

    doc.text(`Range Audited:`, 20, y + 38);
    doc.text(`Ports ${selectedScan.start_port} - ${selectedScan.end_port}`, 65, y + 38);

    // Right Column Metrics
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Total Ports Scanned:`, 120, y + 17);
    doc.text(`${selectedScan.ports_scanned}`, 165, y + 17);

    doc.text(`Open Ports (Hits):`, 120, y + 24);
    doc.setTextColor(16, 185, 129); // Emerald-500
    doc.setFont('helvetica', 'bold');
    doc.text(`${selectedScan.open_ports}`, 165, y + 24);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Overall Risk Rating:`, 120, y + 31);
    
    // Color code risk level
    const lvl = selectedScan.risk_level.toUpperCase();
    if (lvl === 'CRITICAL' || lvl === 'HIGH') doc.setTextColor(239, 68, 68);
    else if (lvl === 'MEDIUM') doc.setTextColor(245, 158, 11);
    else doc.setTextColor(16, 185, 129);

    doc.setFont('helvetica', 'bold');
    doc.text(`${selectedScan.risk_level} (${selectedScan.risk_score}/100)`, 165, y + 31);

    y += 55;

    // --- Executive Risk Assessment Header ---
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('EXECUTIVE RISK ANALYSIS', 15, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    
    const introText = doc.splitTextToSize(
      `Based on the security scan performed on target ${selectedScan.target}, the system has been graded with a Risk Score of ${selectedScan.risk_score}/100, which evaluates to a ${selectedScan.risk_level} Risk Level. This assessment is calculated based on the quantity and severity of exposed TCP services. Note that an open port indicates network exposure and does not automatically imply the service is actively exploited or vulnerable; however, reducing unnecessary exposed interfaces is recommended to minimize target attack surface.`, 
      pageWidth - 30
    );
    doc.text(introText, 15, y);
    y += introText.length * 4.5 + 8;

    // --- Port Findings Table ---
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('DETAILED AUDIT FINDINGS', 15, y);
    y += 8;

    // Table Headers
    doc.setFillColor(226, 232, 240); // header fill
    doc.rect(15, y, pageWidth - 30, 8, 'F');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('PORT', 20, y + 5.5);
    doc.text('SERVICE', 40, y + 5.5);
    doc.text('STATE', 75, y + 5.5);
    doc.text('RISK LEVEL', 105, y + 5.5);
    doc.text('BANNER GATHERED', 140, y + 5.5);
    
    y += 8;

    // Table Rows
    const openPorts = scanResults.filter(r => r.state === 'OPEN');
    if (openPorts.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text('No open TCP ports discovered during this auditing range.', 20, y + 6);
      y += 12;
    } else {
      doc.setFont('helvetica', 'normal');
      openPorts.forEach(r => {
        checkPageBreak(10);
        
        doc.setTextColor(15, 23, 42);
        doc.text(`${r.port}/TCP`, 20, y + 6);
        doc.text(r.service, 40, y + 6);
        
        doc.setTextColor(16, 185, 129);
        doc.text(r.state, 75, y + 6);

        // Risk Level styling
        const rLvl = r.risk_level.toUpperCase();
        if (rLvl === 'CRITICAL' || rLvl === 'HIGH') doc.setTextColor(239, 68, 68);
        else if (rLvl === 'MEDIUM') doc.setTextColor(245, 158, 11);
        else doc.setTextColor(16, 185, 129);
        
        doc.setFont('helvetica', 'bold');
        doc.text(r.risk_level, 105, y + 6);
        doc.setFont('helvetica', 'normal');

        doc.setTextColor(71, 85, 105);
        doc.text(r.banner ? r.banner.substring(0, 30) : 'Not detected', 140, y + 6);

        doc.setDrawColor(241, 245, 249);
        doc.line(15, y + 9, pageWidth - 15, y + 9);
        y += 10;
      });
    }

    y += 8;

    // --- Recommendations Section ---
    checkPageBreak(30);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('SECURITY ADVISORY & MITIGATION', 15, y);
    y += 8;

    if (openPorts.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text('All audited ports returned closed or filtered status. Exposing zero open TCP ports reduces standard remote entry channels. Maintain firewall vigilance and execute periodic credential reviews.', 15, y);
    } else {
      openPorts.forEach(r => {
        checkPageBreak(25);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(15, y, pageWidth - 30, 22, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(`Port ${r.port} (${r.service}) — Mitigation Strategy`, 18, y + 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);

        const recLines = doc.splitTextToSize(r.recommendation, pageWidth - 40);
        doc.text(recLines, 18, y + 12);
        y += 28;
      });
    }

    // Save document
    doc.save(`portscanit_report_${selectedScan.target.replace(/\./g, '_')}.pdf`);
  };

  const handleEmailReport = async () => {
    if (!selectedScan || !email.trim()) return;
    setEmailing(true);
    setEmailStatus('idle');
    setEmailMessage('');

    const scanRecord = scansHistory.find(s => s.scan.id === selectedScan.id);

    try {
      const res = await fetch('/api/reports/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: email.trim(),
          scanRecord
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEmailStatus('success');
        setEmailMessage(data.message || 'Report sent successfully!');
        setEmail('');
      } else {
        setEmailStatus('error');
        setEmailMessage(data.error || 'Failed to email report.');
      }
    } catch (e: any) {
      setEmailStatus('error');
      setEmailMessage(e.message || 'Network error occurred while emailing.');
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div className="flex-1 p-8 space-y-8 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight font-mono">COMPLIANCE REPORTS</h2>
          <p className="text-slate-400 text-sm mt-0.5">Generate, customize, and export executive PDF reports or raw CSV audit logs.</p>
        </div>
      </div>

      {scansHistory.length === 0 ? (
        <div className="glass-panel p-12 rounded-xl text-center space-y-4 max-w-lg mx-auto">
          <FileDown className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-300">No Reports Available</h3>
          <p className="text-slate-500 text-sm">Scan records must exist in memory before reports can be configured.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Selector & Export Panel */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-xl space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 font-mono">SELECT COMPLETED AUDIT</label>
              <select
                value={selectedScanId}
                onChange={(e) => setSelectedScanId(e.target.value)}
                className="w-full bg-[#080c14] border border-[#1e293b] focus:border-[#06b6d4] rounded-lg px-4 py-3 text-slate-300 font-mono text-sm outline-none transition-all"
              >
                {scans.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.target} - {new Date(s.start_time).toLocaleDateString()} ({s.risk_level})
                  </option>
                ))}
              </select>
            </div>

            {selectedScan && (
              <div className="bg-[#080c14] border border-[#1e293b]/60 rounded-lg p-5 space-y-4">
                <div className="flex items-center gap-3 border-b border-[#1e293b]/40 pb-3">
                  <Info className="w-4 h-4 text-[#06b6d4]" />
                  <h4 className="font-bold text-slate-300 text-sm font-mono uppercase">Document Scope Summary</h4>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <span className="text-slate-500">TARGET ENDPOINT</span>
                    <span className="text-slate-300 font-semibold block">{selectedScan.target}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500">SEVERITY RATING</span>
                    <span className="text-slate-300 font-semibold block">{selectedScan.risk_level} ({selectedScan.risk_score}/100)</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500">AUDITED RANGE</span>
                    <span className="text-slate-300 font-semibold block">Ports {selectedScan.start_port} - {selectedScan.end_port}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-500">DISCOVERED PORTS</span>
                    <span className="text-slate-300 font-semibold block">{selectedScan.open_ports} Open / {selectedScan.ports_scanned} Checked</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#1e293b]/60">
              <button
                onClick={handleExportPDF}
                disabled={!selectedScan}
                className="flex items-center justify-center gap-2.5 px-5 py-3 bg-[#06b6d4] hover:bg-[#06b6d4]/90 disabled:bg-slate-800 disabled:text-slate-600 text-[#080c14] rounded-lg font-bold text-sm font-mono tracking-wider transition-all cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                DOWNLOAD PDF REPORT
              </button>

              <button
                onClick={handleExportCSV}
                disabled={!selectedScan}
                className="flex items-center justify-center gap-2.5 px-5 py-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-600 text-slate-200 border border-slate-700 hover:border-[#06b6d4]/30 rounded-lg font-bold text-sm font-mono tracking-wider transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                DOWNLOAD CSV LOG
              </button>
            </div>

            {/* Email dispatch section */}
            <div className="pt-6 border-t border-[#1e293b]/60 space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#06b6d4]" />
                <h4 className="font-bold text-slate-300 text-xs font-mono uppercase">DISPATCH REPORT TO EMAIL</h4>
              </div>

              <div className="flex gap-3">
                <input
                  type="email"
                  placeholder="recipient@gmail.com"
                  value={email}
                  disabled={emailing || !selectedScan}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-[#080c14] border border-[#1e293b] focus:border-[#06b6d4] rounded-lg px-4 py-2.5 text-slate-300 font-mono text-sm outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={handleEmailReport}
                  disabled={emailing || !email.trim() || !selectedScan}
                  className="px-5 py-2.5 bg-[#06b6d4] hover:bg-[#06b6d4]/90 disabled:bg-slate-800 disabled:text-slate-600 text-[#080c14] rounded-lg font-bold text-xs font-mono tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {emailing ? 'SENDING...' : 'SEND EMAIL'}
                </button>
              </div>

              {emailStatus !== 'idle' && (
                <div className={`p-3 rounded-lg text-xs font-mono ${
                  emailStatus === 'success' 
                    ? 'bg-emerald-500/5 border border-emerald-500/20 text-emerald-400' 
                    : 'bg-red-500/5 border border-red-500/20 text-red-400'
                }`}>
                  {emailMessage}
                </div>
              )}
            </div>
          </div>

          {/* Exporter Checklists */}
          <div className="glass-panel p-6 rounded-xl flex flex-col justify-between">
            <div className="space-y-6">
              <h4 className="font-bold text-slate-300 border-b border-[#1e293b] pb-4 font-mono">REPORT INDEX DETAILS</h4>
              <ul className="space-y-3.5 text-xs text-slate-400 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  PortScanIT Title Banner & Timestamp
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Executive Audit Parameter Metrics
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Overall Severity Score & Rating
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Detailed Findings Grid (Port/Service/Banner)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Technical Explanations per open port
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Security Mitigation Strategies
                </li>
              </ul>
            </div>

            <div className="border-t border-[#1e293b] pt-6 mt-6 flex gap-2">
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
                These generated documents conform to basic cybersecurity auditing schemas suitable for presentation to compliance committees.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
