/**
 * SYOS Store — Sayfalararası Paylaşımlı Veri Katmanı
 * localStorage tabanlı, backend hazır olduğunda her fonksiyon
 * fetch() çağrısına dönüştürülecek.
 *
 * Kullanım: Her HTML sayfasına <script src="syos-store.js"></script> ekle
 */

const SYOS = (function () {

  // ── Yardımcı: localStorage okuma/yazma ──────────────────
  function _get(key) {
    try { return JSON.parse(localStorage.getItem('syos_' + key)) || null; }
    catch { return null; }
  }
  function _set(key, val) {
    try { localStorage.setItem('syos_' + key, JSON.stringify(val)); return true; }
    catch { return false; }
  }
  function _del(key) { localStorage.removeItem('syos_' + key); }

  // ── Varsayılan veri yapısı ──────────────────────────────
  function _varsayilan() {
    return {
      spooller: [
        {
          id: 'SP-1277', no: 'S02', spoolKodu: 'NB1137-Y100-817-007-S02',
          projeNo: 'NB1137', devre: 'Y100-817-007', tersane: 'TERSAN',
          gemi: '', cap: '114,3 mm', agirlik: 26.82,
          durum: 'imalat',   // imalat | kk_hazir | kk_bekliyor | kk_onaylandi | sevk_hazir | sevkiyatta | tamamlandi | durduruldu
          kkDurum: null,     // null | 'bekliyor' | 'onaylandi' | 'reddedildi'
          sevkDurum: null,   // null | 'hazir' | 'gonderildi'
          durduruldu: false,
          durdurmaAciklama: '',
          testDurum: null,   // null | 'bekliyor' | 'gecti' | 'hatali'
          islemler: {
            kesim:    { toplam: 1, tamamlanan: 1 },
            bukum:    { toplam: 0, tamamlanan: 0 },
            markalama:{ toplam: 2, tamamlanan: 0 },
            test:     { toplam: 0, tamamlanan: 0 },
          },
          notlar: [],
          fotograflar: [],
          sonGuncelleme: new Date().toISOString(),
        }
      ],

      // Kalite kontrol davet paketleri
      kkPaketler: [],

      // Sevkiyat paketleri
      sevkiyatlar: [
        {
          id:'S26-001', no:'S26-001', tip:'giden', durum:'gonderildi',
          tersane:'Sedef Tersanesi', projeNo:'NB1099', gemi:'MV Atlas',
          arac:'34 ABC 001', irsaliye:'İRS-2026-001', tarih:'15.03.2026',
          teslimKisi:'Ahmet Yılmaz', teslimTel:'0532 111 2233',
          not:'Sorunsuz teslim.',
          spooller:[{spool:'S01',devre:'fw-bypass',agirlik:7.2},{spool:'S02',devre:'fw-bypass',agirlik:5.8}],
          belgeler:['Sevkiyat Listesi','İrsaliye'], fotograflar:[],
        },
        {
          id:'S26-002', no:'S26-002', tip:'gelen', durum:'gonderildi',
          tersane:'Sedef Tersanesi', projeNo:'NB1099', gemi:'MV Atlas',
          arac:'34 XYZ 456', irsaliye:'TRS-2026-044', tarih:'18.03.2026',
          teslimKisi:'Mehmet Demir', teslimTel:'', not:'Tersaneden gelen flanş malzemeleri.',
          icerik:'Kaynak boyunlu flanş PN16 x 12 adet',
          spooller:[], belgeler:['İrsaliye'], fotograflar:[],
        },
      ],

      // Test paketleri
      testler: [
        {
          id:'T26-016', no:'T26-016', durum:'bekleyen',
          tersane:'Cemre Shipyard', projeNo:'NB-124', gemi:'',
          devre:'FW-305', tip:'PT', tipAd:'Basınç Testi',
          not:'10 bar basınç altında 60 dk bekleme',
          tarih:'22.04.2026', firma:'Montaj Şefi Uğur Demir',
          spooller:[
            {no:'S01',sonuc:'bekliyor',hataKaynagi:'',spoolNot:''},
            {no:'S02',sonuc:'bekliyor',hataKaynagi:'',spoolNot:''},
          ],
          sonucBilgi:null, fotograflar:[], belgeler:[]
        },
      ],

      // Uyarılar
      uyarilar: [
        {
          id:'U001', kategori:'devre', seviye:'kritik', goruldu:false,
          baslik:'Hareketsiz Devre: bilge-001',
          aciklama:'NB1099 / MV Atlas — bilge-001 devresinde 72 saat hareketsizlik tespit edildi.',
          kaynak:'Sedef Tersanesi / NB1099',
          link:'devre_detay_sayfasi.html',
          olusturma:'26.03.2026 14:22', ikon:'⏸️'
        },
        {
          id:'U002', kategori:'personel', seviye:'uyari', goruldu:false,
          baslik:'Sağlık Raporu Süresi Dolmak Üzere',
          aciklama:'Mehmet Demir — Sağlık raporu 12 gün içinde sona erecek.',
          kaynak:'Mehmet Demir', link:'personel.html',
          olusturma:'27.03.2026 08:00', ikon:'🏥'
        },
      ],

      // Log
      islemLog: [],

      // Sayaçlar
      sayaclar: { kk: 1, sevk: 3, test: 17, uyari: 3 },
    };
  }

  // ── İlk yüklemede varsayılan veriyi kur ─────────────────
  function _init() {
    if (!_get('initialized')) {
      const v = _varsayilan();
      _set('spooller',    v.spooller);
      _set('kkPaketler',  v.kkPaketler);
      _set('sevkiyatlar', v.sevkiyatlar);
      _set('testler',     v.testler);
      _set('uyarilar',    v.uyarilar);
      _set('islemLog',    v.islemLog);
      _set('sayaclar',    v.sayaclar);
      _set('initialized', true);
    }
  }

  // ── Log yardımcısı ───────────────────────────────────────
  function _log(islem, kaynak, aciklama, katman, katmanId, ust) {
    const log = _get('islemLog') || [];
    log.unshift({
      id: 'L' + Date.now(),
      tarih: new Date().toLocaleString('tr-TR'),
      islem, kaynak, aciklama,
      katman:   katman   || 'sistem',   // sistem | spool | devre | proje | personel | tersane
      katmanId: katmanId || '',
      ust: ust || {}                    // { spool, devre, proje, tersane } üst bağlamlar
    });
    _set('islemLog', log.slice(0, 1000)); // max 1000 kayıt
  }

  // ── Sayaç ────────────────────────────────────────────────
  function _sonrakiNo(tip) {
    const s = _get('sayaclar') || { kk:1, sevk:1, test:1, uyari:1 };
    const yil = new Date().getFullYear().toString().slice(-2);
    const no = tip + yil + '-' + String(s[tip] || 1).padStart(3, '0');
    s[tip] = (s[tip] || 1) + 1;
    _set('sayaclar', s);
    return no;
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════

  // ── SPOOL ────────────────────────────────────────────────

  function spoolGetir(spoolKodu) {
    const liste = _get('spooller') || [];
    return liste.find(s => s.spoolKodu === spoolKodu || s.id === spoolKodu) || null;
  }

  function spoolGuncelle(spoolKodu, degisiklikler) {
    const liste = _get('spooller') || [];
    const idx = liste.findIndex(s => s.spoolKodu === spoolKodu || s.id === spoolKodu);
    if (idx === -1) return false;
    liste[idx] = { ...liste[idx], ...degisiklikler, sonGuncelleme: new Date().toISOString() };
    _set('spooller', liste);
    return liste[idx];
  }

  function spoolKKyeGonder(spoolKodu, tersane, projeNo, gemi, devre, agirlik) {
    // 1. Spool durumunu güncelle
    spoolGuncelle(spoolKodu, { durum: 'kk_hazir', kkDurum: null });

    // 2. KK hazır listesine ekle (KK sayfası buradan okuyacak)
    const kkHazir = _get('kkHazir') || [];
    const zatenVar = kkHazir.find(s => s.spoolKodu === spoolKodu);
    if (!zatenVar) {
      kkHazir.push({
        id: 'h-' + Date.now(),
        spoolKodu, tersane, projeNo, gemi, devre, agirlik,
        kaynak: 'spool_detay',
        tarih: new Date().toLocaleString('tr-TR')
      });
      _set('kkHazir', kkHazir);
    }

    _log('KK_GONDER', spoolKodu, tersane+' / '+devre+' — Kalite kontrole gönderildi', 'spool', spoolKodu, {devre:devre,tersane:tersane});
    return true;
  }

  function spoolSevkiyataGonder(spoolKodu, tersane, projeNo, gemi, devre, agirlik) {
    spoolGuncelle(spoolKodu, { durum: 'sevk_hazir', sevkDurum: 'hazir' });

    const sevkHazir = _get('sevkHazir') || [];
    const zatenVar = sevkHazir.find(s => s.spoolKodu === spoolKodu);
    if (!zatenVar) {
      sevkHazir.push({
        id: 'hs-' + Date.now(),
        spoolKodu, tersane, projeNo, gemi, devre, agirlik,
        kaynak: 'direkt',
        tarih: new Date().toLocaleString('tr-TR')
      });
      _set('sevkHazir', sevkHazir);
    }

    _log('SEVK_HAZIR', spoolKodu, tersane+' / '+devre+' — Sevkiyat hazırlık listesine eklendi', 'spool', spoolKodu, {devre:devre,tersane:tersane});
    return true;
  }

  function spoolDurdur(spoolKodu, sebep, aciklama) {
    spoolGuncelle(spoolKodu, {
      durduruldu: true,
      durum: 'durduruldu',
      durdurmaAciklama: sebep + ': ' + aciklama,
      durdurulmaTarihi: new Date().toLocaleString('tr-TR')
    });

    // Uyarı ekle
    uyariEkle('devre', 'kritik',
      'Spool Durduruldu: ' + spoolKodu,
      sebep + ' — ' + aciklama,
      spoolKodu,
      'spool_detay.html?durduruldu=1&sebep=' + encodeURIComponent(sebep),
      '⛔'
    );

    _log('SPOOL_DURDUR', spoolKodu, sebep+': '+aciklama, 'spool', spoolKodu, {});
    return true;
  }

  function spoolDurdurmaKaldir(spoolKodu) {
    spoolGuncelle(spoolKodu, {
      durduruldu: false,
      durum: 'imalat',
      durdurmaAciklama: '',
      durdurulmaTarihi: null
    });
    _log('SPOOL_BASLAT', spoolKodu, 'Durdurma kaldırıldı, yeniden aktif', 'spool', spoolKodu, {});
    return true;
  }

  // ── KALİTE KONTROL ──────────────────────────────────────

  function kkHazirListesi() {
    return _get('kkHazir') || [];
  }

  function kkPaketOlustur(spoolIdler, tersane, projeNo, gemi, davetTarihi, kontrolTarihi, not, mail) {
    const hazir = _get('kkHazir') || [];
    const secili = hazir.filter(s => spoolIdler.includes(s.id));
    if (!secili.length) return null;

    const no = 'KD-' + _sonrakiNo('kk');
    const paket = {
      id: no, no,
      tersane, projeNo, gemi,
      davetTarihi, kontrolTarihi, not, mail,
      durum: 'bekleyen',
      onay: null,
      spooller: secili.map(s => ({ ...s, durumOnay: null })),
      olusturma: new Date().toLocaleString('tr-TR')
    };

    const paketler = _get('kkPaketler') || [];
    paketler.unshift(paket);
    _set('kkPaketler', paketler);

    // Gönderilenleri hazır listesinden çıkar
    const kalanlar = hazir.filter(s => !spoolIdler.includes(s.id));
    _set('kkHazir', kalanlar);

    // Spool durumlarını güncelle
    secili.forEach(s => spoolGuncelle(s.spoolKodu, { durum: 'kk_bekliyor', kkDurum: 'bekliyor' }));

    _log('KK_PAKET', no, tersane + ' / ' + projeNo + ' — ' + secili.length + ' spool');
    return paket;
  }

  function kkPaketleri() {
    return _get('kkPaketler') || [];
  }

  function kkOnayKaydet(paketId, karar, tarih, kisi, not) {
    const paketler = _get('kkPaketler') || [];
    const idx = paketler.findIndex(p => p.id === paketId);
    if (idx === -1) return false;

    paketler[idx].durum = karar === 'onay' ? 'onaylandi' : 'reddedildi';
    paketler[idx].onay = { karar, tarih, kisi, not };
    paketler[idx].spooller.forEach(s => s.durumOnay = karar);
    _set('kkPaketler', paketler);

    // Onaylananları sevkiyat hazır listesine aktar
    if (karar === 'onay') {
      const sevkHazir = _get('sevkHazir') || [];
      paketler[idx].spooller.forEach(s => {
        if (!sevkHazir.find(x => x.spoolKodu === s.spoolKodu)) {
          sevkHazir.push({
            id: 'hs-' + Date.now() + Math.random(),
            spoolKodu: s.spoolKodu,
            tersane: s.tersane || paketler[idx].tersane,
            projeNo: s.projeNo || paketler[idx].projeNo,
            gemi: s.gemi || paketler[idx].gemi,
            devre: s.devre || '',
            agirlik: s.agirlik || 0,
            kaynak: 'kalite_onay',
            tarih: tarih
          });
        }
        spoolGuncelle(s.spoolKodu, { durum: 'sevk_hazir', kkDurum: 'onaylandi', sevkDurum: 'hazir' });
      });
      _set('sevkHazir', sevkHazir);
    } else {
      paketler[idx].spooller.forEach(s =>
        spoolGuncelle(s.spoolKodu, { kkDurum: 'reddedildi', durum: 'imalat' })
      );
    }

    _log('KK_ONAY', paketId, (karar === 'onay' ? 'Onaylandı' : 'Reddedildi') + ' — ' + kisi);
    return true;
  }

  // ── SEVKİYAT ────────────────────────────────────────────

  function sevkHazirListesi() {
    return _get('sevkHazir') || [];
  }

  function sevkPaketOlustur(tip, spoolIdler, tersane, projeNo, arac, irsaliye, tarih, teslimKisi, teslimTel, not, icerik) {
    const no = 'S26-' + String((_get('sayaclar') || {}).sevk || 1).padStart(3, '0');
    const s = _get('sayaclar') || {};
    s.sevk = (s.sevk || 1) + 1;
    _set('sayaclar', s);

    const hazir = _get('sevkHazir') || [];
    const secili = tip === 'giden' ? hazir.filter(x => spoolIdler.includes(x.id)) : [];

    const paket = {
      id: no, no, tip, durum: 'gonderildi',
      tersane, projeNo, gemi: secili[0]?.gemi || '',
      arac, irsaliye, tarih,
      teslimKisi, teslimTel, not, icerik: icerik || '',
      spooller: secili.map(s => ({ spool: s.spoolKodu?.split('-').pop() || s.spoolKodu, devre: s.devre, agirlik: s.agirlik })),
      belgeler: tip === 'giden' ? ['Sevkiyat Listesi', 'İrsaliye'] : ['İrsaliye'],
      fotograflar: [],
      olusturma: new Date().toLocaleString('tr-TR')
    };

    const liste = _get('sevkiyatlar') || [];
    liste.unshift(paket);
    _set('sevkiyatlar', liste);

    // Gönderilenleri hazır listesinden çıkar
    if (tip === 'giden') {
      _set('sevkHazir', hazir.filter(x => !spoolIdler.includes(x.id)));
      secili.forEach(s => spoolGuncelle(s.spoolKodu, { durum: 'sevkiyatta', sevkDurum: 'gonderildi' }));
    }

    _log('SEVKİYAT', no, tip + ' — ' + tersane + (projeNo ? ' / ' + projeNo : ''));
    return paket;
  }

  function sevkiyatlar() {
    return _get('sevkiyatlar') || [];
  }

  // ── TESTLER ─────────────────────────────────────────────

  function testler() {
    return _get('testler') || [];
  }

  function testOlustur(tersane, projeNo, gemi, devre, tip, tipAd, not, tarih, firma, spoollar) {
    const no = _sonrakiNo('test');
    const paket = {
      id: no, no, durum: 'bekleyen',
      tersane, projeNo, gemi, devre, tip, tipAd, not, tarih, firma,
      spooller: spoollar.map(s => ({ no: s, sonuc: 'bekliyor', hataKaynagi: '', spoolNot: '' })),
      sonucBilgi: null, fotograflar: [], belgeler: [],
      olusturma: new Date().toLocaleString('tr-TR')
    };
    const liste = _get('testler') || [];
    liste.unshift(paket);
    _set('testler', liste);
    _log('TEST_OLUSTUR', no, tip+' — '+tersane+' / '+devre, 'devre', devre, {tersane:tersane,proje:projeNo});
    return paket;
  }

  function testSonucKaydet(testId, tarih, bas, bit, kisi, genel, spoolSonuclari, notMetni) {
    const liste = _get('testler') || [];
    const idx = liste.findIndex(t => t.id === testId);
    if (idx === -1) return false;

    liste[idx].sonucBilgi = { tarih, bas, bit, kisi, genel, not: notMetni };
    liste[idx].spooller = spoolSonuclari;
    if (genel === 'gecti')       liste[idx].durum = 'tamamlandi';
    else if (genel === 'kismi')  liste[idx].durum = 'hatali';
    else if (genel === 'kaldi')  liste[idx].durum = 'hatali';

    _set('testler', liste);
    _log('TEST_SONUC', testId, genel+' — '+kisi, 'sistem', testId, {});
    return true;
  }

  // ── UYARILAR ────────────────────────────────────────────

  function uyarilar() {
    return _get('uyarilar') || [];
  }

  function uyariEkle(kategori, seviye, baslik, aciklama, kaynak, link, ikon) {
    const liste = _get('uyarilar') || [];
    const no = 'U' + Date.now();
    liste.unshift({
      id: no, kategori, seviye, goruldu: false,
      baslik, aciklama, kaynak, link: link || '',
      olusturma: new Date().toLocaleString('tr-TR'),
      ikon: ikon || '⚠️'
    });
    _set('uyarilar', liste);
    return no;
  }

  function uyariGoruldu(id) {
    const liste = _get('uyarilar') || [];
    const u = liste.find(x => x.id === id);
    if (u) { u.goruldu = true; _set('uyarilar', liste); }
  }

  function uyariSil(id) {
    _set('uyarilar', (_get('uyarilar') || []).filter(u => u.id !== id));
  }

  function uyariYeniSayisi() {
    return (_get('uyarilar') || []).filter(u => !u.goruldu).length;
  }

  // ── DEVRE DURDURMA ───────────────────────────────────────

  function devreDurdur(devreKodu, kapsam, spoollar, sebep, aciklama, tahminiTarih) {
    // Durdurulan devreleri sakla
    const durdurulmusDev = _get('durdurulmusDevreler') || [];
    const mevcutIdx = durdurulmusDev.findIndex(d => d.devreKodu === devreKodu);

    const kayit = {
      devreKodu, kapsam,
      durdurulmusSspooller: spoollar,
      sebep, aciklama, tahminiTarih,
      tarih: new Date().toLocaleString('tr-TR'),
      aktif: true
    };

    if (mevcutIdx > -1) durdurulmusDev[mevcutIdx] = kayit;
    else durdurulmusDev.push(kayit);
    _set('durdurulmusDevreler', durdurulmusDev);

    // Her spool için durdurma işle
    spoollar.forEach(spoolKodu => spoolDurdur(spoolKodu, sebep, aciklama));

    // Uyarı oluştur
    uyariEkle('devre', 'kritik',
      'Devre Durduruldu: ' + devreKodu,
      sebep + ' — ' + aciklama + (tahminiTarih ? ' (Tahmini kaldırma: ' + tahminiTarih + ')' : ''),
      devreKodu,
      'devre_detay_sayfasi.html',
      '⛔'
    );

    _log('DEVRE_DURDUR', devreKodu, sebep+' — '+spoollar.length+' spool', 'devre', devreKodu, {});
    return true;
  }

  function devreninDurumuGetir(devreKodu) {
    const liste = _get('durdurulmusDevreler') || [];
    return liste.find(d => d.devreKodu === devreKodu && d.aktif) || null;
  }

  function devreDurdurmayiKaldir(devreKodu) {
    const liste = _get('durdurulmusDevreler') || [];
    const idx = liste.findIndex(d => d.devreKodu === devreKodu);
    if (idx > -1) {
      liste[idx].durdurulmusSspooller.forEach(sk => spoolDurdurmaKaldir(sk));
      liste[idx].aktif = false;
      _set('durdurulmusDevreler', liste);
    }
    _log('DEVRE_BASLAT', devreKodu, 'Durdurma kaldırıldı', 'devre', devreKodu, {});
    return true;
  }

  // ── İŞLEM LOGU ──────────────────────────────────────────

  function islemLogu(limit, filtre) {
    let log = _get('islemLog') || [];
    if (filtre) {
      if (filtre.katman)   log = log.filter(l => l.katman === filtre.katman);
      if (filtre.katmanId) log = log.filter(l => l.katmanId === filtre.katmanId);
      if (filtre.islem)    log = log.filter(l => (l.islem||'').includes(filtre.islem));
      if (filtre.tarihBas) log = log.filter(l => l.tarih >= filtre.tarihBas);
      if (filtre.tarihBit) log = log.filter(l => l.tarih <= filtre.tarihBit);
      if (filtre.tersane)  log = log.filter(l => l.kaynak && l.kaynak.includes(filtre.tersane) || (l.ust && l.ust.tersane === filtre.tersane));
    }
    return limit ? log.slice(0, limit) : log;
  }

  // ── BELL DURUMU ─────────────────────────────────────────
  // Her sayfanın header'ında çağrılır

  function bellGuncelle() {
    const n = uyariYeniSayisi();
    // Bell ikonu varsa güncelle
    const bell = document.getElementById('bellBtn');
    const bellSayac = document.getElementById('bellSayac');
    const navBadge = document.getElementById('navBadge');
    if (!bell && !bellSayac) return;

    if (n > 0) {
      if (bell) bell.classList.add('uyari-bell-yeni');
      if (bellSayac) { bellSayac.textContent = n; bellSayac.style.display = 'flex'; }
      if (navBadge)  { navBadge.textContent = n; navBadge.style.display = 'flex'; }
    } else {
      if (bell) bell.classList.remove('uyari-bell-yeni');
      if (bellSayac) bellSayac.style.display = 'none';
      if (navBadge)  navBadge.style.display = 'none';
    }
  }

  // ── DÖKÜMANLAR ───────────────────────────────────────────
  // Dökümanlar devre bazlı saklanır: ares_dok_<devreId>
  // Her kayıt: { id, ad, tur, dosyaAdi, uzanti, boyutBytes, base64, tarih, yukleyen }

  function dokumanGetir(devreId) {
    return _get('dok_' + devreId) || [];
  }

  function dokumanEkle(devreId, ad, tur, dosyaAdi, uzanti, boyutBytes, base64, yukleyen) {
    const liste = dokumanGetir(devreId);
    const kayit = {
      id: 'DOK-' + Date.now(),
      ad: ad || dosyaAdi,
      tur: tur || 'Diğer',
      dosyaAdi,
      uzanti,
      boyutBytes,
      base64,
      yukleyen: yukleyen || 'Admin',
      tarih: new Date().toLocaleDateString('tr-TR')
    };
    liste.unshift(kayit);
    _set('dok_' + devreId, liste);
    _log('DOK_EKLE', devreId, ad+' ('+tur+')', 'devre', devreId, {});
    return kayit;
  }

  function dokumanSil(devreId, dokId) {
    const liste = dokumanGetir(devreId).filter(d => d.id !== dokId);
    _set('dok_' + devreId, liste);
    _log('DOK_SIL', devreId, dokId, 'devre', devreId, {});
    return true;
  }

  // ── SIFIRLA (debug) ──────────────────────────────────────
  function sifirla() {
    ['spooller','kkHazir','kkPaketler','sevkHazir','sevkiyatlar','testler',
     'uyarilar','islemLog','sayaclar','durdurulmusDevreler','initialized']
      .forEach(k => _del(k));
    console.log('[SYOS] Store sıfırlandı');
  }

  // ── INIT ────────────────────────────────────────────────
  _init();

  // DOMContentLoaded'da bell durumunu güncelle
  document.addEventListener('DOMContentLoaded', function () {
    bellGuncelle();
  });

  // ── PUBLIC ───────────────────────────────────────────────
  return {
    // Spool
    spoolGetir, spoolGuncelle,
    spoolKKyeGonder, spoolSevkiyataGonder,
    spoolDurdur, spoolDurdurmaKaldir,

    // KK
    kkHazirListesi, kkPaketOlustur, kkPaketleri, kkOnayKaydet,

    // Sevkiyat
    sevkHazirListesi, sevkPaketOlustur, sevkiyatlar,

    // Test
    testler, testOlustur, testSonucKaydet,

    // Uyarı
    uyarilar, uyariEkle, uyariGoruldu, uyariSil, uyariYeniSayisi,

    // Devre durdurma
    devreDurdur, devreninDurumuGetir, devreDurdurmayiKaldir,

    // Log
    islemLogu,

    // UI
    bellGuncelle,

    // Dökümanlar
    dokumanGetir, dokumanEkle, dokumanSil,

    // Debug
    sifirla,
  };

})();
