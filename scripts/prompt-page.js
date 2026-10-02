// Browser code for the free prompt generator page. Runs after prompt-generator.js
// (the build puts that file's code first, so buildPrompt and the PG_* tables exist).
// Nothing typed or chosen here is sent or stored; the only thing recorded is an
// analytics event carrying the three menu choices, and only after the visitor has
// accepted analytics cookies (see analytics.js).
(function () {
  var stageEl = document.getElementById("pg-stage");
  var typeEl = document.getElementById("pg-type");
  var interestEl = document.getElementById("pg-interest");
  var out = document.getElementById("pg-prompt");
  var meta = document.getElementById("pg-meta");
  var btnNew = document.getElementById("pg-new");
  var btnCopy = document.getElementById("pg-copy");
  var status = document.getElementById("pg-status");
  if (!stageEl || !out) return;

  function fill(select, map, anyLabel) {
    if (anyLabel) select.appendChild(new Option(anyLabel, "any"));
    Object.keys(map).forEach(function (k) { select.appendChild(new Option(map[k], k)); });
  }
  fill(stageEl, PG_STAGES);
  fill(typeEl, PG_TYPES, "Any kind of writing");
  fill(interestEl, PG_INTERESTS, "Anything");

  // Links from the guide pages arrive with ?stage=elementary and so on.
  var params = new URLSearchParams(window.location.search);
  [["stage", stageEl, PG_STAGES], ["type", typeEl, PG_TYPES], ["interest", interestEl, PG_INTERESTS]].forEach(function (p) {
    var v = params.get(p[0]);
    if (v && p[2][v]) p[1].value = v;
  });
  if (!params.get("stage")) stageEl.value = "elementary";

  var last = null;
  function generate(track) {
    last = buildPrompt({ stage: stageEl.value, type: typeEl.value, interest: interestEl.value });
    out.textContent = last.prompt;
    meta.textContent = "A good length: " + last.length + ".";
    status.textContent = "";
    if (track && window.llTrack) window.llTrack("prompt_generated", { stage: last.stage, type: last.type, interest: last.interest });
  }

  btnNew.addEventListener("click", function () { generate(true); });
  [stageEl, typeEl, interestEl].forEach(function (el) { el.addEventListener("change", function () { generate(true); }); });

  btnCopy.addEventListener("click", function () {
    if (!last) return;
    function done(ok) { status.textContent = ok ? "Copied. Paste it into a document or straight into LiteracyLab AI." : "Select the prompt above and copy it."; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(last.prompt).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
    if (window.llTrack) window.llTrack("prompt_copied", { stage: last.stage, type: last.type });
  });

  generate(false);
})();
