(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MealLogSync = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const fields = ['meal_date', 'meal_time', 'meal_type', 'photo_url', 'foods', 'memo'];
  const clone = value => JSON.parse(JSON.stringify(value));
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
    return value;
  }
  function fingerprint(row) {
    if (!row) return 'null';
    const values = fields.map(key => {
      const value = row[key] ?? null;
      return key === 'meal_time' && value ? new Date(value).toISOString() : stable(value);
    });
    return JSON.stringify(values);
  }
  function fromRow(row) {
    const validTime = row.meal_time && Number.isFinite(Date.parse(row.meal_time));
    const clock = validTime ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(row.meal_time)) : '12:00';
    return { id: row.id, type: row.meal_type || '', time: row.meal_date + 'T' + clock, photo: row.photo_url || '', foods: row.foods || [], memo: row.memo || '' };
  }
  function toRow(meal, userId, base) {
    let time = meal.time || '';
    if (time && !/(Z|[+-]\d{2}:?\d{2})$/i.test(time)) time += (time.length === 16 ? ':00' : '') + '+09:00';
    const unchangedTime = base && meal.time === fromRow(base).time;
    return { id: meal.id, user_id: userId, meal_date: unchangedTime ? base.meal_date : (meal.time || '').slice(0, 10), meal_type: meal.type || '', meal_time: unchangedTime ? base.meal_time : time || null, photo_url: meal.photo || null, foods: meal.foods || [], memo: meal.memo || null };
  }
  function sameLocal(a, b) { return JSON.stringify(stable(a)) === JSON.stringify(stable(b)); }
  function create({ userId, client, storage, isCurrent = () => true }) {
    const key = 'meallog-meal-sync-v1:' + userId;
    const recoveryKey = 'meallog-meal-recovery-v1:' + userId;
    let stored = JSON.parse(storage.getItem(key) || '{"pending":[],"sequence":0}');
    if (!Array.isArray(stored.pending) || !Number.isSafeInteger(stored.sequence)) throw Error('저장 대기 기록을 읽지 못했어요. 기기 백업을 먼저 보관해 주세요.');
    let pending = new Map(stored.pending.map(item => [item.id, item]));
    for (const item of pending.values()) {
      if (!item.id || !Number.isSafeInteger(item.token) || (item.base && item.base.user_id !== userId) || (item.next && (item.next.user_id !== userId || item.next.id !== item.id))) throw Error('계정에 맞지 않는 저장 대기 기록이에요. 백업을 확인해 주세요.');
    }
    let sequence = stored.sequence, remote = new Map(), observed = new Map(), ready = false, recoveryCount = 0;
    const check = () => { if (!isCurrent()) throw Error('계정이 변경되어 저장을 중단했어요.'); };
    function persist(next, nextSequence = sequence) {
      // Persist the queue before changing memory or sending a write to the server.
      storage.setItem(key, JSON.stringify({ pending: [...next.values()], sequence: nextSequence }));
      pending = next; sequence = nextSequence;
    }
    function archive(reason, meals) {
      if (!meals.length) return;
      const backups = JSON.parse(storage.getItem(recoveryKey) || '[]');
      backups.push({ savedAt: new Date().toISOString(), reason, meals: clone(meals) });
      // Do not discard recovery data automatically. Storage errors stop synchronization.
      storage.setItem(recoveryKey, JSON.stringify(backups));
    }
    function view() {
      const result = new Map([...remote].map(([id, row]) => [id, fromRow(row)]));
      for (const item of pending.values()) {
        if (item.next) result.set(item.id, clone(item.local));
        else result.delete(item.id);
      }
      return [...result.values()];
    }
    function observe(meals) { observed = new Map(meals.map(meal => [meal.id, clone(meal)])); }
    function reconcile(rows, previousLocal = []) {
      check();
      remote = new Map(rows.map(row => [row.id, clone(row)]));
      if (!ready) {
        const uncertain = previousLocal.filter(meal => !pending.has(meal.id) && (!remote.has(meal.id) || fingerprint(toRow(meal, userId)) !== fingerprint(remote.get(meal.id))));
        archive('이전 기기에만 있거나 서버와 다른 기록', uncertain);
        recoveryCount = uncertain.length;
      }
      const meals = view(); observe(meals); ready = true; return meals;
    }
    function capture(meals) {
      check();
      if (!ready) throw Error('기록을 불러오는 중이에요. 잠시 후 다시 저장해 주세요.');
      const current = new Map(meals.map(meal => [meal.id, meal]));
      const next = new Map(pending); let serial = sequence;
      for (const id of new Set([...observed.keys(), ...current.keys()])) {
        const before = observed.get(id), after = current.get(id);
        if (sameLocal(before ?? null, after ?? null)) continue;
        const old = next.get(id);
        const base = old ? old.base : remote.get(id) || null;
        if (!base && !after) next.delete(id); // A new, never-uploaded draft was removed.
        else next.set(id, { id, base: base && clone(base), next: after ? toRow(after, userId, base) : null, local: after ? clone(after) : null, token: ++serial });
      }
      persist(next, serial); observe(meals);
    }
    async function readRows() {
      const rows = []; let last;
      while (true) {
        check();
        let query = client.from('meals').select('*').eq('user_id', userId).order('id', { ascending: true }).limit(100);
        if (last) query = query.gt('id', last);
        const { data, error } = await query;
        check(); if (error) throw error;
        rows.push(...data); if (data.length < 100) return rows;
        last = data[data.length - 1].id;
      }
    }
    function match(query, base) {
      for (const field of fields) {
        const value = base[field];
        query = value == null ? query.is(field, null) : query.eq(field, field === 'foods' ? JSON.stringify(value) : value);
      }
      return query;
    }
    function acknowledge(item) {
      const next = new Map(pending);
      if (next.get(item.id)?.token === item.token) next.delete(item.id);
      else if (next.has(item.id)) {
        // An edit made while this request was running must remain queued.
        const newer = next.get(item.id);
        next.set(item.id, { ...newer, base: remote.get(item.id) || null });
      }
      persist(next);
    }
    function conflict(item) {
      const latest = pending.get(item.id);
      archive('다른 기기의 변경과 겹쳐 자동 저장하지 않은 내용', latest && latest.token !== item.token ? [item, latest] : [item]);
      const next = new Map(pending); next.delete(item.id); persist(next);
    }
    async function sync() {
      check(); let conflicts = 0;
      remote = new Map((await readRows()).map(row => [row.id, row]));
      for (const item of [...pending.values()]) {
        check();
        const current = remote.get(item.id) || null;
        // A previous request may have succeeded even when its response was lost.
        if ((!item.next && !current) || (item.next && current && fingerprint(item.next) === fingerprint(current))) { acknowledge(item); continue; }
        if (fingerprint(item.base) !== fingerprint(current)) {
          conflict(item); conflicts++; continue;
        }
        let query;
        if (!item.base) query = client.from('meals').insert(item.next);
        else {
          query = item.next ? client.from('meals').update(Object.fromEntries(fields.map(field => [field, item.next[field]]))) : client.from('meals').delete();
          query = match(query.eq('id', item.id).eq('user_id', userId), item.base);
        }
        const { data, error } = item.base && (item.base.photo_url||'').length>1000
          ? await client.rpc('meal_compare_write',{p_id:item.id,p_expected:item.base,p_next:item.next}).single()
          : await query.select('*').single();
        check();
        if (error) {
          if (error.code === 'PGRST116' || error.code === '23505') {
            // Refresh before resolving the conflict; never turn a missing row into an insert.
            remote = new Map((await readRows()).map(row => [row.id, row]));
            conflict(item); conflicts++; continue;
          }
          throw error; // Keep the persisted queue for a later retry.
        }
        if (item.next) remote.set(item.id, data); else remote.delete(item.id);
        acknowledge(item);
      }
      const meals = view(); observe(meals); return { meals, conflicts };
    }
    return { reconcile, capture, sync, get ready() { return ready; }, get pendingCount() { return pending.size; }, get recoveryKey() { return recoveryKey; }, get recoveryCount() { return recoveryCount; } };
  }
  return { create, fingerprint, fromRow, toRow };
});
