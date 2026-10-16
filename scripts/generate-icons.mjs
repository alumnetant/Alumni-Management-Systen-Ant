import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const seal = 'public/assets/cecilians-seal.jpg';

const densities = [
  { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
  { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
  { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
  { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
  { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
];

for (const d of densities) {
  const p = path.join('android/app/src/main/res', d.dir);
  if (fs.existsSync(p)) {
    // Standard icon
    execFileSync('convert', [seal, '-resize', `${d.size}x${d.size}`, path.join(p, 'ic_launcher.png')]);
    // Round icon
    execFileSync('convert', [seal, '-resize', `${d.size}x${d.size}`, path.join(p, 'ic_launcher_round.png')]);
    // Foreground icon: centered seal on transparent background
    const inner = Math.round(d.fgSize * 0.72);
    execFileSync('convert', [
      seal,
      '-resize',
      `${inner}x${inner}`,
      '-background',
      'transparent',
      '-gravity',
      'center',
      '-extent',
      `${d.fgSize}x${d.fgSize}`,
      path.join(p, 'ic_launcher_foreground.png')
    ]);
  }
}

// Splash screens for Android
const splashes = [
  { file: 'android/app/src/main/res/drawable/splash.png', w: 480, h: 800, sealSize: 220 },
  { file: 'android/app/src/main/res/drawable-port-mdpi/splash.png', w: 320, h: 480, sealSize: 160 },
  { file: 'android/app/src/main/res/drawable-port-hdpi/splash.png', w: 480, h: 800, sealSize: 220 },
  { file: 'android/app/src/main/res/drawable-port-xhdpi/splash.png', w: 720, h: 1280, sealSize: 320 },
  { file: 'android/app/src/main/res/drawable-port-xxhdpi/splash.png', w: 960, h: 1600, sealSize: 420 },
  { file: 'android/app/src/main/res/drawable-port-xxxhdpi/splash.png', w: 1280, h: 1920, sealSize: 520 },
  { file: 'android/app/src/main/res/drawable-land-mdpi/splash.png', w: 480, h: 320, sealSize: 160 },
  { file: 'android/app/src/main/res/drawable-land-hdpi/splash.png', w: 800, h: 480, sealSize: 220 },
  { file: 'android/app/src/main/res/drawable-land-xhdpi/splash.png', w: 1280, h: 720, sealSize: 320 },
  { file: 'android/app/src/main/res/drawable-land-xxhdpi/splash.png', w: 1600, h: 960, sealSize: 420 },
  { file: 'android/app/src/main/res/drawable-land-xxxhdpi/splash.png', w: 1920, h: 1280, sealSize: 520 },
];

for (const s of splashes) {
  if (fs.existsSync(path.dirname(s.file))) {
    execFileSync('convert', [
      seal,
      '-resize',
      `${s.sealSize}x${s.sealSize}`,
      '-background',
      '#721316',
      '-gravity',
      'center',
      '-extent',
      `${s.w}x${s.h}`,
      s.file
    ]);
  }
}

// iOS Icons & Splash
if (fs.existsSync('ios/App/App/Assets.xcassets/AppIcon.appiconset')) {
  execFileSync('convert', [seal, '-resize', '1024x1024', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png']);
}
const iosSplashes = [
  'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png',
  'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png',
  'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png'
];
for (const is of iosSplashes) {
  if (fs.existsSync(path.dirname(is))) {
    execFileSync('convert', [
      seal,
      '-resize',
      '800x800',
      '-background',
      '#721316',
      '-gravity',
      'center',
      '-extent',
      '2732x2732',
      is
    ]);
  }
}

// Sync public directory into Android assets
if (fs.existsSync('android/app/src/main/assets/public')) {
  execFileSync('cp', ['-r', 'public/.', 'android/app/src/main/assets/public/']);
}

console.log('Successfully generated all Android APK, iOS, and PWA assets using official St. Cecilia logo.');
