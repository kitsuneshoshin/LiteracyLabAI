// Header behaviour shared by the guide pages: theme toggle and phone menu.
(function(){var r=document.documentElement,b=document.querySelectorAll('.theme-toggle'),ic=document.querySelectorAll('.theme-icon');
var SUN='<path d="M12 2.5v2.3M12 19.2v2.3M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.4 19.6L6 18M18 6l1.6-1.6"/><circle cx="12" cy="12" r="4.2"/>',MOON='<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',cur='system';
function ap(m){if(m==='system')r.removeAttribute('data-theme');else r.setAttribute('data-theme',m);var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);ic.forEach(function(i){i.innerHTML=d?SUN:MOON;});}
ap(cur);b.forEach(function(x){x.addEventListener('click',function(){cur=cur==='system'?'dark':cur==='dark'?'light':'system';ap(cur);});});
var t=document.getElementById('navMenuToggle'),l=document.getElementById('navLinks');
if(t&&l){t.addEventListener('click',function(){var o=l.classList.toggle('open');t.setAttribute('aria-expanded',o?'true':'false');});l.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){l.classList.remove('open');t.setAttribute('aria-expanded','false');});});}
})();
