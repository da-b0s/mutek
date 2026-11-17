// Data: a list response gains a record that belongs to someone else.
import { jsonReads, walk, touchingRoute, mutant, nice, lastKey } from './_util.js';

const OWNER = /^(owner|ownerId|owner_id|userId|user_id|user|customerId|customer_id|accountId|account_id|author|authorId|createdBy|created_by|tenant|tenantId)$/;
const OWNER_NAME = /^(ownerName|owner_name|userName|user_name|customer|customerName|customer_name|authorName|name)$/;
const ID = /^(id|_id|uuid|number|orderNumber|ref|reference)$/i;

export default {
  name: 'wrong-owner',
  family: 'data',
  summary: "A list response gains a record marked as another user's.",
  generate(profile) {
    const out = new Map();
    for (const t of profile.tests) {
      for (const e of jsonReads(t)) {
        walk(e.json, (p, v) => {
          if (!Array.isArray(v) || !v.length || typeof v[0] !== 'object' || v[0] === null) return;
          const ownerKey = Object.keys(v[0]).find((k) => OWNER.test(k));
          if (!ownerKey) return;
          const intruder = JSON.parse(JSON.stringify(v[0]));
          intruder[ownerKey] = typeof intruder[ownerKey] === 'number' ? intruder[ownerKey] + 9000 : 'tw-other-user';
          for (const k of Object.keys(intruder)) {
            if (ID.test(k)) intruder[k] = typeof intruder[k] === 'number' ? intruder[k] + 9000 : `9${String(intruder[k]).replace(/\D/g, '') || '999'}`;
            else if (OWNER_NAME.test(k) && typeof intruder[k] === 'string') intruder[k] = 'Jordan Okafor';
          }
          const id = `wrong-owner:${e.method} ${e.path}:${p}`;
          if (out.has(id)) return;
          out.set(id, mutant({
            id, family: 'data', operator: 'wrong-owner',
            match: { method: e.method, path: e.path },
            action: { type: 'json', ops: [{ op: 'push', path: p, value: intruder, position: 'start' }] },
            touches_tests: touchingRoute(profile, e.method, e.path),
            describe: `Another user's record (${ownerKey}=${JSON.stringify(intruder[ownerKey])}) appears in the ${nice(lastKey(p) || 'list')}`,
            expect: 'The test checks exactly which records are listed'
          }));
        });
      }
    }
    return [...out.values()];
  }
};
