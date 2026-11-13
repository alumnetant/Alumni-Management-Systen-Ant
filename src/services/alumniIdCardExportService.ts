/**
 * St. Cecilia's College - Cebu, Inc.
 * Digital Alumni ID Card Export Engine
 * 
 * Supports:
 * - High-DPI Canvas Snapshot PNG Download & Native Mobile Sharing
 * - Official Credential PDF Generation using jsPDF
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { UserProfile } from '../types';
import { getAlumniVerificationUrl } from './alumniIdVerificationService';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

/**
 * Loads an image URL into an HTMLImageElement safely with CORS handling.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // If CORS or local image error, create a fallback or resolve
      reject(new Error(`Failed to load image: ${src}`));
    };
    img.src = src;
  });
}

/**
 * Generates an ultra-crisp 2X retina PNG of the St. Cecilia's College Black & Gold Alumni ID.
 */
export async function exportAlumniCardToPng(user: UserProfile, formattedId: string): Promise<void> {
  const width = 1050;
  const height = 660;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Background: Obsidian / Charcoal Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0f1013');
  bgGrad.addColorStop(0.5, '#17181c');
  bgGrad.addColorStop(1, '#090a0c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Ambient Gold Lighting
  const radialGold = ctx.createRadialGradient(width * 0.8, height * 0.2, 50, width * 0.8, height * 0.2, 450);
  radialGold.addColorStop(0, 'rgba(217, 119, 6, 0.18)');
  radialGold.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = radialGold;
  ctx.fillRect(0, 0, width, height);

  // 3. Guilloche Decorative Security Arcs
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.12)';
  ctx.lineWidth = 1.5;
  for (let r = 80; r <= 320; r += 35) {
    ctx.beginPath();
    ctx.arc(width - 40, height - 40, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 4. Gold Outer and Inner Borders
  const borderGrad = ctx.createLinearGradient(0, 0, width, height);
  borderGrad.addColorStop(0, '#F59E0B');
  borderGrad.addColorStop(0.3, '#D97706');
  borderGrad.addColorStop(0.7, '#FEF3C7');
  borderGrad.addColorStop(1, '#B45309');

  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, width - 36, height - 36);

  ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, 28, width - 56, height - 56);

  // 5. College Seal
  try {
    const seal = await loadImage('/assets/cecilians-seal.jpg').catch(() => loadImage('/assets/st-cecilias-college-seal.jpg'));
    ctx.save();
    ctx.beginPath();
    ctx.arc(80, 85, 42, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(seal, 38, 43, 84, 84);
    ctx.restore();

    // Gold ring around seal
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(80, 85, 43, 0, Math.PI * 2);
    ctx.stroke();
  } catch {
    // Monogram fallback if seal fails to load
    ctx.fillStyle = '#8B181B';
    ctx.beginPath();
    ctx.arc(80, 85, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 36px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCC', 80, 97);
  }

  // 6. Institutional Header Text
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FEF3C7';
  ctx.font = 'bold 32px Georgia, serif';
  ctx.fillText("ST. CECILIA'S COLLEGE", 140, 75);

  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('DIGITAL ALUMNI CREDENTIAL • CEBU, INC.', 142, 102);

  // 7. Verified Badge on Top Right
  ctx.fillStyle = '#064e3b';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  const badgeX = width - 240;
  const badgeY = 55;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, 190, 40, 20);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#a7f3d0';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✓ VERIFIED ALUMNUS', badgeX + 95, badgeY + 25);

  // 8. Metallic EMV Smart Chip
  ctx.fillStyle = '#d97706';
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(320, 155, 90, 65, 8);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(320, 182, 90, 10);

  // 9. Profile Photo Frame (Auto-retrieved from account)
  const photoX = 55;
  const photoY = 150;
  const photoW = 230;
  const photoH = 280;

  // Outer gold frame for photo
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 4;
  ctx.strokeRect(photoX - 4, photoY - 4, photoW + 8, photoH + 8);

  // Render Alumnus Photo
  const avatarUrl = user.avatar || user.profilePictureUrl || user.photoUrl;
  let photoDrawn = false;
  if (avatarUrl) {
    try {
      const avatarImg = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.rect(photoX, photoY, photoW, photoH);
      ctx.clip();
      ctx.drawImage(avatarImg, photoX, photoY, photoW, photoH);
      ctx.restore();
      photoDrawn = true;
    } catch {}
  }

  if (!photoDrawn) {
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 72px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(user.name.charAt(0).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2 + 24);
  }

  // 10. Alumnus Details (Right Side)
  ctx.textAlign = 'left';
  // Full Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText(user.name.toUpperCase(), 320, 260);

  // Degree / Program
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(user.course || user.department || 'B.S. Information Technology', 320, 298);

  // Graduation Cohort
  ctx.fillStyle = '#d1d5db';
  ctx.font = '18px sans-serif';
  ctx.fillText(`Class of ${user.batch || '2024'}`, 320, 332);

  // Membership Type
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(user.membershipType || 'Alumni Council Fellow', 320, 365);

  // Alumni ID Number Callout
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(320, 395, 380, 52, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('OFFICIAL ALUMNI ID NUMBER', 335, 415);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(formattedId, 335, 438);

  // 11. Verification QR Code
  const verifyUrl = getAlumniVerificationUrl(user);
  try {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 170,
      margin: 1,
      color: { dark: '#0a0a0c', light: '#ffffff' }
    });
    const qrImg = await loadImage(qrDataUrl);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(width - 245, 235, 185, 185);
    ctx.drawImage(qrImg, width - 240, 240, 175, 175);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SCAN TO VERIFY', width - 152, 436);
  } catch {}

  // 12. Bottom Banner & Official Latin Motto
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, height - 120);
  ctx.lineTo(width - 40, height - 120);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 18px Georgia, serif';
  ctx.fillText('VIRTUS  •  SCIENTIA  •  CHARITAS', width / 2, height - 80);

  ctx.fillStyle = '#9ca3af';
  ctx.font = '12px sans-serif';
  ctx.fillText('Property of St. Cecilia’s College - Cebu, Inc. Validated digital alumni pass.', width / 2, height - 55);

  // 13. Trigger Native Share or PNG File Download
  const dataUrl = canvas.toDataURL('image/png');

  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title: `St. Cecilia's College Digital Alumni ID - ${user.name}`,
        text: `Official Digital Alumni Credential for ${user.name} (${formattedId})`,
        url: dataUrl,
        dialogTitle: 'Save Digital Alumni ID'
      });
      return;
    } catch {}
  }

  // Web download
  const link = document.createElement('a');
  link.download = `SCC_Alumni_ID_${formattedId}.png`;
  link.href = dataUrl;
  link.click();
}

/**
 * Generates an official printable PDF credential pass.
 */
export async function exportAlumniCardToPdf(user: UserProfile, formattedId: string): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Background Institutional Watermark & Borders
  doc.setFillColor(15, 16, 20); // Dark Charcoal
  doc.rect(15, 15, 180, 267, 'F');

  // Gold Outer Border
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(1.2);
  doc.rect(20, 20, 170, 257);

  // College Header
  doc.setTextColor(254, 243, 199);
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.text("ST. CECILIA'S COLLEGE - CEBU, INC.", 105, 38, { align: 'center' });

  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('OFFICIAL DIGITAL ALUMNI CREDENTIAL', 105, 46, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(209, 213, 219);
  doc.text('Poblacion Ward II, Minglanilla, Cebu, Philippines', 105, 52, { align: 'center' });

  // Verified Status Banner
  doc.setFillColor(6, 78, 59);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.roundedRect(30, 60, 150, 12, 3, 3, 'FD');

  doc.setTextColor(167, 243, 208);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ACCREDITED & VERIFIED ALUMNI RECORD', 105, 67.5, { align: 'center' });

  // Alumnus Credentials Card Table
  doc.setFillColor(28, 25, 23);
  doc.roundedRect(30, 80, 150, 95, 4, 4, 'F');
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.6);
  doc.roundedRect(30, 80, 150, 95, 4, 4, 'D');

  // Alumnus Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(user.name.toUpperCase(), 105, 96, { align: 'center' });

  // Degree & Class
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(12);
  doc.text(user.course || 'B.S. Information Technology', 105, 105, { align: 'center' });

  doc.setTextColor(209, 213, 219);
  doc.setFontSize(11);
  doc.text(`Class of ${user.batch || '2024'}`, 105, 113, { align: 'center' });

  doc.setTextColor(253, 230, 138);
  doc.setFontSize(10);
  doc.text(user.membershipType || 'Alumni Council Fellow', 105, 121, { align: 'center' });

  // Official ID Number Box
  doc.setFillColor(10, 10, 12);
  doc.roundedRect(45, 130, 120, 16, 2, 2, 'F');
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.4);
  doc.roundedRect(45, 130, 120, 16, 2, 2, 'D');

  doc.setTextColor(245, 158, 11);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text('ALUMNI ID NUMBER', 105, 136, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.text(formattedId, 105, 143, { align: 'center' });

  // Verification QR Code
  try {
    const verifyUrl = getAlumniVerificationUrl(user);
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 200,
      margin: 1
    });
    doc.addImage(qrDataUrl, 'PNG', 80, 185, 50, 50);

    doc.setTextColor(245, 158, 11);
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.text('OFFICIAL VERIFICATION QR CODE', 105, 240, { align: 'center' });
    doc.setTextColor(156, 163, 175);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Scan using any mobile device camera to confirm credential validity', 105, 245, { align: 'center' });
  } catch {}

  // School Motto
  doc.setTextColor(245, 158, 11);
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('VIRTUS  •  SCIENTIA  •  CHARITAS', 105, 260, { align: 'center' });

  doc.save(`SCC_Alumni_Credential_${formattedId}.pdf`);
}
