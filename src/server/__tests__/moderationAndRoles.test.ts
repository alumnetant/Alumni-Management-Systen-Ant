import { describe, expect, it } from 'vitest';
import {
  normalizeSystemRole,
  isRoleAllowedOnPlatform,
  isAdministrativeOrStaffRole,
  type AppNotification
} from '../../types';
import {
  PostModerationEngine,
  ModerationError,
  isModeratorRole,
  isAdminRole,
  isSuperAdminRole
} from '../postModeration/moderationEngine';
import {
  parsePortalUrlPath,
  resolveNotificationDeepLink
} from '../../lib/notificationDeepLink';
import { dedupePostsById } from '../../lib/postVisibility';

describe('Role normalization and platform access helpers', () => {
  it('normalizes canonical and legacy staff/admin roles cleanly', () => {
    expect(normalizeSystemRole('moderator')).toBe('moderator');
    expect(normalizeSystemRole('  MODERATOR  ')).toBe('moderator');
    expect(normalizeSystemRole('registrar')).toBe('moderator');
    expect(normalizeSystemRole('staff')).toBe('moderator');
    expect(normalizeSystemRole('faculty')).toBe('moderator');
    expect(normalizeSystemRole('admin')).toBe('admin');
    expect(normalizeSystemRole('administrator')).toBe('admin');
    expect(normalizeSystemRole('system_administrator')).toBe('admin');
    expect(normalizeSystemRole('superadmin')).toBe('superadmin');
    expect(normalizeSystemRole('employer')).toBe('employer');
    expect(normalizeSystemRole('alumni')).toBe('alumni');
    expect(normalizeSystemRole(undefined)).toBe('alumni');
  });

  it('evaluates moderator, admin, and superadmin clearance helpers accurately', () => {
    expect(isModeratorRole('moderator')).toBe(true);
    expect(isModeratorRole('admin')).toBe(true);
    expect(isModeratorRole('superadmin')).toBe(true);
    expect(isModeratorRole('staff')).toBe(true);
    expect(isModeratorRole('alumni')).toBe(false);
    expect(isModeratorRole('employer')).toBe(false);

    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('superadmin')).toBe(true);
    expect(isAdminRole('moderator')).toBe(false);

    expect(isSuperAdminRole('superadmin')).toBe(true);
    expect(isSuperAdminRole('admin')).toBe(false);
  });

  it('enforces web vs mobile platform policy', () => {
    expect(isRoleAllowedOnPlatform('alumni', 'mobile')).toBe(true);
    expect(isRoleAllowedOnPlatform('moderator', 'mobile')).toBe(false);
    expect(isRoleAllowedOnPlatform('admin', 'mobile')).toBe(false);
    expect(isRoleAllowedOnPlatform('superadmin', 'mobile')).toBe(false);

    expect(isRoleAllowedOnPlatform('moderator', 'web')).toBe(true);
    expect(isRoleAllowedOnPlatform('admin', 'web')).toBe(true);
    expect(isRoleAllowedOnPlatform('superadmin', 'web')).toBe(true);
    expect(isAdministrativeOrStaffRole('moderator')).toBe(true);
    expect(isAdministrativeOrStaffRole('alumni')).toBe(false);
  });
});

describe('Moderation deep links and milestone removal', () => {
  it('routes /portal/moderation and /portal/moderation/appeals based on role clearance', () => {
    const modQueue = parsePortalUrlPath('/portal/moderation', 'moderator');
    expect(modQueue.tab).toBe('moderation');
    expect(modQueue.subTab).toBe('queue');

    const adminAppeals = parsePortalUrlPath('/portal/moderation/appeals/apl_123', 'admin');
    expect(adminAppeals.tab).toBe('moderation');
    expect(adminAppeals.subTab).toBe('appeals');
    expect(adminAppeals.targetId).toBe('apl_123');

    const alumniAttempt = parsePortalUrlPath('/portal/moderation', 'alumni');
    expect(alumniAttempt.tab).toBe('profile');
  });

  it('resolves moderation notifications for staff vs alumni and does not route milestones', () => {
    const appealNotif: AppNotification = {
      id: 'notif_1',
      toUid: 'usr_mod',
      fromUid: 'usr_alum',
      type: 'moderation_appeal',
      title: 'Appeal Submitted',
      body: 'A post appeal requires review.',
      refId: 'apl_99',
      read: false,
      createdAt: new Date().toISOString()
    };

    const staffTarget = resolveNotificationDeepLink(appealNotif, 'superadmin');
    expect(staffTarget.tab).toBe('moderation');
    expect(staffTarget.subTab).toBe('appeals');

    const alumniTarget = resolveNotificationDeepLink(appealNotif, 'alumni');
    expect(alumniTarget.tab).toBe('profile');
    expect(alumniTarget.subTab).toBe('moderation');

    const highPriorityNotif: AppNotification = {
      ...appealNotif,
      id: 'notif_2',
      type: 'moderation_high_priority',
      refId: 'case_12'
    };
    const modQueueTarget = resolveNotificationDeepLink(highPriorityNotif, 'moderator');
    expect(modQueueTarget.tab).toBe('moderation');
    expect(modQueueTarget.subTab).toBe('queue');

    const unknownMilestonesPath = parsePortalUrlPath('/portal/milestones', 'alumni');
    expect(unknownMilestonesPath.targetType).not.toBe('milestone');
  });
});

describe('PostModerationEngine moderation queue, legacy post normalization, and self-reaction protection', () => {
  it('authorizes moderator/admin/superadmin queue access and denies alumni/employer', () => {
    const engine = new PostModerationEngine({ persistToDisk: false, emailEnabled: false });

    const modActor = { uid: 'u_mod', name: 'Mod User', email: 'mod@stcecilia.edu.ph', role: 'moderator' };
    const adminActor = { uid: 'u_adm', name: 'Admin User', email: 'admin@stcecilia.edu.ph', role: 'admin' };
    const superActor = { uid: 'u_sup', name: 'Super Admin', email: 'superadmin@stcecilia.edu.ph', role: 'superadmin' };
    const alumniActor = { uid: 'u_alu', name: 'Alumni User', email: 'alum@stcecilia.edu.ph', role: 'alumni' };
    const employerActor = { uid: 'u_emp', name: 'Employer User', email: 'hr@partner.com', role: 'employer' };

    expect(engine.getPendingCountForModerator(modActor)).toBe(0);
    expect(engine.listModerationCases(adminActor, { status: 'pending' }).cases).toEqual([]);
    expect(engine.listModerationCases(superActor, { status: 'all' }).total).toBe(0);

    expect(() => engine.listModerationCases(alumniActor, {})).toThrow(ModerationError);
    expect(() => engine.getPendingCountForModerator(employerActor)).toThrow(ModerationError);
  });

  it('normalizes legacy milestone posts to update and prevents self-congratulation on update posts', () => {
    const engine = new PostModerationEngine({ persistToDisk: false, emailEnabled: false });
    const author = { uid: 'u_author', name: 'Maria Santos', email: 'maria@stcecilia.edu.ph', role: 'alumni' };
    const peer = { uid: 'u_peer', name: 'Juan Cruz', email: 'juan@stcecilia.edu.ph', role: 'alumni' };

    engine.upsertProfileRecord({ ...author, role: 'alumni' }, false);
    engine.upsertProfileRecord({ ...peer, role: 'alumni' }, false);

    const created = engine.upsertPost(
      {
        id: 'post_legacy_1',
        authorId: author.uid,
        authorName: author.name,
        authorRole: 'alumni',
        authorAvatar: '',
        postType: 'milestone' as any,
        title: 'Passed Board Exam',
        content: 'Grateful for the Cecilian community.',
        likes: [],
        hearts: [],
        comments: [],
        sharesCount: 0,
        createdAt: new Date().toISOString()
      },
      author
    );

    expect(created.postType).toBe('update');

    const auditResult = engine.auditAndNormalizeLegacyPosts();
    expect(auditResult.totalChecked).toBeGreaterThanOrEqual(1);

    const normalized = engine.getPostByIdForViewer('post_legacy_1', author);
    expect(normalized?.postType).toBe('update');

    expect(() => engine.togglePostReaction('post_legacy_1', author, 'heart')).toThrow(
      /cannot congratulate or react to your own post/i
    );

    const peerReact = engine.togglePostReaction('post_legacy_1', peer, 'heart');
    expect(peerReact.post.hearts).toContain(peer.uid);

    const peerUnreact = engine.togglePostReaction('post_legacy_1', peer, 'heart');
    expect(peerUnreact.post.hearts).not.toContain(peer.uid);
  });

  it('prevents self-reaction across update, gallery, and announcement posts', () => {
    const engine = new PostModerationEngine({ persistToDisk: false, emailEnabled: false });
    const adminAuthor = { uid: 'u_admin', name: 'Dean Reyes', email: 'dean@stcecilia.edu.ph', role: 'admin' };
    const peer = { uid: 'u_peer2', name: 'Carlos Lim', email: 'carlos@stcecilia.edu.ph', role: 'alumni' };

    engine.upsertProfileRecord({ ...adminAuthor, role: 'admin' }, false);
    engine.upsertProfileRecord({ ...peer, role: 'alumni' }, false);

    for (const postType of ['update', 'gallery', 'announcement'] as const) {
      const postId = `post_${postType}_self`;
      engine.upsertPost(
        {
          id: postId,
          authorId: adminAuthor.uid,
          authorName: adminAuthor.name,
          authorRole: 'admin',
          authorAvatar: '',
          postType,
          title: `Title ${postType}`,
          content: `Content ${postType}`,
          likes: [],
          hearts: [],
          comments: [],
          sharesCount: 0,
          createdAt: new Date().toISOString()
        },
        adminAuthor
      );

      expect(() => engine.togglePostReaction(postId, adminAuthor, 'heart')).toThrow(
        /cannot congratulate or react to your own post/i
      );

      const peerOn = engine.togglePostReaction(postId, peer, 'heart');
      expect(peerOn.post.hearts).toContain(peer.uid);
      const peerOff = engine.togglePostReaction(postId, peer, 'heart');
      expect(peerOff.post.hearts).not.toContain(peer.uid);
    }
  });

  it('blocks employer posting/sharing, lets non-employer authors edit/delete own posts, and calls deleteUserAccount', () => {
    const deletedUids: string[] = [];
    const usersMap = new Map<string, any>();
    const engine = new PostModerationEngine({
      persistToDisk: false,
      emailEnabled: false
    });
    engine.setUserAccountAdapter({
      getUserByUid: (uid) => usersMap.get(uid) || null,
      updateUserSuspension: () => {},
      getModeratorsAndAdmins: () => [],
      deleteUserAccount: (uid) => {
        deletedUids.push(uid);
        usersMap.delete(uid);
      }
    });

    const roles = ['alumni', 'moderator', 'admin', 'superadmin'] as const;
    for (const role of roles) {
      const actor = { uid: `u_${role}`, name: `User ${role}`, email: `${role}@stcecilia.edu.ph`, role };
      usersMap.set(actor.uid, { ...actor });
      engine.upsertProfileRecord({ ...actor, role }, false);

      const postId = `post_by_${role}`;
      const created = engine.upsertPost(
        {
          id: postId,
          authorId: actor.uid,
          authorName: actor.name,
          authorRole: role,
          authorAvatar: '',
          postType: 'update',
          title: 'Initial Title',
          content: 'Initial Content',
          likes: [],
          hearts: [],
          comments: [],
          sharesCount: 0,
          createdAt: new Date().toISOString()
        },
        actor
      );
      expect(created.id).toBe(postId);

      const edited = engine.editPostByAuthor(postId, actor, {
        title: 'Updated Title',
        content: 'Updated Content'
      });
      expect(edited.title).toBe('Updated Title');
      expect(edited.content).toBe('Updated Content');

      const deleted = engine.deletePostByUser(postId, actor);
      expect(deleted.success).toBe(true);
    }

    const employerActor = { uid: 'u_emp', name: 'Partner Corp', email: 'hr@partner.com', role: 'employer' };
    engine.upsertProfileRecord({ ...employerActor, role: 'employer' }, false);
    expect(() =>
      engine.upsertPost(
        {
          id: 'post_emp_blocked',
          authorId: employerActor.uid,
          authorName: employerActor.name,
          authorRole: 'employer',
          authorAvatar: '',
          postType: 'update',
          title: 'Blocked Employer Post',
          content: 'Should not succeed',
          likes: [],
          hearts: [],
          comments: [],
          sharesCount: 0,
          createdAt: new Date().toISOString()
        },
        employerActor
      )
    ).toThrow(/employer accounts cannot publish feed posts/i);

    const alumniOwner = { uid: 'u_alumni', name: 'User alumni', email: 'alumni@stcecilia.edu.ph', role: 'alumni' };
    engine.upsertPost(
      {
        id: 'post_shareable',
        authorId: alumniOwner.uid,
        authorName: alumniOwner.name,
        authorRole: 'alumni',
        authorAvatar: '',
        postType: 'update',
        title: 'Shareable Update',
        content: 'Visible update',
        likes: [],
        hearts: [],
        comments: [],
        sharesCount: 0,
        createdAt: new Date().toISOString()
      },
      alumniOwner
    );
    expect(() => engine.sharePost(employerActor, 'post_shareable', 'Repost attempt')).toThrow(
      /employer accounts cannot share or publish feed posts/i
    );

    const accDel = engine.deleteAndAnonymizeAccount('u_alumni', alumniOwner);
    expect(accDel.success).toBe(true);
    expect(deletedUids).toContain('u_alumni');
    expect(usersMap.has('u_alumni')).toBe(false);
  });

  it('never produces duplicate post IDs across heart, comment, edit, share, or client dedupe', () => {
    const engine = new PostModerationEngine({ persistToDisk: false });
    const author = { uid: 'u_author', name: 'Author One', email: 'a1@stcecilia.edu.ph', role: 'alumni' };
    const peer = { uid: 'u_peer', name: 'Peer Two', email: 'p2@stcecilia.edu.ph', role: 'alumni' };
    const admin = { uid: 'u_admin', name: 'Admin', email: 'admin@stcecilia.edu.ph', role: 'admin' };

    engine.upsertProfileRecord({ ...author, role: 'alumni' }, false);
    engine.upsertProfileRecord({ ...peer, role: 'alumni' }, false);
    engine.upsertProfileRecord({ ...admin, role: 'admin' }, false);

    const pinnedAdminPost = engine.upsertPost(
      {
        id: 'post_pinned_1',
        authorId: admin.uid,
        authorName: admin.name,
        authorRole: 'admin',
        authorAvatar: '',
        postType: 'announcement',
        title: 'Official Notice',
        content: 'Pinned update',
        likes: [],
        hearts: [],
        comments: [],
        sharesCount: 0,
        isPinned: true,
        visibility: 'alumni',
        createdAt: new Date(Date.now() - 2000).toISOString()
      },
      admin
    );

    const regularPost = engine.upsertPost(
      {
        id: 'post_regular_1',
        authorId: author.uid,
        authorName: author.name,
        authorRole: 'alumni',
        authorAvatar: '',
        postType: 'update',
        title: 'Milestone Update',
        content: 'Passed the licensure exam!',
        likes: [],
        hearts: [],
        comments: [],
        sharesCount: 0,
        visibility: 'alumni',
        createdAt: new Date().toISOString()
      },
      author
    );

    // Interact: peer hearts, comments, shares; author edits
    engine.togglePostReaction(regularPost.id, peer, 'heart');
    engine.addPostComment(regularPost.id, peer, 'Congrats!');
    engine.editPostByAuthor(regularPost.id, author, {
      title: 'Milestone Update (Edited)',
      content: 'Passed the licensure exam with honors!'
    });
    const shared = engine.sharePost(peer, regularPost.id, 'Proud of you!');

    const feed = engine.getMainFeed(peer, { limit: 20 });
    const allIds = [...feed.pinnedPosts.map((p) => p.id), ...feed.posts.map((p) => p.id)];
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(feed.pinnedPosts.map((p) => p.id)).toContain(pinnedAdminPost.id);
    expect(feed.posts.map((p) => p.id)).toContain(regularPost.id);
    expect(feed.posts.map((p) => p.id)).toContain(shared.id);

    // Also verify client dedupe helper strips duplicate occurrences cleanly
    const deduped = dedupePostsById([shared, regularPost, shared, regularPost, pinnedAdminPost]);
    expect(deduped.map((p) => p.id)).toEqual([shared.id, regularPost.id, pinnedAdminPost.id]);
  });
});
