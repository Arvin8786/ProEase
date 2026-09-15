import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  PurchaseRequest, 
  PurchaseOrder, 
  GoodsReceipt, 
  GoodsIssuance 
} from '../types';

export interface CompanyHeaderConfig {
  companyName: string;
  subTitle: string;
  registrationNumber: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

export const DEFAULT_COMPANY_HEADER: CompanyHeaderConfig = {
  companyName: 'PROEASE ENTERPRISE ERP CORP.',
  subTitle: 'Supply Chain, Logistics & Warehouse Operations',
  registrationNumber: 'REG-2024-889104-X',
  taxId: 'TAX-US-992014881',
  address: 'Level 24, Enterprise Tower, 742 Evergreen Terrace, Tech District',
  phone: '+1 (800) 555-EASE / +1 (800) 555-3273',
  email: 'procurement@proease-erp.internal',
  website: 'https://proease-erp.internal'
};

/**
 * Capture an on-screen DOM element and generate a high-resolution PDF
 */
export async function exportElementToPdf(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found for PDF export`);
  }

  const canvas = await html2canvas(element, {
    scale: 2, // High resolution retina rendering
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(filename);
}

// -------------------------------------------------------------
// Vector jsPDF Direct Generator for Crystal Sharp Documents
// -------------------------------------------------------------

function drawHeader(doc: jsPDF, title: string, docNumber: string, status: string, config = DEFAULT_COMPANY_HEADER) {
  // Top brand accent line
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 8, 'F');
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 8, 210, 2, 'F');

  // Company Logo / Emblem box
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(15, 16, 18, 18, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ERP', 24, 27, { align: 'center' });

  // Company Name and Details
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(config.companyName, 38, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(config.subTitle, 38, 27);
  doc.text(`${config.address} | Tel: ${config.phone}`, 38, 31);
  doc.text(`Tax ID: ${config.taxId} | Reg: ${config.registrationNumber} | Web: ${config.website}`, 38, 35);

  // Document Title Pill on right side
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(140, 16, 55, 22, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(140, 16, 55, 22, 2, 2, 'S');

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), 167.5, 23, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(16, 185, 129);
  doc.text(docNumber, 167.5, 29, { align: 'center' });

  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`STATUS: ${status.toUpperCase()}`, 167.5, 34, { align: 'center' });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, 42, 195, 42);
}

function drawSignatures(
  doc: jsPDF, 
  yPos: number, 
  preparedBy: string, 
  authorizedBy: string, 
  dateStr: string
) {
  // Authorization Signatures Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('OFFICIAL VERIFICATION & AUTHORIZATION', 15, yPos);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, yPos + 2, 195, yPos + 2);

  const boxY = yPos + 6;
  const boxWidth = 56;
  const boxHeight = 28;

  // Box 1: Prepared By
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, boxY, boxWidth, boxHeight, 1, 1, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, boxY, boxWidth, boxHeight, 1, 1, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('PREPARED BY', 18, boxY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(preparedBy || 'System Generated', 18, boxY + 12);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Date: ${dateStr}`, 18, boxY + 18);
  doc.setDrawColor(203, 213, 225);
  doc.line(18, boxY + 24, 18 + boxWidth - 6, boxY + 24);

  // Box 2: Quality / Stores Control
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(77, boxY, boxWidth, boxHeight, 1, 1, 'F');
  doc.roundedRect(77, boxY, boxWidth, boxHeight, 1, 1, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('VERIFIED & AUDITED', 80, boxY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Internal Audit / Warehouse Lead', 80, boxY + 12);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Compliance Confirmed', 80, boxY + 18);
  doc.line(80, boxY + 24, 80 + boxWidth - 6, boxY + 24);

  // Box 3: Authorized Approver
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(139, boxY, boxWidth, boxHeight, 1, 1, 'F');
  doc.roundedRect(139, boxY, boxWidth, boxHeight, 1, 1, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text('AUTHORIZED SIGNATORY', 142, boxY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(authorizedBy || 'Authorized Manager', 142, boxY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Digitally Signed & Certified', 142, boxY + 18);
  doc.line(142, boxY + 24, 142 + boxWidth - 6, boxY + 24);

  // Footer note
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('This is an official system document generated by ProEaseERP. Verify integrity via ERP Ledger Hash.', 105, 287, { align: 'center' });
}

// -------------------------------------------------------------
// 1. Generate Purchase Request PDF
// -------------------------------------------------------------
export function generatePurchaseRequestPdf(pr: PurchaseRequest): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const docNumber = pr.prNumber || `PR-${pr.id.slice(0, 8).toUpperCase()}`;
  drawHeader(doc, 'Purchase Requisition', docNumber, pr.status);

  // Meta Information Grid
  let y = 48;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, y, 180, 22, 1, 1, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, 180, 22, 1, 1, 'S');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('REQUESTER:', 20, y + 6);
  doc.text('DEPARTMENT:', 20, y + 12);
  doc.text('DELIVERY TARGET:', 20, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(pr.requesterName || 'Employee', 52, y + 6);
  doc.text(`${pr.departmentCode || 'DEPT-GEN'} ${pr.departmentName ? `(${pr.departmentName})` : ''}`, 52, y + 12);
  doc.text(pr.deliveryDate || 'Not specified', 52, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('PO NUMBER:', 115, y + 6);
  doc.text('DATE CREATED:', 115, y + 12);
  doc.text('APPROVED BY:', 115, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(pr.poNumber ? pr.poNumber : '(Pending Approval - Unassigned)', 142, y + 6);
  const createdDate = pr.createdAt?.toDate ? pr.createdAt.toDate().toLocaleDateString() : new Date().toLocaleDateString();
  doc.text(createdDate, 142, y + 12);
  doc.text(pr.approvedBy || '(Awaiting Approval)', 142, y + 18);

  // Table Header
  y = 78;
  doc.setFillColor(30, 41, 59);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('#', 18, y + 5.5);
  doc.text('PRODUCT / MATERIAL', 26, y + 5.5);
  doc.text('VENDOR CODE & NAME', 85, y + 5.5);
  doc.text('QTY', 135, y + 5.5, { align: 'right' });
  doc.text('UNIT', 145, y + 5.5);
  doc.text('QUOTED PRICE', 168, y + 5.5, { align: 'right' });
  doc.text('TOTAL', 190, y + 5.5, { align: 'right' });

  // Table Rows
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  let totalCost = 0;
  pr.items.forEach((item, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(15, y, 180, 8, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y + 8, 195, y + 8);

    doc.setTextColor(100, 116, 139);
    doc.text(String(idx + 1), 18, y + 5.5);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.materialName || 'Material'} (${item.productCode || 'ITEM'})`, 26, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const vendorLabel = `${item.vendorCode || 'VEND'} - ${item.vendorName || 'Preferred Vendor'}`;
    doc.text(vendorLabel.length > 28 ? vendorLabel.slice(0, 26) + '...' : vendorLabel, 85, y + 5.5);

    doc.setTextColor(15, 23, 42);
    doc.text(String(item.quantity || 1), 135, y + 5.5, { align: 'right' });
    doc.text(item.unit || 'PCS', 145, y + 5.5);

    const price = Number(item.materialQuotedPrice) || 0;
    const rowTotal = item.totalQuotedPrice || (price * (item.quantity || 1));
    totalCost += rowTotal;

    doc.text(`$${price.toFixed(2)}`, 168, y + 5.5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`$${rowTotal.toFixed(2)}`, 190, y + 5.5, { align: 'right' });

    y += 8;
  });

  // Summary Totals
  y += 4;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(120, y, 75, 16, 1, 1, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(120, y, 75, 16, 1, 1, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL ESTIMATED COST:', 125, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129);
  doc.text(`$${(pr.totalEstimatedCost || totalCost).toFixed(2)}`, 190, y + 11, { align: 'right' });

  // Signatures
  drawSignatures(doc, y + 26, pr.requesterName, pr.approvedBy || '', pr.deliveryDate || createdDate);

  doc.save(`${docNumber}.pdf`);
}

// -------------------------------------------------------------
// 2. Generate Purchase Order PDF
// -------------------------------------------------------------
export function generatePurchaseOrderPdf(po: PurchaseOrder): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  drawHeader(doc, 'Official Purchase Order', po.poNumber, po.status);

  let y = 48;
  // Two column header: Left (Vendor), Right (PO Specs)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, y, 88, 26, 1, 1, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, 88, 26, 1, 1, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text('VENDOR / SUPPLIER DETAILS', 20, y + 6);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.text(po.vendorName || 'Supplier', 20, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Vendor Code: ${po.vendorCode || 'VEND-EXT'}`, 20, y + 17);
  doc.text(`Ecosystem Status: ${po.isEcosystemVendor ? 'Verified Digital Portal' : 'External Dispatch'}`, 20, y + 22);

  // Right column: PO details
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(107, y, 88, 26, 1, 1, 'F');
  doc.roundedRect(107, y, 88, 26, 1, 1, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('ORDER SPECIFICATIONS', 112, y + 6);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('REQUISITION REF:', 112, y + 12);
  doc.text('DEPARTMENT:', 112, y + 17);
  doc.text('DELIVERY DATE:', 112, y + 22);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(po.prNumber || 'N/A', 148, y + 12);
  doc.text(po.departmentCode || 'DEPT-WH', 148, y + 17);
  doc.text(po.deliveryDate || 'Immediate', 148, y + 22);

  // Items table
  y = 82;
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('#', 18, y + 5.5);
  doc.text('ITEM CODE', 26, y + 5.5);
  doc.text('DESCRIPTION / MATERIAL', 52, y + 5.5);
  doc.text('ORDER QTY', 125, y + 5.5, { align: 'right' });
  doc.text('UNIT', 135, y + 5.5);
  doc.text('UNIT PRICE', 165, y + 5.5, { align: 'right' });
  doc.text('LINE TOTAL', 190, y + 5.5, { align: 'right' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  let grandTotal = 0;
  po.items.forEach((item, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(15, y, 180, 8, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y + 8, 195, y + 8);

    doc.setTextColor(100, 116, 139);
    doc.text(String(idx + 1), 18, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(item.productCode || 'SKU', 26, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.text(item.materialName || 'Item description', 52, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.text(String(item.quantity), 125, y + 5.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(item.unit || 'PCS', 135, y + 5.5);

    const price = Number(item.unitPrice) || 0;
    const total = item.totalPrice || (price * item.quantity);
    grandTotal += total;

    doc.text(`$${price.toFixed(2)}`, 165, y + 5.5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`$${total.toFixed(2)}`, 190, y + 5.5, { align: 'right' });

    y += 8;
  });

  // Totals Box
  y += 6;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(120, y, 75, 22, 1, 1, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(120, y, 75, 22, 1, 1, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('SUBTOTAL:', 125, y + 6);
  doc.text(`$${grandTotal.toFixed(2)}`, 190, y + 6, { align: 'right' });

  doc.text('SALES TAX (0% EXEMPT):', 125, y + 11);
  doc.text('$0.00', 190, y + 11, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('PO TOTAL:', 125, y + 18);
  doc.setTextColor(16, 185, 129);
  doc.text(`$${(po.totalAmount || grandTotal).toFixed(2)}`, 190, y + 18, { align: 'right' });

  // Routing info note
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.text('VENDOR ROUTING NOTICE:', 15, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const routingMsg = po.isEcosystemVendor 
    ? 'This PO has been transmitted electronically to the supplier portal inbox.'
    : 'External Supplier: Please print/email this formal PO copy with purchase authorization.';
  doc.text(routingMsg, 15, y + 12);

  // Signatures
  drawSignatures(doc, y + 30, 'Procurement Officer', po.approvedBy || 'Operations Lead', po.approvedAt ? new Date(po.approvedAt).toLocaleDateString() : new Date().toLocaleDateString());

  doc.save(`${po.poNumber}.pdf`);
}

// -------------------------------------------------------------
// 3. Generate Goods Receipt Note (GRN) PDF
// -------------------------------------------------------------
export function generateGoodsReceiptPdf(gr: GoodsReceipt): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  drawHeader(doc, 'Goods Receipt Note (GRN)', gr.grNumber, gr.isPosted ? 'POSTED & INVENTORIED' : 'DRAFT RECEIPT');

  let y = 48;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, y, 180, 24, 1, 1, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, 180, 24, 1, 1, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('PO NUMBER:', 20, y + 6);
  doc.text('PHYSICAL INVOICE #:', 20, y + 12);
  doc.text('SUPPLIER:', 20, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(gr.poNumber || 'N/A', 56, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // highlight invoice
  doc.text(gr.invoiceNumber || 'INV-NOT-RECORDED', 56, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(gr.vendorName || 'Supplier', 56, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('RECEIVED BY:', 115, y + 6);
  doc.text('RECEIPT DATE:', 115, y + 12);
  doc.text('LEDGER POSTING:', 115, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(gr.receivedBy || 'Storekeeper', 148, y + 6);
  const recDate = gr.receivedAt?.toDate ? gr.receivedAt.toDate().toLocaleDateString() : new Date().toLocaleDateString();
  doc.text(recDate, 148, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(gr.isPosted ? 16 : 239, gr.isPosted ? 185 : 68, gr.isPosted ? 129 : 68);
  doc.text(gr.isPosted ? 'ACID Locked & Stock Added' : 'Pending Posting', 148, y + 18);

  // Table
  y = 80;
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('#', 18, y + 5.5);
  doc.text('ITEM CODE', 26, y + 5.5);
  doc.text('DESCRIPTION', 55, y + 5.5);
  doc.text('ORDERED QTY', 125, y + 5.5, { align: 'right' });
  doc.text('RECEIVED QTY', 158, y + 5.5, { align: 'right' });
  doc.text('UNIT', 170, y + 5.5);
  doc.text('STATUS', 190, y + 5.5, { align: 'right' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  gr.items.forEach((item, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(15, y, 180, 8, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y + 8, 195, y + 8);

    doc.setTextColor(100, 116, 139);
    doc.text(String(idx + 1), 18, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(item.productCode || 'SKU', 26, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.text(item.itemName || 'Material', 55, y + 5.5);

    doc.text(String(item.orderedQty || 0), 125, y + 5.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(String(item.receivedQty || 0), 158, y + 5.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(item.unit || 'PCS', 170, y + 5.5);

    const variance = (item.receivedQty || 0) - (item.orderedQty || 0);
    const varianceLabel = variance === 0 ? 'Match' : variance > 0 ? `+${variance}` : `${variance}`;
    doc.setFont('helvetica', 'bold');
    doc.text(varianceLabel, 190, y + 5.5, { align: 'right' });

    y += 8;
  });

  // Notes
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('INSPECTION & RECEIVING PROTOCOL:', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('All materials have been physically unboxed, inspected against physical packaging slips, and entered into bin storage.', 15, y + 5);

  drawSignatures(doc, y + 20, gr.receivedBy, 'Warehouse Supervisor', recDate);

  doc.save(`${gr.grNumber}.pdf`);
}

// -------------------------------------------------------------
// 4. Generate Goods Issuance Note (GIN) PDF
// -------------------------------------------------------------
export function generateGoodsIssuancePdf(gi: GoodsIssuance): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const title = gi.type === 'internal' ? 'Internal Goods Issuance (GIN)' : 'External Goods Dispatch (GIN)';
  drawHeader(doc, title, gi.ginNumber, gi.status);

  let y = 48;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, y, 180, 26, 1, 1, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, y, 180, 26, 1, 1, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ISSUANCE TYPE:', 20, y + 6);
  doc.text(gi.type === 'internal' ? 'RECEIVING DEPT:' : 'EXTERNAL RECIPIENT:', 20, y + 12);
  doc.text(gi.type === 'internal' ? 'ISSUED TO:' : 'BUSINESS REASONING:', 20, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(gi.type === 'internal' ? 30 : 225, gi.type === 'internal' ? 41 : 29, gi.type === 'internal' ? 59 : 72);
  doc.text(gi.type === 'internal' ? 'INTERNAL DEPARTMENT DISPATCH' : 'EXTERNAL SPECIAL DISPATCH (APPROVAL REQ)', 58, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(gi.type === 'internal' ? (gi.departmentCode || 'DEPT') : (gi.externalRecipient || 'External Client/Vendor'), 58, y + 12);

  const detailText = gi.type === 'internal' ? (gi.issuedTo || 'Staff Member') : (gi.reasoning || 'Authorized business reasoning');
  doc.text(detailText.length > 35 ? detailText.slice(0, 33) + '...' : detailText, 58, y + 18);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ISSUED BY:', 125, y + 6);
  doc.text('DATE ISSUED:', 125, y + 12);
  doc.text('APPROVAL STATUS:', 125, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(gi.issuedBy || 'Storekeeper', 156, y + 6);
  const issDate = gi.issuedAt?.toDate ? gi.issuedAt.toDate().toLocaleDateString() : new Date().toLocaleDateString();
  doc.text(issDate, 156, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(gi.status === 'approved' || gi.status === 'completed' ? 16 : 245, gi.status === 'approved' || gi.status === 'completed' ? 185 : 158, gi.status === 'approved' || gi.status === 'completed' ? 129 : 11);
  doc.text(gi.status.toUpperCase(), 156, y + 18);

  // Table
  y = 82;
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('#', 18, y + 5.5);
  doc.text('PRODUCT CODE', 26, y + 5.5);
  doc.text('MATERIAL / ITEM DESCRIPTION', 60, y + 5.5);
  doc.text('DISPATCHED QTY', 155, y + 5.5, { align: 'right' });
  doc.text('UNIT', 170, y + 5.5);

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  gi.items.forEach((item, idx) => {
    const isEven = idx % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(15, y, 180, 8, 'F');
    doc.setDrawColor(241, 245, 249);
    doc.line(15, y + 8, 195, y + 8);

    doc.setTextColor(100, 116, 139);
    doc.text(String(idx + 1), 18, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(item.productCode || 'ITEM', 26, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.text(item.itemName || 'Inventory item', 60, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(item.quantity || 1), 155, y + 5.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(item.unit || 'PCS', 170, y + 5.5);

    y += 8;
  });

  // Reasoning if external
  if (gi.type === 'external' && gi.reasoning) {
    y += 6;
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(15, y, 180, 16, 1, 1, 'F');
    doc.setDrawColor(254, 202, 202);
    doc.roundedRect(15, y, 180, 16, 1, 1, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(185, 28, 28);
    doc.text('JUSTIFICATION & MANAGEMENT CLEARANCE NOTE:', 20, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(127, 29, 29);
    doc.text(gi.reasoning, 20, y + 11);
    y += 18;
  } else {
    y += 6;
  }

  drawSignatures(doc, y + 10, gi.issuedBy, gi.approvedBy || (gi.type === 'internal' ? 'Dept Head' : 'Operations Manager'), issDate);

  doc.save(`${gi.ginNumber}.pdf`);
}

/**
 * Generate High-Resolution Employee Payslip PDF
 */
export function generatePayslipPdf(payroll: any, config = DEFAULT_COMPANY_HEADER): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  drawHeader(doc, 'CONFIDENTIAL PAYSLIP', `PAY-${payroll.id?.slice(0, 6) || 'SLIP'}`, payroll.status || 'PAID', config);

  // Employee Meta Grid
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, 52, 180, 28, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(15, 52, 180, 28, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('EMPLOYEE NAME:', 20, 60);
  doc.text('PAYROLL PERIOD:', 110, 60);
  doc.text('EMPLOYEE ID:', 20, 67);
  doc.text('DESIGNATION / DEPT:', 110, 67);
  doc.text('PAYMENT DATE:', 20, 74);
  doc.text('STATUS:', 110, 74);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(payroll.employeeName || 'Staff Member', 55, 60);
  doc.text(payroll.month || new Date().toISOString().slice(0, 7), 150, 60);
  doc.text(payroll.employeeCode || payroll.employeeId?.slice(0, 8) || 'EMP-1001', 55, 67);
  doc.text(payroll.department || 'Operations', 150, 67);
  doc.text(payroll.paymentDate || new Date().toISOString().split('T')[0], 55, 74);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text((payroll.status || 'APPROVED').toUpperCase(), 150, 74);

  let y = 88;

  // Breakdown Columns
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 180, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('EARNINGS & ALLOWANCES', 20, y + 4.8);
  doc.text('AMOUNT ($)', 95, y + 4.8, { align: 'right' });
  doc.text('DEDUCTIONS & STATUTORY', 110, y + 4.8);
  doc.text('AMOUNT ($)', 185, y + 4.8, { align: 'right' });

  y += 12;

  const basicSalary = Number(payroll.basicSalary || payroll.grossSalary || 0);
  const allowances = Number(payroll.allowances || 0);
  const overtime = Number(payroll.overtimePay || 0);
  const grossPay = basicSalary + allowances + overtime;

  const employeeCpfEpf = Number(payroll.employeeDeduction || (basicSalary * 0.2) || 0);
  const employerCpfEpf = Number(payroll.employerContribution || (basicSalary * 0.17) || 0);
  const otherDeductions = Number(payroll.otherDeductions || 0);
  const totalDeductions = employeeCpfEpf + otherDeductions;
  const netPay = grossPay - totalDeductions;

  // Rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);

  doc.text('Base Salary', 20, y);
  doc.text(basicSalary.toFixed(2), 95, y, { align: 'right' });
  doc.text('Employee CPF / EPF', 110, y);
  doc.text(employeeCpfEpf.toFixed(2), 185, y, { align: 'right' });

  y += 7;
  doc.text('Allowances', 20, y);
  doc.text(allowances.toFixed(2), 95, y, { align: 'right' });
  doc.text('Other Deductions', 110, y);
  doc.text(otherDeductions.toFixed(2), 185, y, { align: 'right' });

  y += 7;
  doc.text('Overtime Pay', 20, y);
  doc.text(overtime.toFixed(2), 95, y, { align: 'right' });
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text('Employer CPF/EPF (Company Paid)', 110, y);
  doc.text(employerCpfEpf.toFixed(2), 185, y, { align: 'right' });

  y += 14;

  // Total Summary Blocks
  doc.setFillColor(241, 245, 249);
  doc.rect(15, y, 85, 10, 'F');
  doc.rect(110, y, 85, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL GROSS PAY:', 20, y + 6.5);
  doc.text(`$${grossPay.toFixed(2)}`, 95, y + 6.5, { align: 'right' });

  doc.setTextColor(225, 29, 72);
  doc.text('TOTAL DEDUCTIONS:', 115, y + 6.5);
  doc.text(`-$${totalDeductions.toFixed(2)}`, 185, y + 6.5, { align: 'right' });

  y += 16;

  // Net Pay Box
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(15, y, 180, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('NET TAKE-HOME PAYABLE:', 20, y + 9);
  doc.setFontSize(14);
  doc.text(`$${netPay.toFixed(2)}`, 185, y + 9.5, { align: 'right' });

  y += 24;

  // Signatures / Disclaimers
  drawSignatures(doc, y, 'Payroll Specialist', 'Managing Director', payroll.paymentDate || new Date().toISOString().split('T')[0]);

  doc.save(`Payslip_${payroll.employeeName?.replace(/\s+/g, '_') || 'Employee'}_${payroll.month || 'Month'}.pdf`);
}

