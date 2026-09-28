import { jsPDF } from "jspdf";

export function generateInvoicePdf(payload: {
  schoolName?: string;
  logoUrl?: string;
  student: { id: string; name: string; className: string };
  feeBreakdown: { label: string; amount: number }[];
  transactionId: string;
  paymentDate: string;
  transactionAmount?: number;
  paymentOption?: string;
}) {
  const doc = new jsPDF();

  // Define colors matching the image
  const headerColor: [number, number, number] = [0, 71, 171]; // Dark blue header
  const accentColor: [number, number, number] = [243, 156, 18]; // Orange accent
  const textColor: [number, number, number] = [0, 0, 0]; // Black text
  const grayColor: [number, number, number] = [128, 128, 128]; // Gray text

  // Header background - exact blue from image
  doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
  doc.rect(0, 0, 210, 100, 'F');

  // Try to load and add Core5 logo - centered at top
  try {
    const logoPath = '/core5-logo-new.png';
    doc.addImage(logoPath, "PNG", 75, 10, 60, 40);
  } catch (e) {
    console.log('Core5 logo image not available');
  }

  // Address in header - below logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("9th floor, A Wing, KAILASH BUSINESS PARK", 105, 70, { align: "center" });
  doc.text("901/902, Park Site Rd, Vikhroli (W), Mumbai, Maharashtra 400079", 105, 76, { align: "center" });
  doc.text("Phone: +91 9876543210 | Email: accounts@core5academy.edu", 105, 82, { align: "center" });

  // Invoice title and number below header
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 105, 105, { align: "center" });

  // Invoice number and date
  doc.setFontSize(11);
  doc.text(`#${payload.transactionId.slice(-8)}`, 105, 112, { align: "center" });

  // Reset text color for content
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);

  // Bill To section - left side
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO:", 15, 130);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(payload.student.name, 15, 140);
  doc.text(`${payload.student.className}`, 15, 147);
  doc.text(`ID: ${payload.student.id}`, 15, 154);

  // Invoice Details - right side
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE DETAILS:", 120, 130);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${payload.paymentDate}`, 120, 140);
  doc.text(`Invoice #: INV-${payload.transactionId.slice(-8)}`, 120, 147);
  doc.text(`Due Date: ${payload.paymentDate}`, 120, 154);

  // Horizontal line
  doc.setDrawColor(textColor[0], textColor[1], textColor[2]);
  doc.setLineWidth(1);
  doc.line(15, 165, 195, 165);

  // Table headers
  doc.setFillColor(240, 240, 240);
  doc.rect(15, 170, 180, 10, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("ITEM", 20, 177);
  doc.text("DESCRIPTION", 60, 177);
  doc.text("QTY", 130, 177);
  doc.text("PRICE", 150, 177);
  doc.text("TOTAL", 175, 177);

  // Table rows
  let y = 185;
  const transactionAmount = payload.transactionAmount || 0;
  
  // Add fee items as line items
  payload.feeBreakdown.forEach((f, index) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${index + 1}`, 20, y);
    doc.text(f.label, 60, y);
    doc.text("1", 135, y);
    doc.text(`Rs ${f.amount.toLocaleString('en-IN')}`, 150, y, { align: "right" });
    doc.text(`Rs ${f.amount.toLocaleString('en-IN')}`, 175, y, { align: "right" });
    y += 10;
  });

  // Add payment as last line item if it's different from total
  const totalFeeAmount = payload.feeBreakdown.reduce((sum, f) => sum + f.amount, 0);
  if (transactionAmount !== totalFeeAmount) {
    doc.text(`${payload.feeBreakdown.length + 1}`, 20, y);
    doc.text(`${payload.paymentOption || 'Partial'} Payment`, 60, y);
    doc.text("1", 135, y);
    doc.text(`Rs ${transactionAmount.toLocaleString('en-IN')}`, 150, y, { align: "right" });
    doc.text(`Rs ${transactionAmount.toLocaleString('en-IN')}`, 175, y, { align: "right" });
    y += 10;
  }

  // Horizontal line before total
  doc.line(15, y + 5, 195, y + 5);

  // Total section
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(130, y + 10, 65, 10, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", 135, y + 17);
  doc.text(`Rs ${transactionAmount.toLocaleString('en-IN')}`, 175, y + 17, { align: "right" });

  // Reset text color
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);

  // Payment status
  y += 30;
  doc.setFont("helvetica", "bold");
  doc.text("Payment Status:", 15, y);
  
  doc.setFont("helvetica", "normal");
  doc.text("PAID", 85, y);

  // Payment method
  doc.setFont("helvetica", "bold");
  doc.text("Payment Method:", 15, y + 10);
  
  doc.setFont("helvetica", "normal");
  doc.text(payload.paymentOption || "Full Payment", 85, y + 10);

  // Notes section
  y += 30;
  doc.setFont("helvetica", "bold");
  doc.text("Notes:", 15, y);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const notes = `Payment received for ${payload.paymentOption || 'full'} fee payment. Thank you for your prompt payment.`;
  const splitNotes = doc.splitTextToSize(notes, 170);
  doc.text(splitNotes, 15, y + 7);

  // Footer section
  y += 30;
  doc.setFont("helvetica", "bold");
  doc.text("Terms & Conditions:", 15, y);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
  const terms = [
    "1. Payment is due within 30 days of invoice date.",
    "2. Late payments are subject to a 5% monthly fee.",
    "3. Please include invoice number with payment.",
    "4. Thank you for your business!"
  ];
  
  terms.forEach((term, index) => {
    doc.text(term, 15, y + 7 + (index * 5));
  });

  // Thank you note at bottom
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Thank you for your business!", 105, 280, { align: "center" });

  return doc;
}
