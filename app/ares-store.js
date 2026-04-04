/**
 * AresPipe Store — v2.0
 * Supabase entegrasyonlu veri katmanı.
 *
 * Mod:
 *   ARES.mod = 'local'    → localStorage (offline / fallback)
 *   ARES.mod = 'supabase' → Supabase (production)
 *
 * HTML'de Supabase CDN'i ares-store.js'den ÖNCE ekleyin:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <script src="ares-store.js"></script>
 */

const ARES = (function () {

  // ── SUPABASE BAĞLANTI ────────────────────────────────────
  const SUPA_URL = 'https://ochvbepfiatzvyknkvsn.supabase.co';
  const SUPA_KEY = 'sb_publishable_82EjJYZH9phnFC1MlIxnwQ_92Ic-4eb';

  let _supa = null;

  function _supabasiBaslat() {
    try {
      if (typeof window !== 'undefined' && window.supabase) {
        _supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
        console.log('[ARES] Supabase bağlantısı kuruldu');
        return true;
      }
    } catch (e) {
      console.warn('[ARES] Supabase başlatılamadı:', e.message);
    }
    return false;
  }

  // ── MOD: 'local' veya 'supabase' ────────────────────────
  // localStorage'da 'ares_mod' yoksa 'local' başlar
  // Supabase hazır olunca 'supabase' moduna geçilir
  let mod = localStorage.getItem('ares_mod') || 'local';

  function modDegistir(yeniMod) {
    mod = yeniMod;
    localStorage.setItem('ares_mod', yeniMod);
    console.log('[ARES] Mod:', yeniMod);
  }

  // ── OTURUM ───────────────────────────────────────────────
  let _oturum = null; // { id, tenant_id, ad_soyad, rol }

  async function girisYap(email, sifre) {
    if (!_supa) return { hata: 'Supabase bağlı değil' };
    const { data, error } = await _supa.auth.signInWithPassword({ email, password: sifre });
    if (error) return { hata: error.message };
    // Kullanıcı bilgilerini çek
    const { data: kul } = await _supa
      .from('kullanicilar')
      .select('*')
      .eq('id', data.user.id)
      .single();
    _oturum = kul || null;
    return { kullanici: _oturum };
  }

  async function cikisYap() {
    if (_supa) await _supa.auth.signOut();
    _oturum = null;
    localStorage.removeItem('ares_oturum');
  }

  async function oturumKontrol() {
    if (!_supa) return null;
    const { data: { session } } = await _supa.auth.getSession();
    if (!session) return null;
    const { data: kul } = await _supa
      .from('kullanicilar')
      .select('*')
      .eq('id', session.user.id)
      .single();
    _oturum = kul || null;
    return _oturum;
  }

  function oturumAl() {
    return _oturum;
  }

  function tenantId() {
    return _oturum?.tenant_id || null;
  }

  // ── LOCALSTORAGE YARDIMCILARI (local mod) ───────────────
  function _lget(key) {
    try { return JSON.parse(localStorage.getItem('ares_' + key)) || null; }
    catch { return null; }
  }
  function _lset(key, val) {
    try { localStorage.setItem('ares_' + key, JSON.stringify(val)); return true; }
    catch { return false; }
  }
  function _ldel(key) { localStorage.removeItem('ares_' + key); }

  // ── LOG ──────────────────────────────────────────────────
  async function logEkle(islem, aciklama, katman, katmanId, meta) {
    if (mod === 'supabase' && _supa) {
      const { error } = await _supa.from('islem_log').insert({
        tenant_id:  tenantId(),
        islem,
        aciklama,
        katman:     katman   || 'sistem',
        katman_id:  katmanId || null,
        yapan_id:   _oturum?.id || null,
        meta:       meta || null,
        spool_id:   meta?.spool_id   || null,
        devre_id:   meta?.devre_id   || null,
        proje_id:   meta?.proje_id   || null,
      });
      if (error) console.warn('[ARES] Log hatası:', error.message);
    } else {
      // localStorage
      const log = _lget('islemLog') || [];
      log.unshift({
        id:       'L' + Date.now(),
        tarih:    new Date().toLocaleString('tr-TR'),
        islem, aciklama,
        katman:   katman   || 'sistem',
        katmanId: katmanId || '',
        meta:     meta || {}
      });
      _lset('islemLog', log.slice(0, 1000));
    }
  }

  // ── NUMARA ÜRETİCİ ───────────────────────────────────────
  function sonrakiNo(tip) {
    const yil = new Date().getFullYear().toString().slice(-2);
    // local modda localStorage sayaç
    const sayaclar = _lget('sayaclar') || { kk:1, sevk:3, test:17, hakedis:1 };
    const no = tip + yil + '-' + String(sayaclar[tip] || 1).padStart(3, '0');
    sayaclar[tip] = (sayaclar[tip] || 1) + 1;
    _lset('sayaclar', sayaclar);
    return no;
    // Supabase modda: sequence veya max()+1 sorgusu ile yapılacak
  }

  // ─────────────────────────────────────────────────────────
  // SUPABASE CRUD YARDIMCILARI
  // Her fonksiyon mod'a göre localStorage veya Supabase kullanır
  // -────────────────────────────────────────────────────────

  // ── TERSANELER ───────────────────────────────────────────
  async function tersaneleriGetir() {
    if (mod === 'supabase' && _supa) {
      const { data, error } = await _supa
        .from('tersaneler')
        .select('*')
        .eq('aktif', true)
        .order('ad');
      if (error) { console.warn(error); return []; }
      return data;
    }
    return _lget('tersaneler') || [];
  }

  // ── PROJELERi ────────────────────────────────────────────
  async function projeleriGetir(tersaneId) {
    if (mod === 'supabase' && _supa) {
      let q = _supa.from('projeler').select('*, tersaneler(ad)').eq('aktif', true).order('proje_no');
      if (tersaneId) q = q.eq('tersane_id', tersaneId);
      const { data, error } = await q;
      if (error) { console.warn(error); return []; }
      return data;
    }
    const tum = _lget('projeler') || [];
    return tersaneId ? tum.filter(p => p.tersaneId === tersaneId) : tum;
  }

  // ── DEVRELER ─────────────────────────────────────────────
  async function devreleriGetir(projeId) {
    if (mod === 'supabase' && _supa) {
      let q = _supa.from('devreler').select('*, projeler(proje_no, gemi_adi, tersaneler(ad))').order('devre_no');
      if (projeId) q = q.eq('proje_id', projeId);
      const { data, error } = await q;
      if (error) { console.warn(error); return []; }
      return data;
    }
    const tum = _lget('devreler') || [];
    return projeId ? tum.filter(d => d.projeId === projeId) : tum;
  }

  async function devreGetir(id) {
    if (mod === 'supabase' && _supa) {
      const { data, error } = await _supa
        .from('devreler')
        .select('*, projeler(proje_no, gemi_adi, is_emri_no, tersaneler(ad,kod))')
        .eq('id', id)
        .single();
      if (error) { console.warn(error); return null; }
      return data;
    }
    return (_lget('devreler') || []).find(d => d.id === id) || null;
  }

  // ── SPOOLLER ─────────────────────────────────────────────
  async function spoollariGetir(devreId) {
    if (mod === 'supabase' && _supa) {
      let q = _supa.from('spooller')
        .select('*, devreler(devre_no, proje_id, projeler(proje_no, gemi_adi))')
        .order('spool_no');
      if (devreId) q = q.eq('devre_id', devreId);
      const { data, error } = await q;
      if (error) { console.warn(error); return []; }
      return data;
    }
    const tum = _lget('spooller') || [];
    return devreId ? tum.filter(s => s.devreId === devreId) : tum;
  }

  async function spoolGetir(id) {
    if (mod === 'supabase' && _supa) {
      const { data, error } = await _supa
        .from('spooller')
        .select(`
          *,
          devreler(devre_no, alistirma_devresi,
            projeler(proje_no, gemi_adi, is_emri_no,
              tersaneler(ad, kod)
            )
          ),
          spool_malzemeleri(*),
          notlar(*),
          fotograflar(*),
          belgeler(*)
        `)
        .eq('id', id)
        .single();
      if (error) { console.warn(error); return null; }
      return data;
    }
    return (_lget('spooller') || []).find(s => s.id === id) || null;
  }

  async function spoolGuncelle(id, degisiklikler) {
    if (mod === 'supabase' && _supa) {
      const { data, error } = await _supa
        .from('spooller')
        .update({ ...degisiklikler, guncelleme: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) { console.warn(error); return null; }
      return data;
    }
    // localStorage
    const liste = _lget('spooller') || [];
    const idx = liste.findIndex(s => s.id === id);
    if (idx === -1) return null;
    liste[idx] = { ...liste[idx], ...degisiklikler };
    _lset('spooller', liste);
    return liste[idx];
  }

  async function spoolDurdur(id, sebep, aciklama) {
    const guncelleme = {
      durduruldu: true,
      durdurma_sebebi: sebep + ': ' + aciklama,
      durdurma_tarihi: new Date().toISOString(),
    };
    await spoolGuncelle(id, guncelleme);
    await logEkle('DURDURMA', sebep + ' — ' + aciklama, 'spool', id, { spool_id: id });
    return true;
  }

  async function spoolDurdurmaKaldir(id) {
    await spoolGuncelle(id, { durduruldu: false, durdurma_sebebi: null, durdurma_tarihi: null });
    await logEkle('DURDURMA_KALDIRILDI', '', 'spool', id, { spool_id: id });
    return true;
  }

  // ── MALZEME LİSTESİ ──────────────────────────────────────
  async function malzemeleriGetir(spoolId) {
    if (mod === 'supabase' && _supa) {
      const { data, error } = await _supa
        .from('spool_malzemeleri')
        .select('*')
        .eq('spool_id', spoolId)
        .order('olusturma');
      if (error) { console.warn(error); return []; }
      return data;
    }
    return (_lget('malzemeler_' + spoolId)) || [];
  }

  // ── İŞLEM LOGU ───────────────────────────────────────────
  async function loguGetir(filtre, limit) {
    if (mod === 'supabase' && _supa) {
      let q = _supa.from('islem_log').select('*, kullanicilar(ad_soyad)').order('olusturma', { ascending: false });
      if (filtre?.katman)   q = q.eq('katman', filtre.katman);
      if (filtre?.spoolId)  q = q.eq('spool_id', filtre.spoolId);
      if (filtre?.devreId)  q = q.eq('devre_id', filtre.devreId);
      if (limit)            q = q.limit(limit);
      const { data, error } = await q;
      if (error) { console.warn(error); return []; }
      return data;
    }
    let log = _lget('islemLog') || [];
    if (filtre?.spoolId) log = log.filter(l => l.meta?.spool_id === filtre.spoolId);
    return limit ? log.slice(0, limit) : log;
  }

  // ── UYARILAR ─────────────────────────────────────────────
  function uyarilariGetir() {
    return _lget('uyarilar') || [];
  }

  function uyariEkle(kategori, seviye, baslik, aciklama, kaynak, link, ikon) {
    const liste = _lget('uyarilar') || [];
    const no = 'U' + Date.now();
    liste.unshift({
      id: no, kategori, seviye, goruldu: false,
      baslik, aciklama, kaynak, link: link || '',
      olusturma: new Date().toLocaleString('tr-TR'),
      ikon: ikon || '⚠️'
    });
    _lset('uyarilar', liste);
    return no;
  }

  function uyariGoruldu(id) {
    const liste = _lget('uyarilar') || [];
    const u = liste.find(x => x.id === id);
    if (u) { u.goruldu = true; _lset('uyarilar', liste); }
  }

  function uyariYeniSayisi() {
    return (_lget('uyarilar') || []).filter(u => !u.goruldu).length;
  }

  // ── BASAMAK SNAPSHOT (M-09) ──────────────────────────────
  async function basamaklariGetir() {
    if (mod === 'supabase' && _supa) {
      const { data, error } = await _supa
        .from('basamak_tanimlari')
        .select('*')
        .eq('aktif', true)
        .order('sira');
      if (error) { console.warn(error); return []; }
      return data;
    }
    return _lget('basamakTanimlari') || [
      { sistem_adi: 'on_imalat',  gorunen_ad: 'Ön İmalat',  sira: 1 },
      { sistem_adi: 'imalat',     gorunen_ad: 'İmalat',     sira: 2 },
      { sistem_adi: 'kaynak',     gorunen_ad: 'Kaynak',     sira: 3 },
      { sistem_adi: 'on_kontrol', gorunen_ad: 'Ön Kontrol', sira: 4 },
      { sistem_adi: 'kk',         gorunen_ad: 'KK',         sira: 5 },
      { sistem_adi: 'sevkiyat',   gorunen_ad: 'Sevkiyat',   sira: 6 },
    ];
  }

  // Spool oluşturulunca çağrılır — o anki basamak listesini snapshot alır
  async function basamakSnapshotOlustur() {
    const basamaklar = await basamaklariGetir();
    return basamaklar.map(b => ({
      sistem_adi:  b.sistem_adi,
      gorunen_ad:  b.gorunen_ad,
      sira:        b.sira
    }));
  }

  // ── UI: BELL GÜNCELLE ────────────────────────────────────
  function bellGuncelle() {
    const n = uyariYeniSayisi();
    const bellSayac = document.getElementById('bellSayac');
    const navBadge  = document.getElementById('navBadge');
    if (n > 0) {
      if (bellSayac) { bellSayac.textContent = n; bellSayac.style.display = 'flex'; }
      if (navBadge)  { navBadge.textContent  = n; navBadge.style.display  = 'flex'; }
    } else {
      if (bellSayac) bellSayac.style.display = 'none';
      if (navBadge)  navBadge.style.display  = 'none';
    }
  }

  // ── SIFIRLA (debug) ──────────────────────────────────────
  function sifirla() {
    ['spooller','devreler','projeler','tersaneler','uyarilar',
     'islemLog','sayaclar','initialized','mod'].forEach(k => _ldel(k));
    console.log('[ARES] Store sıfırlandı');
  }

  // ── INIT ─────────────────────────────────────────────────
  (function _init() {
    // Supabase CDN yüklüyse bağlan
    if (typeof window !== 'undefined') {
      if (window.supabase) {
        _supabasiBaslat();
      } else {
        // CDN henüz yüklenmediyse kısa bekle
        window.addEventListener('load', function() {
          if (window.supabase) _supabasiBaslat();
        });
      }
    }
  })();

  document.addEventListener('DOMContentLoaded', function () {
    bellGuncelle();
  });

  // ── PUBLIC API ───────────────────────────────────────────
  return {
    // Durum
    mod,
    modDegistir,
    supabase: function() { return _supa; },

    // Oturum
    girisYap, cikisYap, oturumKontrol, oturumAl, tenantId,

    // Veri
    tersaneleriGetir,
    projeleriGetir,
    devreleriGetir, devreGetir,
    spoollariGetir, spoolGetir, spoolGuncelle,
    spoolDurdur, spoolDurdurmaKaldir,
    malzemeleriGetir,
    loguGetir, logEkle,
    basamaklariGetir, basamakSnapshotOlustur,

    // Uyarılar
    uyarilariGetir, uyariEkle, uyariGoruldu, uyariYeniSayisi,

    // Numara
    sonrakiNo,

    // UI
    bellGuncelle,

    // Debug
    sifirla,
  };

})();

// Geriye dönük uyumluluk — eski sayfalar SYOS kullanıyorsa
const SYOS = ARES;
