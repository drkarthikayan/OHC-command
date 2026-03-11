import { auth, db } from '../config/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export async function superAdminLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const token = await cred.user.getIdTokenResult(true);
  if (token.claims.role !== 'super_admin') {
    await signOut(auth);
    throw new Error('Access denied — not a Super Admin account.');
  }
  return {
    uid: cred.user.uid,
    email: cred.user.email,
    name: token.claims.name || cred.user.email.split('@')[0],
    role: 'super_admin',
  };
}

export async function superAdminLogout() {
  await signOut(auth);
}

export async function staffLogin(tenantId, staffId, password) {
  const usersRef = collection(db, 'merchants', tenantId, 'users');
  const q = query(usersRef, where('staffId', '==', staffId.toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Staff ID not found.');
  const userDoc = snap.docs[0];
  const user = { id: userDoc.id, ...userDoc.data() };
  if (user.status === 'suspended' || user.status === 'Suspended') throw new Error('Account suspended. Contact your admin.');
  if (user.status === 'Pending' || user.status === 'pending') throw new Error('Account pending approval. Contact your admin.');
  if (user.password !== password) throw new Error('Incorrect password.');
  const tenantSnap = await getDoc(doc(db, 'merchants', tenantId));
  const tenant = tenantSnap.exists() ? { id: tenantId, ...tenantSnap.data() } : null;
  return { user, tenant };
}

export async function getTenants() {
  const snap = await getDocs(collection(db, 'merchants'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(t => ['active', 'Active', 'trial', 'Trial'].includes(t.status));
}
