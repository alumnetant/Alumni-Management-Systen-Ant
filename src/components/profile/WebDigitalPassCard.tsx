import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  QrCode,
  Download,
  ShieldCheck,
  CheckCircle2,
  Lock,
  WifiOff,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { UserProfile } from '../../types';

interface WebDigitalPassCardProps {
  user?: UserProfile | null;
}

export const WebDigitalPassCard: React.FC<WebDigitalPassCardProps> = ({ user }) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const apkDownloadUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/downloads/scc-alumni-app.apk`
    : 'https://stcecilia.edu.ph/alumni/mobile-app';

  useEffect(() => {
    QRCode.toDataURL(apkDownloadUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: '#1c1917',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then((url) => setQrCodeUrl(url))
      .catch((err) => console.error('Failed to generate pass download QR code', err));
  }, [apkDownloadUrl]);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-950 to-[#4a0b0d] p-6 sm:p-8 text-white border border-stone-800 shadow-2xl">
      {/* Decorative Background Glow */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-[#8B181B]/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
        
        {/* Left Information Column */}
        <div className="flex-1 space-y-4 max-w-xl text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-amber-300 border border-white/15 backdrop-blur-xs">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile-Exclusive Feature</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-tight">
            Access your scannable Digital Alumni Pass exclusively via the Alumni Mobile App
          </h3>

          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
            The interactive metallic ID wallet with dynamic NFC verification, offline turnstile QR codes, and hardware biometric encryption is optimized for the Android APK and native mobile devices.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-left">
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">Offline Gate Access</span>
                <span className="text-[11px] text-stone-400 leading-tight block mt-0.5">
                  Scan past campus turnstiles without requiring active mobile data.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 text-left">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block">Biometric Lock</span>
                <span className="text-[11px] text-stone-400 leading-tight block mt-0.5">
                  Secured with your phone's fingerprint and optical FaceID.
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <a
              href={apkDownloadUrl}
              download="scc-alumni-app.apk"
              className="px-5 py-2.5 bg-[#8B181B] hover:bg-[#a31c20] active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer border border-rose-500/30"
            >
              <Download className="w-4 h-4" />
              <span>Download Alumni Mobile APK</span>
            </a>

            {user?.studentId && (
              <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-[11px] font-mono text-stone-300">
                Member ID: <span className="font-bold text-amber-300">{user.studentId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right QR Code Column */}
        <div className="flex flex-col items-center bg-white p-5 rounded-2xl shadow-2xl border border-white/20 shrink-0">
          <div className="p-2 bg-stone-50 rounded-xl border border-stone-200">
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="Scan to download Alumni Mobile App"
                className="w-44 h-44 object-contain rounded-lg"
              />
            ) : (
              <div className="w-44 h-44 flex items-center justify-center bg-stone-100 rounded-lg text-xs text-stone-400">
                Loading QR Code...
              </div>
            )}
          </div>

          <div className="mt-3 text-center">
            <span className="text-xs font-bold text-stone-900 block flex items-center justify-center gap-1">
              <QrCode className="w-3.5 h-3.5 text-[#8B181B]" />
              Scan with Phone Camera
            </span>
            <span className="text-[10px] text-stone-500 block mt-0.5">
              Direct Android APK Installer & Pass Setup
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
