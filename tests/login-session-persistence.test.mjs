import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Firebase Auth persists only within a browser tab session',async()=>{
 const source=await read('src/firebase.ts');
 assert.match(source,/import\s*\{[^}]*browserSessionPersistence[^}]*initializeAuth[^}]*\}\s*from\s*'firebase\/auth'/);
 assert.match(source,/export const auth\s*=\s*initializeAuth\(firebaseApp,\s*\{\s*persistence:\s*browserSessionPersistence\s*\}\)/);
 assert.doesNotMatch(source,/getAuth\(firebaseApp\)|browserLocalPersistence|indexedDBLocalPersistence|inMemoryPersistence|setPersistence\(/);
});

test('login and logout still use the same Firebase Auth instance without device limits',async()=>{
 const [login,app]=await Promise.all([read('src/pages/SitePages.tsx'),read('src/App.tsx')]);
 assert.match(login,/signInWithEmailAndPassword\(auth,\s*accountEmail\(studentId\.trim\(\)\),\s*password\)/);
 assert.match(app,/onAuthStateChanged\(auth,/);
 assert.match(app,/signOut\(auth\)/);
});
