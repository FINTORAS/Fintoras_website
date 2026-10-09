/* FINTORAS site behaviour. No dependencies. */
(function () {
  "use strict";

  var PREVIEW = false; // true only in the review copy, where forms have nowhere to post
  var root = document.documentElement;

  /* ---------- theme ---------- */
  var themeBtn = document.querySelector("[data-theme-toggle]");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("fintoras-theme", next); } catch (e) { /* preference just won't persist */ }
    });
  }

  /* ---------- small-screen menu ---------- */
  var menuBtn = document.querySelector("[data-menu]");
  var nav = document.getElementById("site-nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
  }

  /* ---------- waitlist dialog ---------- */
  var sheet = document.getElementById("waitlist");
  document.querySelectorAll("[data-open='waitlist']").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      if (!sheet || typeof sheet.showModal !== "function") return; // falls through to the link's href
      e.preventDefault();
      sheet.showModal();
      var first = sheet.querySelector("input:not([type='hidden']):not(.hp input)");
      if (first) first.focus();
    });
  });
  if (sheet) {
    sheet.addEventListener("click", function (e) {
      if (e.target === sheet || e.target.closest("[data-close]")) sheet.close();
    });
  }

  /* ---------- forms (Netlify Forms) ---------- */
  document.querySelectorAll("form[data-netlify]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector(".form-status");
      var btn = form.querySelector("[type='submit']");
      var label = btn.textContent;
      var emailField = form.querySelector("input[type='email']");
      var email = emailField ? emailField.value : "";
      btn.disabled = true;
      btn.textContent = "Sending…";

      var send = PREVIEW
        ? Promise.resolve()
        : fetch("/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(new FormData(form)).toString()
          }).then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); });

      send.then(function () {
        form.reset();
        status.className = "form-status ok";
        status.textContent = (form.getAttribute("data-ok") || "Sent.").replace("{email}", email) +
          (PREVIEW ? " (Preview only: nothing was sent.)" : "");
      }).catch(function () {
        status.className = "form-status err";
        status.textContent = "That didn't send. Check your connection and try again, or email hello@fintoras.com.";
      }).then(function () {
        status.hidden = false;
        btn.disabled = false;
        btn.textContent = label;
      });
    });
  });

  /* ---------- hero: pick a sample project ---------- */
  var picks = document.querySelectorAll(".pick");
  function selectProject(id) {
    picks.forEach(function (p) { p.setAttribute("aria-pressed", String(p.getAttribute("data-p") === id)); });
    document.querySelectorAll(".col[data-p]").forEach(function (c) { c.classList.toggle("sel", c.getAttribute("data-p") === id); });
    document.querySelectorAll("[data-readout]").forEach(function (r) { r.hidden = r.getAttribute("data-readout") !== id; });
  }
  document.querySelectorAll("[data-p]").forEach(function (el) {
    el.addEventListener("click", function () { selectProject(el.getAttribute("data-p")); });
  });

  /* ---------- project maths (shared by both calculators) ---------- */
  function projectMath(v) {
    var pct = Math.min(Math.max(v.complete || 100, 1), 100) / 100;
    var projectedHours = v.logged / pct;
    var projectedCost = projectedHours * v.rate + v.other;
    var profit = v.fee - projectedCost;
    var margin = v.fee > 0 ? (profit / v.fee) * 100 : 0;
    var breakEvenHours = v.rate > 0 ? Math.max(0, (v.fee - v.other) / v.rate) : 0;
    var plannedCost = (v.planned || 0) * v.rate + v.other;
    var plannedMargin = v.fee > 0 ? ((v.fee - plannedCost) / v.fee) * 100 : 0;
    return {
      costToDate: v.logged * v.rate + v.other,
      projectedHours: projectedHours,
      projectedCost: projectedCost,
      profit: profit,
      margin: margin,
      breakEvenHours: breakEvenHours,
      hoursLeft: breakEvenHours - v.logged,
      plannedMargin: plannedMargin
    };
  }
  window.fintorasProjectMath = projectMath;

  var money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  var whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  function signedMoney(n) { return (n < 0 ? "−" : "+") + money.format(Math.abs(Math.round(n))); }
  function signedPct(n) { return (n < 0 ? "−" : "+") + Math.abs(n).toFixed(1) + "%"; }

  document.querySelectorAll("[data-calc]").forEach(function (calc) {
    var full = calc.getAttribute("data-calc") === "full";
    function val(name) {
      var el = calc.querySelector("[name='" + name + "']");
      var n = el ? parseFloat(el.value) : NaN;
      return isFinite(n) && n >= 0 ? n : 0;
    }
    function out(name, text) {
      var el = calc.querySelector("[data-out='" + name + "']");
      if (el) el.textContent = text;
    }
    function update() {
      var v = { fee: val("fee"), logged: val("logged"), rate: val("rate"), other: val("other"),
                planned: full ? val("planned") : 0, complete: full ? val("complete") || 100 : 100 };
      var r = projectMath(v);
      var big = calc.querySelector("[data-out='margin']");
      big.textContent = signedPct(r.margin);
      big.className = "big " + (r.margin < 0 ? "down" : "up");
      out("profit", signedMoney(r.profit));
      out("cost", money.format(Math.round(r.projectedCost)));
      out("breakeven", whole.format(Math.floor(r.breakEvenHours)) + " h");
      if (full) {
        out("costToDate", money.format(Math.round(r.costToDate)));
        out("projectedHours", whole.format(Math.round(r.projectedHours)) + " h");
        out("plannedMargin", signedPct(r.plannedMargin));
      }
      var share = Math.min(Math.abs(r.margin), 60) / 60 * 50;
      calc.querySelector(".m-up").style.height = (r.margin >= 0 ? share : 0) + "%";
      calc.querySelector(".m-down").style.height = (r.margin < 0 ? share : 0) + "%";

      var left = Math.floor(r.hoursLeft);
      var toGo = Math.round(r.projectedHours - v.logged);            // hours of work still to do
      var slack = Math.floor(r.breakEvenHours - r.projectedHours);   // hours spare once the job is done
      var verdict;
      if (v.fee <= 0 || v.rate <= 0) {
        verdict = "Enter a fee and a cost per hour to see the margin.";
      } else if (r.margin < 0 && left < 0) {
        verdict = "This project is already past break-even. It used up its margin at " +
          whole.format(Math.floor(r.breakEvenHours)) + " hours, " + whole.format(-left) + " hours ago.";
      } else if (r.margin < 0) {
        verdict = "On this pace the project loses " + money.format(Math.abs(Math.round(r.profit))) +
          ". It needs about " + whole.format(toGo) + " more hours, and the margin runs out after " + whole.format(left) + ".";
      } else if (r.margin < 15) {
        verdict = toGo > 0
          ? "Thin. The job needs about " + whole.format(toGo) + " more hours, which leaves only " + whole.format(Math.max(slack, 0)) + " hours of slack before break-even."
          : "Thin. " + whole.format(Math.max(left, 0)) + " more hours and the margin is gone.";
      } else {
        verdict = toGo > 0
          ? "Healthy. The job needs about " + whole.format(toGo) + " more hours, which leaves " + whole.format(slack) + " hours of slack before break-even."
          : "Healthy. You have " + whole.format(left) + " hours of room before break-even.";
      }
      out("verdict", verdict);
    }
    calc.addEventListener("input", update);
    calc.addEventListener("submit", function (e) { e.preventDefault(); });
    update();
  });

  /* ---------- pricing: billing period and plan picker ---------- */
  var billBtns = document.querySelectorAll("[data-bill]");
  billBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var mode = btn.getAttribute("data-bill");
      billBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      document.querySelectorAll("[data-monthly]").forEach(function (el) {
        el.textContent = el.getAttribute("data-" + mode);
      });
    });
  });
  var teamSize = document.getElementById("team-size");
  var planOut = document.getElementById("plan-out");
  if (teamSize && planOut) {
    var suggest = function () {
      var n = parseInt(teamSize.value, 10);
      var plan, why;
      if (!n || n < 1) { planOut.textContent = "Enter your team size."; plan = ""; }
      else if (n <= 5) { plan = "starter"; why = "Starter covers up to 5 people and 10 active projects."; }
      else if (n <= 20) { plan = "professional"; why = "Professional covers up to 20 people with unlimited projects."; }
      else { plan = "enterprise"; why = "Enterprise is for more than 20 people. We'll price it with you."; }
      if (plan) planOut.textContent = why;
      document.querySelectorAll(".tier").forEach(function (t) {
        t.classList.toggle("pick-me", t.getAttribute("data-plan") === plan);
      });
    };
    teamSize.addEventListener("input", suggest);
    suggest();
  }

  /* ---------- blog: topic filter and search ---------- */
  var notes = document.querySelectorAll(".note");
  if (notes.length) {
    var catBtns = document.querySelectorAll("[data-cat-filter]");
    var search = document.getElementById("note-search");
    var count = document.getElementById("note-count");
    var empty = document.getElementById("note-empty");
    var cat = "all";
    var apply = function () {
      var q = search ? search.value.trim().toLowerCase() : "";
      var shown = 0;
      notes.forEach(function (n) {
        var ok = (cat === "all" || n.getAttribute("data-cat") === cat) &&
                 (!q || n.textContent.toLowerCase().indexOf(q) !== -1);
        n.hidden = !ok;
        if (ok) shown++;
      });
      if (count) count.textContent = "Showing " + shown + " of " + notes.length + " notes";
      if (empty) empty.hidden = shown !== 0;
    };
    catBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        cat = b.getAttribute("data-cat-filter");
        catBtns.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        apply();
      });
    });
    if (search) search.addEventListener("input", apply);
    apply();
  }
})();
