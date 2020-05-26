// ==UserScript==
// @name          Piano Marvel Enhancements
// @namespace     http://yo1.dog
// @version       4.1.0
// @description   Adds enhancements to painomarvel.com (@@@APP_TYPE@@@)
// @author        Mike "yo1dog" Moore
// @homepageURL   https://github.com/yo1dog/piano-marvel-enhancements#readme
// @icon          https://github.com/yo1dog/piano-marvel-enhancements/raw/master/icon.ico
// @match         *://pianomarvel.com/nextgen/*
// @run-at        document-start
// @resource      jzzResource ../lib/JZZ.js?v=1
// @resource      styleResource ../app/style.css?v=1
// @grant         GM.getResourceURL
// @grant         GM.getResourceUrl
// ==/UserScript==


console.log('yo1dog-pme: Piano Marvel Enhancements loaded');

(async () => {
  // inject a script tag that contains the AMD app
  const script = window.document.createElement('script');
  script.textContent = `(${amdApp})().catch(err => console.error('yo1dog-pme:', err));`;
  document.head.prepend(script);
  
  const jzzUrl = await (GM.getResourceUrl || GM.getResourceURL)('jzzResource');
  const jzzUrlMeta = document.createElement('meta');
  jzzUrlMeta.id = 'yo1dog-pme-jzz-url';
  jzzUrlMeta.content = jzzUrl;
  document.head.appendChild(jzzUrlMeta);
  
  // inject CSS
  // There is some wierd bug with Violentmonkey on Chrome in which CSS is loaded but not applied
  // after the user script is updated. So instead of injecting a <link href="..."> we manually
  // fetch the CSS and inject it into a <style>
  const styleUrl = await (GM.getResourceUrl || GM.getResourceURL)('styleResource');
  const req = await fetch(styleUrl);
  if (!req.ok) throw new Error(`Failed to load CSS: ${req.status}`);
  const css = await req.text();
  
  const styleElem = document.createElement('style');
  styleElem.type = 'text/css';
  styleElem.textContent = css;
  document.head.appendChild(styleElem);
})().catch(err => console.error('yo1dog-pme:', err));

