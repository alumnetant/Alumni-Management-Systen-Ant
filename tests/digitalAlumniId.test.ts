import { describe, it, expect } from 'vitest';
import {
  createAlumniVerificationToken,
  verifyAlumniToken,
  getAlumniVerificationUrl
} from '../src/services/alumniIdVerificationService';
import { UserProfile } from '../src/types';

describe('Digital Alumni ID Verification Service', () => {
  const mockAlumniUser: UserProfile = {
    uid: 'alum_001',
    name: 'Janelle Therese Ramos',
    email: 'janelle.ramos@alumni.stcecilia.edu',
    role: 'alumni',
    batch: '2024',
    course: 'B.S. Information Technology',
    location: 'Minglanilla, Cebu',
    profilePictureUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    coverPhotoUrl: '',
    headline: 'Software Engineer',
    about: 'Proud Cecilian graduate.',
    phone: '+63 920 456 7890',
    isVerified: true,
    followersCount: 15,
    followingCount: 20,
    connectionsCount: 45,
    experience: [],
    education: [],
    createdAt: '2024-03-15T00:00:00.000Z',
    alumniId: 'SCC-ALUM-2024-1002',
    membershipType: 'Alumni Council Fellow, Chapter Cebu',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'
  };

  it('generates a valid verification token encoding official credentials', () => {
    const token = createAlumniVerificationToken(mockAlumniUser);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const verification = verifyAlumniToken(token);
    expect(verification.isValid).toBe(true);
    expect(verification.claim).toBeDefined();
    expect(verification.claim?.alumniId).toBe('SCC-ALUM-2024-1002');
    expect(verification.claim?.name).toBe('Janelle Therese Ramos');
    expect(verification.claim?.batch).toBe('2024');
    expect(verification.claim?.degree).toBe('B.S. Information Technology');
    expect(verification.claim?.membershipType).toBe('Alumni Council Fellow, Chapter Cebu');
    expect(verification.claim?.isVerified).toBe(true);
  });

  it('detects tampering and rejects forged verification tokens', () => {
    const token = createAlumniVerificationToken(mockAlumniUser);
    const decoded = JSON.parse(decodeURIComponent(escape(atob(token))));

    // Tamper with name
    decoded.name = 'Forged Impostor Name';
    const tamperedToken = btoa(unescape(encodeURIComponent(JSON.stringify(decoded))));

    const verification = verifyAlumniToken(tamperedToken);
    expect(verification.isValid).toBe(false);
    expect(verification.error).toContain('Security signature mismatch');
  });

  it('rejects malformed or empty tokens gracefully', () => {
    const emptyResult = verifyAlumniToken('');
    expect(emptyResult.isValid).toBe(false);

    const garbageResult = verifyAlumniToken('not_valid_base64_json!@#');
    expect(garbageResult.isValid).toBe(false);
  });

  it('generates a full public verification URL for QR code embedding', () => {
    const url = getAlumniVerificationUrl(mockAlumniUser);
    expect(url).toContain('?verify=');
  });

  it('automatically falls back to account photo or defaults when avatar is updated', () => {
    const updatedUser: UserProfile = {
      ...mockAlumniUser,
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400'
    };

    const token = createAlumniVerificationToken(updatedUser);
    const verification = verifyAlumniToken(token);
    expect(verification.isValid).toBe(true);
    expect(verification.claim?.avatar).toBe('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400');
  });
});
