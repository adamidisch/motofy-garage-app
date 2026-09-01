/* PitStop data layer — local-first.
   Writes land in IndexedDB and show up in the UI immediately; an outbox queue pushes them
   to Supabase when there is a connection. No conflict engine yet: last write wins, and a
   row with pending local changes is never overwritten by a pull. */
(function (global) {
  'use strict';

  var DB_NAME = 'pitstop', DB_VER = 1;
  var DEMO_DB_NAME = 'pitstop-demo', DEMO_GARAGE = '00000000-0000-4000-8000-000000000001';
  var STORES = ['meta', 'customers', 'vehicles', 'jobs', 'photos', 'blobs', 'outbox'];
  var BUCKET = 'vehicle-photos';
  var FULL_MAX = 1200, THUMB_MAX = 320, Q_FULL = 0.82, Q_THUMB = 0.7;

  var db = null, sb = null, garageId = null, user = null;
  var authListeners = [];
  var cars = [];                     // the array the UI renders from (same instance always)
  var listeners = [];
  var flushing = false, flushAgain = false, online = true;

  function rememberMode(mode) {
    try { localStorage.setItem('pitstop-mode', mode || ''); } catch (e) {}
  }
  function rememberedMode() {
    try { return localStorage.getItem('pitstop-mode') || ''; } catch (e) { return ''; }
  }

  /* ------------------------------------------------------------ idb */
  function openDB() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = function () {
        var d = r.result;
        STORES.forEach(function (s) { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(store, mode) { return db.transaction(store, mode || 'readonly').objectStore(store); }
  function req(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function all(store) { return req(tx(store).getAll()); }
  function put(store, val) { return req(tx(store, 'readwrite').put(val)); }
  function del(store, id) { return req(tx(store, 'readwrite').delete(id)); }
  function get(store, id) { return req(tx(store).get(id)); }
  function metaGet(k) { return get('meta', k).then(function (v) { return v ? v.v : null; }); }
  function metaSet(k, v) { return put('meta', { id: k, v: v }); }

  function uuid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  var flat = function (p) { return String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };

  /* ------------------------------------------------------------ supabase */
  function loadConfig() {
    return fetch('/api/config').then(function (r) { return r.json(); }).catch(function () { return {}; });
  }
  function initClient() {
    return loadConfig().then(function (c) {
      if (!c.supabaseUrl || !c.supabaseAnonKey || !global.supabase) return null;
      sb = global.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      return sb;
    });
  }

  /* ------------------------------------------------------------ projection for the UI */
  function statusOf(job) {
    if (!job) return { status: 'Νέο', cls: 'wait' };
    if (job.status === 'done') return { status: 'Έτοιμο', cls: '' };
    if (job.status === 'ready') return { status: 'Έτοιμο', cls: '' };
    if (job.status === 'in_progress') return { status: 'Στο garage', cls: '' };
    return { status: 'Αναμονή', cls: 'wait' };
  }
  function rebuild() {
    return Promise.all([all('vehicles'), all('customers'), all('jobs'), all('photos')])
      .then(function (r) {
        var vs = r[0], cs = r[1], js = r[2], ps = r[3];
        var byC = {}; cs.forEach(function (c) { byC[c.id] = c; });
        var out = vs.sort(function (a, b) { return (b.updated_at || '').localeCompare(a.updated_at || ''); })
          .map(function (v) {
            var cust = byC[v.customer_id] || {};
            var jobs = js.filter(function (j) { return j.vehicle_id === v.id; })
                         .sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
            var photos = ps.filter(function (p) { return p.vehicle_id === v.id; })
                           .sort(function (a, b) { return (a.is_cover ? -1 : 0) - (b.is_cover ? -1 : 0); });
            var st = statusOf(jobs[0]);
            return {
              id: v.id, plate: v.plate, name: cust.name || 'Πελάτης', phone: cust.phone || '',
              car: [v.make, v.model].filter(Boolean).join(' ') + (v.year ? ' · ' + v.year : ''),
              make: v.make, model: v.model, year: v.year, customer_id: v.customer_id,
              lookup: v.lookup || null,
              status: st.status, cls: st.cls,
              jobId: jobs[0] ? jobs[0].id : null,
              jobs: jobs[0] ? (jobs[0].items || []).slice() : [],
              photos: photos
            };
          });
        cars.length = 0; Array.prototype.push.apply(cars, out);
        listeners.forEach(function (f) { try { f(); } catch (e) {} });
        return cars;
      });
  }

  /* ------------------------------------------------------------ outbox */
  function enqueue(type, payload) {
    return put('outbox', { id: uuid(), at: Date.now(), type: type, payload: payload, tries: 0 })
      .then(function () { flush(); });
  }
  function pendingIds() {
    return all('outbox').then(function (ops) {
      var s = {};
      ops.forEach(function (o) { var p = o.payload || {}; if (p.id) s[p.id] = 1; if (p.photoId) s[p.photoId] = 1; });
      return s;
    });
  }

  function uploadPhoto(op) {
    var p = op.payload;
    return get('blobs', p.photoId).then(function (rec) {
      if (!rec) return;                                   // blob gone: drop the op
      var base = garageId + '/' + p.vehicleId + '/' + p.photoId;
      return sb.storage.from(BUCKET).upload(base + '.jpg', rec.full, { contentType: 'image/jpeg', upsert: true })
        .then(function () { return sb.storage.from(BUCKET).upload(base + '_t.jpg', rec.thumb, { contentType: 'image/jpeg', upsert: true }); })
        .then(function () {
          return sb.from('photos').upsert({
            id: p.photoId, garage_id: garageId, vehicle_id: p.vehicleId,
            storage_path: base + '.jpg', thumb_path: base + '_t.jpg',
            is_cover: !!p.isCover, width: p.w, height: p.h, bytes: p.bytes
          });
        })
        .then(function (r) { if (r && r.error) throw r.error; });
    });
  }

  function runOp(op) {
    var p = op.payload;
    if (op.type === 'customer.upsert') return sb.from('customers').upsert(Object.assign({ garage_id: garageId }, p)).then(chk);
    if (op.type === 'vehicle.upsert')  return sb.from('vehicles').upsert(Object.assign({ garage_id: garageId }, p)).then(chk);
    if (op.type === 'job.upsert')      return sb.from('jobs').upsert(Object.assign({ garage_id: garageId }, p)).then(chk);
    if (op.type === 'photo.upload')    return uploadPhoto(op);
    return Promise.resolve();
  }
  function chk(r) { if (r && r.error) throw r.error; return r; }

  function flush() {
    if (!sb || !garageId || !online) return Promise.resolve();
    if (flushing) { flushAgain = true; return Promise.resolve(); }   // a write landed mid-flush
    flushing = true;
    return all('outbox').then(function (ops) {
      ops.sort(function (a, b) { return a.at - b.at; });
      return ops.reduce(function (chain, op) {
        return chain.then(function () {
          return runOp(op).then(function () { return del('outbox', op.id); })
            .catch(function (e) {
              op.tries = (op.tries || 0) + 1;
              // a rejected write (RLS, constraint) will never succeed on retry — park it
              if (op.tries > 5) return del('outbox', op.id);
              return put('outbox', op).then(function () { throw e; });
            });
        });
      }, Promise.resolve());
    }).catch(function () { /* offline or blocked: keep the queue, try later */ })
      .then(function () {
        flushing = false;
        if (flushAgain) { flushAgain = false; return flush(); }      // pick up what arrived meanwhile
        return pushCount();
      });
  }
  function pushCount() { return all('outbox').then(function (o) { return o.length; }); }

  /* ------------------------------------------------------------ pull */
  function pull() {
    if (!sb || !garageId || !online) return Promise.resolve();
    return pendingIds().then(function (pend) {
      return Promise.all([
        sb.from('customers').select('*').eq('garage_id', garageId),
        sb.from('vehicles').select('*').eq('garage_id', garageId),
        sb.from('jobs').select('*').eq('garage_id', garageId),
        sb.from('photos').select('*').eq('garage_id', garageId)
      ]).then(function (res) {
        var names = ['customers', 'vehicles', 'jobs', 'photos'];
        var writes = [];
        res.forEach(function (r, i) {
          if (r.error) return;
          (r.data || []).forEach(function (row) {
            if (pend[row.id]) return;                     // local edit not yet pushed: keep ours
            writes.push(put(names[i], row));
          });
        });
        return Promise.all(writes);
      });
    }).then(signThumbs).then(rebuild).catch(function () {});
  }

  function signThumbs() {
    return all('photos').then(function (ps) {
      var need = ps.filter(function (p) { return p.thumb_path && (!p.thumbUrl || (p.signedAt || 0) < Date.now() - 3e6); });
      if (!need.length || !sb) return;
      return sb.storage.from(BUCKET).createSignedUrls(need.map(function (p) { return p.thumb_path; }), 3600)
        .then(function (r) {
          if (r.error) return;
          return Promise.all((r.data || []).map(function (s, i) {
            need[i].thumbUrl = s.signedUrl; need[i].signedAt = Date.now();
            return put('photos', need[i]);
          }));
        });
    }).catch(function () {});
  }

  /* ------------------------------------------------------------ photos */
  function canvasBlob(cv, q) {
    return new Promise(function (res) {
      var done = false;
      function fin(b) {
        if (done) return; done = true;
        try { res(b || dataURLtoBlob(cv.toDataURL('image/jpeg', q))); } catch (e) { res(null); }
      }
      try {
        if (cv.toBlob) { cv.toBlob(fin, 'image/jpeg', q); setTimeout(function () { fin(null); }, 1500); }
        else fin(null);
      } catch (e) { fin(null); }
    });
  }
  function dataURLtoBlob(d) {
    var parts = d.split(','), bin = atob(parts[1]), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: 'image/jpeg' });
  }
  function draw(src, sw, sh, max, q) {
    var sc = Math.min(1, max / Math.max(sw, sh));
    var cv = document.createElement('canvas');
    cv.width = Math.round(sw * sc); cv.height = Math.round(sh * sc);
    cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    return canvasBlob(cv, q).then(function (b) { return { blob: b, w: cv.width, h: cv.height, url: cv.toDataURL('image/jpeg', q) }; });
  }

  /* full ~1200px so damage stays inspectable, plus a small thumb for the strips */
  function makePhoto(src, sw, sh) {
    return Promise.all([draw(src, sw, sh, FULL_MAX, Q_FULL), draw(src, sw, sh, THUMB_MAX, Q_THUMB)])
      .then(function (r) {
        return { id: uuid(), full: r[0].blob, thumb: r[1].blob, thumbUrl: r[1].url, fullUrl: r[0].url, w: r[0].w, h: r[0].h, bytes: r[0].blob ? r[0].blob.size : 0 };
      });
  }

  function addPhoto(car, photo, isCover) {
    var row = {
      id: photo.id, garage_id: garageId, vehicle_id: car.id,
      storage_path: '', thumb_path: '', is_cover: !!isCover,
      width: photo.w, height: photo.h, bytes: photo.bytes,
      created_at: new Date().toISOString(),
      thumbUrl: photo.thumbUrl, localFull: photo.fullUrl        // shown until the upload lands
    };
    return put('blobs', { id: photo.id, full: photo.full, thumb: photo.thumb })
      .then(function () { return put('photos', row); })
      .then(function () {
        return enqueue('photo.upload', {
          photoId: photo.id, vehicleId: car.id, isCover: !!isCover,
          w: photo.w, h: photo.h, bytes: photo.bytes
        });
      })
      .then(rebuild);
  }

  /* ------------------------------------------------------------ writes */
  function saveVehicle(d) {
    var now = new Date().toISOString();
    var cust = null;
    var p = Promise.resolve();
    if (d.name || d.phone) {
      cust = { id: uuid(), garage_id: garageId, name: d.name || '', phone: d.phone || '', created_at: now, updated_at: now };
      p = put('customers', cust).then(function () {
        return enqueue('customer.upsert', { id: cust.id, name: cust.name, phone: cust.phone, updated_at: now });
      });
    }
    var v = {
      id: uuid(), garage_id: garageId, plate: d.plate, normalized_plate: flat(d.plate),
      make: d.make || '', model: d.model || '', year: d.year ? parseInt(d.year, 10) : null,
      customer_id: cust ? cust.id : null, lookup: d.lookup || null,
      created_at: now, updated_at: now
    };
    return p.then(function () { return put('vehicles', v); })
      .then(function () {
        return enqueue('vehicle.upsert', {
          id: v.id, plate: v.plate, make: v.make, model: v.model, year: v.year,
          customer_id: v.customer_id, lookup: v.lookup, updated_at: now
        });
      })
      .then(rebuild)
      .then(function () { return cars.filter(function (c) { return c.id === v.id; })[0]; });
  }

  function saveJobs(car, items, status) {
    var now = new Date().toISOString();
    return (car.jobId ? get('jobs', car.jobId) : Promise.resolve(null)).then(function (existing) {
      var j = existing || { id: uuid(), garage_id: garageId, vehicle_id: car.id, created_at: now };
      j.items = items.slice();
      j.status = status || (items.length ? 'in_progress' : 'open');
      j.updated_at = now;
      return put('jobs', j).then(function () {
        return enqueue('job.upsert', {
          id: j.id, vehicle_id: j.vehicle_id, items: j.items, status: j.status, updated_at: now
        });
      }).then(rebuild);
    });
  }

  /* full-size image for the viewer: local copy first, otherwise a signed URL */
  function photoUrl(p) {
    if (p.localFull) return Promise.resolve(p.localFull);
    return get('blobs', p.id).then(function (b) {
      if (b && b.full) return URL.createObjectURL(b.full);
      if (!sb || !p.storage_path) return null;
      return sb.storage.from(BUCKET).createSignedUrl(p.storage_path, 3600)
        .then(function (r) { return r && r.data ? r.data.signedUrl : null; });
    }).catch(function () { return null; });
  }


  /* ------------------------------------------------------------ guest demo */
  function seedGuestDemo() {
    return all('vehicles').then(function (existing) {
      if (existing.length) return;
      var now = new Date().toISOString();
      var rows = [
        { c: { id: 'demo-c1', name: 'Γιώργος Ιωάννου', phone: '99 123456' }, v: { id: 'demo-v1', plate: 'PYA 771', make: 'BMW', model: '320i', year: 2018 }, j: { id: 'demo-j1', status: 'ready', items: ['Service'] } },
        { c: { id: 'demo-c2', name: 'Μαρία Νικολάου', phone: '99 234567' }, v: { id: 'demo-v2', plate: 'NMY 204', make: 'Kia', model: 'Sportage', year: 2020 }, j: { id: 'demo-j2', status: 'in_progress', items: ['Φρένα'] } },
        { c: { id: 'demo-c3', name: 'Ανδρέας Χρίστου', phone: '99 345678' }, v: { id: 'demo-v3', plate: 'KAX 618', make: 'Toyota', model: 'Corolla', year: 2021 }, j: { id: 'demo-j3', status: 'open', items: [] } }
      ];
      return Promise.all(rows.map(function (r) {
        return put('customers', Object.assign({ garage_id: garageId, created_at: now, updated_at: now }, r.c))
          .then(function () { return put('vehicles', Object.assign({ garage_id: garageId, customer_id: r.c.id, normalized_plate: flat(r.v.plate), created_at: now, updated_at: now }, r.v)); })
          .then(function () { return put('jobs', Object.assign({ garage_id: garageId, vehicle_id: r.v.id, created_at: now, updated_at: now }, r.j)); });
      }));
    });
  }
  function enterGuest() {
    // Use a completely separate local database so cached real garage data can never leak into demo mode.
    try { if (db) db.close(); } catch (e) {}
    db = null; sb = null; garageId = DEMO_GARAGE; user = { id: 'guest', email: 'demo@local' };
    DB_NAME = DEMO_DB_NAME;
    online = false; // guest demo is intentionally local-only; nothing is sent to Supabase
    rememberMode('guest');
    return openDB().then(function (d) { db = d; })
      .then(seedGuestDemo)
      .then(function () { return Promise.all([metaSet('garage', garageId), metaSet('user', user)]); })
      .then(rebuild)
      .then(function () { authListeners.forEach(function (f) { try { f(true); } catch (e) {} }); return { ready: true, demo: true, user: user, garageId: garageId }; });
  }

  /* ------------------------------------------------------------ auth */
  /* Sends whatever the project's email template contains. With Supabase's default template
     that is a magic link; if the template is later changed to include {{ .Token }} the same
     call also delivers a 6-digit code and verify() below handles it. */
  function signIn(email) {
    if (!sb) return Promise.reject(new Error('offline'));
    rememberMode('account');
    return sb.auth.signInWithOtp({
      email: email,
      options: { shouldCreateUser: true, emailRedirectTo: global.location.origin + global.location.pathname }
    }).then(function (r) { if (r.error) throw r.error; return true; });
  }
  function verify(email, code) {
    if (!sb) return Promise.reject(new Error('offline'));
    return sb.auth.verifyOtp({ email: email, token: code, type: 'email' })
      .then(function (r) { if (r.error) throw r.error; return afterAuth(r.data.session); });
  }
  function signInWithGoogle() {
    if (!sb) return Promise.reject(new Error('offline'));
    rememberMode('account');
    return sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: global.location.origin + global.location.pathname }
    }).then(function (r) { if (r.error) throw r.error; return true; });
  }
  function signOut() {
    return (sb ? sb.auth.signOut() : Promise.resolve()).then(function () {
      user = null; garageId = null;
      rememberMode('');
      return Promise.all([metaSet('garage', null), metaSet('user', null)]);
    });
  }
  function afterAuth(session) {
    user = session && session.user ? session.user : null;
    if (!user) return null;
    return sb.rpc('ensure_garage', { p_name: null }).then(function (r) {
      if (r.error) throw r.error;
      garageId = r.data;
      return Promise.all([metaSet('garage', garageId), metaSet('user', { id: user.id, email: user.email })]);
    }).then(function () { return flush(); }).then(pull).then(function () { return { user: user, garageId: garageId }; });
  }

  /* ------------------------------------------------------------ boot */
  function boot() {
    online = navigator.onLine !== false;
    if (rememberedMode() === 'guest') {
      DB_NAME = DEMO_DB_NAME;
      online = false;
    }
    return openDB().then(function (d) { db = d; })
      .then(rebuild)                                        // paint whatever we already have
      .then(initClient)
      .then(function () {
        return Promise.all([metaGet('garage'), metaGet('user')]);
      })
      .then(function (m) {
        garageId = m[0]; user = m[1];
        if (rememberedMode() === 'guest') return seedGuestDemo().then(rebuild).then(function () { return { ready: true, demo: true, user: user, garageId: garageId }; });
        if (!sb) return { ready: !!garageId, offline: true, user: user };
        // the magic link comes back as a redirect: pick the session up when it lands
        try { registerAuthWatch(); } catch (e) {}
        return sb.auth.getSession().then(function (r) {
          var s = r && r.data ? r.data.session : null;
          if (!s) { return { ready: false, user: null }; }
          return afterAuth(s).then(function () { return { ready: true, user: user }; });
        });
      })
      .then(function (state) {
        global.addEventListener('online', function () { online = true; flush().then(pull); });
        global.addEventListener('offline', function () { online = false; });
        setInterval(function () { if (online) flush(); }, 30000);
        return state;
      });
  }

  function registerAuthWatch() {
    if (!sb || !sb.auth || !sb.auth.onAuthStateChange) return;
    sb.auth.onAuthStateChange(function (ev, session) {
      if (!session || (user && user.id === session.user.id)) return;
      afterAuth(session).then(function () {
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
        authListeners.forEach(function (f) { try { f(true); } catch (e) {} });
      });
    });
  }

  global.Store = {
    boot: boot, cars: cars, onChange: function (f) { listeners.push(f); },
    onAuth: function (f) { authListeners.push(f); },
    signIn: signIn, verify: verify, signInWithGoogle: signInWithGoogle, signOut: signOut, enterGuest: enterGuest,
    saveVehicle: saveVehicle, saveJobs: saveJobs,
    makePhoto: makePhoto, addPhoto: addPhoto, photoUrl: photoUrl,
    flush: flush, pull: pull, pending: pushCount, rebuild: rebuild,
    get garageId() { return garageId; }, get user() { return user; },
    get online() { return online; }
  };
})(window);
