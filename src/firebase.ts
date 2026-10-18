import { initializeApp } from 'firebase/app';
import { browserSessionPersistence,initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: 'AIzaSyC-2H282ITWdqBTYVJBsoC0gnA9Y-xl4LM',
  authDomain: 'skku-myrock.firebaseapp.com',
  projectId: 'skku-myrock',
  storageBucket: 'skku-myrock.firebasestorage.app',
  messagingSenderId: '42597556706',
  appId: '1:42597556706:web:6f6cde9d80c43cf94a59bb',
};

export const firebaseApp = initializeApp(config);
// Keep credentials only in the current browser tab's session storage.
// Existing LOCAL sessions are intentionally not restored after this change.
export const auth = initializeAuth(firebaseApp,{persistence:browserSessionPersistence});
export const db = getFirestore(firebaseApp);

// Firebase Authentication uses email/password internally; the UI exposes only student IDs.
// These synthetic addresses are not real mailboxes and cannot receive password resets.
export const accountEmail = (studentId: string) => `${studentId}@members.skku-myrock.firebaseapp.com`;

export type Session = '보컬' | '기타' | '베이스' | '드럼' | '키보드';
export type MemberRole = 'member' | 'part_leader' | 'staff' | 'president';
export interface MemberProfile {
  uid: string;
  studentId: string;
  name: string;
  generation: string;
  sessions: Session[];
  positions: string[];
  role: MemberRole;
  handoverAccess: boolean;
  superadmin: boolean;
}
