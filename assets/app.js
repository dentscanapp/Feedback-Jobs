/* ===================================================================
   Feedback Jobs — shared application script
   Loaded on every page AFTER assets/i18n.js (+ optional page dicts).
   Injects shared chrome (cookie banner, floating buttons, callback
   modal), wires language switching, header, reveal, and forms.
   =================================================================== */
(function(){
  "use strict";

  var PHONE_DISPLAY = "+40 752 607 245";
  var PHONE_TEL     = "+40752607245";
  var WA_NUMBER     = "40752607245";
  var I18N = window.I18N || {};

  /* ---------- tiny helpers ---------- */
  function el(html){ var t=document.createElement("template"); t.innerHTML=html.trim(); return t.content.firstChild; }
  function $(s,c){ return (c||document).querySelector(s); }
  function $$(s,c){ return Array.prototype.slice.call((c||document).querySelectorAll(s)); }
  function store(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }

  /* =================================================================
     Language
     ================================================================= */
  function applyLang(lang){
    var dict = I18N[lang] || I18N.en || {};
    document.documentElement.lang = lang;
    $$("[data-i18n]").forEach(function(node){
      var k = node.getAttribute("data-i18n");
      if(dict[k]==null) return;
      if(/<[a-z]/i.test(dict[k])) node.innerHTML = dict[k]; else node.textContent = dict[k];
    });
    $$("[data-i18n-html]").forEach(function(node){
      var k = node.getAttribute("data-i18n-html");
      if(dict[k]!=null) node.innerHTML = dict[k];
    });
    $$("[data-i18n-ph]").forEach(function(node){
      var k = node.getAttribute("data-i18n-ph");
      if(dict[k]!=null) node.setAttribute("placeholder", dict[k]);
    });
    $$("[data-i18n-aria]").forEach(function(node){
      var k = node.getAttribute("data-i18n-aria");
      if(dict[k]!=null) node.setAttribute("aria-label", dict[k].replace(/<[^>]+>/g,""));
    });
    $$("#lang button, .lang button").forEach(function(b){ b.classList.toggle("active", b.dataset.lang===lang); });
    store("fbj_lang", lang);
    document.dispatchEvent(new CustomEvent("fbj:lang", {detail:{lang:lang}}));
  }
  window.fbjApplyLang = applyLang;

  function initLang(){
    var saved = store("fbj_lang");
    var nav = (navigator.language||"en").slice(0,2);
    var lang = saved || (I18N[nav] ? nav : "hu");
    applyLang(lang);
  }

  /* =================================================================
     Header + mobile menu
     ================================================================= */
  function wireHeader(){
    var hdr = $("#hdr");
    if(hdr){
      window.addEventListener("scroll", function(){ hdr.classList.toggle("scrolled", window.scrollY>10); }, {passive:true});
    }
    var burger = $("#burger"), mm = $("#mobileMenu");
    if(burger && mm){
      burger.addEventListener("click", function(){
        var open = !mm.classList.contains("open");
        burger.classList.toggle("open", open);
        mm.classList.toggle("open", open);
        document.body.classList.toggle("menu-open", open);
      });
      $$("a", mm).forEach(function(a){ a.addEventListener("click", function(){
        burger.classList.remove("open"); mm.classList.remove("open"); document.body.classList.remove("menu-open");
      }); });
    }
    // language switch (event delegation works for header + mobile)
    $$(".lang").forEach(function(group){
      group.addEventListener("click", function(e){
        var b = e.target.closest("button"); if(!b) return;
        applyLang(b.dataset.lang);
      });
    });
  }

  /* =================================================================
     Reveal on scroll
     ================================================================= */
  function wireReveal(){
    var els = $$(".reveal");
    if(!("IntersectionObserver" in window) || !els.length){ els.forEach(function(e){ e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); } });
    }, {threshold:.12, rootMargin:"0px 0px -40px 0px"});
    els.forEach(function(e,i){ e.style.transitionDelay = (i%4*60)+"ms"; io.observe(e); });
  }

  /* =================================================================
     Floating action buttons (WhatsApp / call / callback)
     ================================================================= */
  var ICON = {
    wa:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M.06 24l1.69-6.16A11.87 11.87 0 0 1 .16 11.9C.16 5.34 5.5 0 12.06 0a11.82 11.82 0 0 1 8.41 3.49 11.82 11.82 0 0 1 3.48 8.42c0 6.56-5.34 11.9-11.9 11.9a11.9 11.9 0 0 1-5.69-1.45L.06 24zM6.6 20.13l.36.21a9.88 9.88 0 0 0 5.03 1.38h.01c5.45 0 9.89-4.43 9.89-9.88a9.82 9.82 0 0 0-2.9-7A9.82 9.82 0 0 0 12.06 2C6.6 2 2.17 6.43 2.17 11.88c0 1.87.52 3.69 1.51 5.27l.24.38-1 3.65 3.68-1.05zm10.96-5.66c-.07-.12-.27-.2-.57-.35-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41z"/></svg>',
    call:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    cb:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  };
  function injectFabs(){
    var stack = el(
      '<div class="fab-stack" aria-label="Quick contact">'+
        '<a class="fab wa" href="https://wa.me/'+WA_NUMBER+'" target="_blank" rel="noopener" data-i18n-aria="fab_whatsapp">'+
          '<span class="fab-ico">'+ICON.wa+'</span><span class="fab-txt" data-i18n="fab_whatsapp">WhatsApp</span></a>'+
        '<a class="fab call" href="tel:'+PHONE_TEL+'" data-i18n-aria="fab_call">'+
          '<span class="fab-ico">'+ICON.call+'</span><span class="fab-txt" data-i18n="fab_call">Call us</span></a>'+
        '<button class="fab cb" type="button" id="cbOpen" data-i18n-aria="fab_callback">'+
          '<span class="fab-ico">'+ICON.cb+'</span><span class="fab-txt" data-i18n="fab_callback">Callback</span></button>'+
      '</div>');
    document.body.appendChild(stack);
  }

  /* =================================================================
     Cookie consent banner
     ================================================================= */
  function injectCookie(){
    if(store("fbj_cookie")) return; // already decided
    var banner = el(
      '<div class="cookie" role="dialog" aria-label="Cookie consent">'+
        '<h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="14" cy="13" r="1" fill="currentColor"/><circle cx="9.5" cy="15" r="1" fill="currentColor"/></svg>'+
          '<span data-i18n="cookie_title">We use cookies</span></h4>'+
        '<p data-i18n="cookie_text"></p>'+
        '<div class="cookie-actions">'+
          '<button class="btn btn-primary" type="button" data-cookie="accept" data-i18n="cookie_accept">Accept</button>'+
          '<button class="btn btn-mini" type="button" data-cookie="necessary" data-i18n="cookie_reject">Only necessary</button>'+
        '</div>'+
      '</div>');
    document.body.appendChild(banner);
    setTimeout(function(){ banner.classList.add("show"); }, 650);
    banner.addEventListener("click", function(e){
      var b = e.target.closest("[data-cookie]"); if(!b) return;
      store("fbj_cookie", b.getAttribute("data-cookie"));
      banner.classList.remove("show");
      setTimeout(function(){ banner.remove(); }, 500);
    });
  }

  /* =================================================================
     Callback modal (date + time-slot picker)
     ================================================================= */
  function injectCallback(){
    var overlay = el(
      '<div class="modal-overlay" id="cbOverlay">'+
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="cbTitle">'+
          '<button class="modal-close" type="button" id="cbClose" aria-label="Close">'+
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'+
          '<div class="m-ico">'+ICON.cb+'</div>'+
          '<h3 id="cbTitle" data-i18n="cb_title">Request a callback</h3>'+
          '<p class="m-sub" data-i18n="cb_sub"></p>'+
          '<form id="cbForm" novalidate>'+
            '<div class="row2">'+
              '<div class="field"><label data-i18n="cb_name">Name</label>'+
                '<input type="text" name="name" data-i18n-ph="cb_ph_name" required></div>'+
              '<div class="field"><label data-i18n="cb_phone">Phone</label>'+
                '<input type="tel" name="phone" placeholder="+40 ..." required></div>'+
            '</div>'+
            '<div class="field"><label data-i18n="cb_date">Which day?</label>'+
              '<input type="date" name="date" required></div>'+
            '<div class="field"><label data-i18n="cb_time">Best time?</label>'+
              '<div class="slots">'+
                '<label class="slot"><input type="radio" name="slot" value="morning" checked>'+
                  '<span><b data-i18n="slot_morning">Morning</b><small data-i18n="slot_morning_t">9–12</small></span></label>'+
                '<label class="slot"><input type="radio" name="slot" value="midday">'+
                  '<span><b data-i18n="slot_midday">Midday</b><small data-i18n="slot_midday_t">12–15</small></span></label>'+
                '<label class="slot"><input type="radio" name="slot" value="afternoon">'+
                  '<span><b data-i18n="slot_afternoon">Afternoon</b><small data-i18n="slot_afternoon_t">15–18</small></span></label>'+
              '</div>'+
            '</div>'+
            '<label class="consent"><input type="checkbox" name="consent" required>'+
              '<span data-i18n="cb_consent"></span></label>'+
            '<button type="submit" class="btn btn-primary" data-i18n="cb_submit">Request callback</button>'+
          '</form>'+
          '<div class="form-ok" id="cbOk">'+
            '<div class="ok-ring"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg></div>'+
            '<h3 data-i18n="cb_ok_title">Thank you!</h3>'+
            '<p data-i18n="cb_ok_text"></p>'+
            '<button class="btn btn-ghost" type="button" id="cbOkClose" style="margin-top:22px" data-i18n="cb_ok_close">Close</button>'+
          '</div>'+
        '</div>'+
      '</div>');
    document.body.appendChild(overlay);

    var form = $("#cbForm", overlay), ok = $("#cbOk", overlay);
    var dateInput = form.querySelector('input[name="date"]');
    var today = new Date(); today.setDate(today.getDate());
    dateInput.min = today.toISOString().slice(0,10);

    function open(){
      form.style.display=""; ok.classList.remove("show");
      overlay.classList.add("open"); document.body.classList.add("modal-open");
      setTimeout(function(){ form.querySelector('input[name="name"]').focus(); }, 60);
    }
    function close(){ overlay.classList.remove("open"); document.body.classList.remove("modal-open"); }

    document.addEventListener("click", function(e){ if(e.target.closest("#cbOpen") || e.target.closest("[data-cb-open]")){ e.preventDefault(); open(); } });
    $("#cbClose", overlay).addEventListener("click", close);
    $("#cbOkClose", overlay).addEventListener("click", close);
    overlay.addEventListener("click", function(e){ if(e.target===overlay) close(); });
    document.addEventListener("keydown", function(e){ if(e.key==="Escape" && overlay.classList.contains("open")) close(); });

    form.addEventListener("submit", function(e){
      e.preventDefault();
      if(!form.checkValidity()){ form.reportValidity(); return; }
      var lang = document.documentElement.lang || "hu";
      var slotKey = form.slot.value;
      var slotTxt = (I18N[lang] && I18N[lang]["slot_"+slotKey]) || slotKey;
      var btn = form.querySelector('button[type="submit"]');
      var orig = btn.textContent;
      btn.disabled = true; btn.style.opacity=".7";
      btn.textContent = (I18N[lang] && I18N[lang].cb_sending) || "Sending...";
      var payload = {
        role:"callback", type:"callback",
        name: form.name.value, phone: form.phone.value, email:"",
        message: "[CALLBACK] "+form.date.value+" · "+slotTxt+" ("+form.slot.value+") · "+lang.toUpperCase()
      };
      fetch("https://resend.feedbackjobs.com", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)
      }).then(function(res){
        if(res.ok){ form.style.display="none"; ok.classList.add("show"); form.reset(); dateInput.min = today.toISOString().slice(0,10); }
        else { alert(errMsg(lang)); }
      }).catch(function(){ alert(errMsg(lang)); })
      .finally(function(){ btn.disabled=false; btn.style.opacity="1"; btn.textContent=orig; });
    });
  }

  function errMsg(t){
    return t==="hu" ? "Hiba történt. Kérjük írj nekünk közvetlenül: contact@feedbackjobs.com" :
           t==="de" ? "Ein Fehler ist aufgetreten. Bitte schreiben Sie an contact@feedbackjobs.com" :
           t==="ro" ? "A apărut o eroare. Scrieți-ne la contact@feedbackjobs.com" :
                      "An error occurred. Please contact us at contact@feedbackjobs.com";
  }
  function okMsg(t){
    return t==="hu" ? "Üzenet sikeresen elküldve! Hamarosan felvesszük veled a kapcsolatot." :
           t==="de" ? "Nachricht erfolgreich gesendet!" :
           t==="ro" ? "Mesaj trimis cu succes!" : "Message sent successfully!";
  }

  /* =================================================================
     Contact form (only on pages that have it)
     ================================================================= */
  function wireContact(){
    var f = $("#contactForm"); if(!f) return;
    f.addEventListener("submit", function(e){
      e.preventDefault();
      if(!f.checkValidity()){ f.reportValidity(); return; }
      var lang = document.documentElement.lang || "hu";
      var btn = f.querySelector('button[type="submit"]');
      var orig = btn.innerHTML;
      btn.disabled = true; btn.style.opacity=".7";
      fetch("https://resend.feedbackjobs.com", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          role: f.role.value, name: f.name.value, email: f.email.value,
          phone: f.phone.value, message: f.message.value
        })
      }).then(function(res){
        if(res.ok){ alert(okMsg(lang)); f.reset(); } else { alert(errMsg(lang)); }
      }).catch(function(){ alert(errMsg(lang)); })
      .finally(function(){ btn.disabled=false; btn.style.opacity="1"; btn.innerHTML=orig; });
    });
  }

  /* =================================================================
     Boot
     ================================================================= */
  function boot(){
    injectFabs();
    injectCallback();
    injectCookie();
    wireHeader();
    wireReveal();
    wireContact();
    var y = $("#year"); if(y) y.textContent = new Date().getFullYear();
    initLang(); // run last so injected chrome gets translated too
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
