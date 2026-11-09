/* Match the original navigation's pastel fills, fine brown outlines and tiny faces. */
(()=>{'use strict';
 const drawings={
  '물':'<path d="M16 3C13 9 6 14 6 21a10 10 0 0 0 20 0c0-7-7-12-10-18Z" fill="#d5ebf2"/><path d="M11 14q-3 4-2 7" stroke="#fffdf7" stroke-width="2"/><path d="M12 21v1m8-1v1m-6 3q2 2 4 0"/>',
  '아침':'<path d="M7 12h15v10a7.5 7.5 0 0 1-15 0Z" fill="#e5dcef"/><path d="M22 14h2a4 4 0 0 1 0 8h-2"/><path d="M5 29h21"/><path d="M10 8q-2-2 0-4m5 4q-2-2 0-4m5 4q-2-2 0-4" stroke="#c8aa95"/><path d="M11 19v1m7-1v1m-5 3q1.5 1.5 3 0"/>',
  '점심':'<path d="M4 17h24q-1 11-12 11T4 17Z" fill="#ffd9b8"/><path d="M7 15q0-6 4-6t4 6m-1 0q0-6 4-6t4 6m-13-1q0-3 2-3m6 3q0-3 2-3" stroke="#c5a16b"/><path d="m21 3 3 10m2-11 1 11"/><path d="M11 21v1m10-1v1m-7 2q2 2 4 0"/><path d="M11 29h10"/>',
  '저녁':'<path d="M5 15q-3-6 3-7 0-6 6-3 4-5 7 1 7-1 6 6l-3 6H8Z" fill="#dcebb9"/><path d="M10 9q2 1 3 4m7-5-3 5" stroke="#98ad79"/><circle cx="11" cy="14" r="3" fill="#ffc3aa"/><circle cx="22" cy="13" r="3" fill="#fff0bd"/><path d="M4 17h24q-1 12-12 12T4 17Z" fill="#d4e4c4"/><path d="M11 21v1m10-1v1m-7 2q2 2 4 0"/>',
  '간식':'<path d="M16 10C7 4 2 13 5 22q4 9 11 6 8 3 11-6 4-10-4-13-4-1-7 1Z" fill="#ffd2c1"/><path d="M16 10V5m1 1q3-5 9-3-2 6-9 3Z" fill="#c6dc9b"/><path d="M11 18v1m10-1v1m-7 3q2 2 4 0"/><path d="M8 13q-2 2-1 5" stroke="#fff4e9" stroke-width="2"/>',
  '기타':'<circle cx="16" cy="17" r="11" fill="#fff1da"/><circle cx="16" cy="17" r="7" fill="#fffdf7"/><path d="M12 16v1m8-1v1m-6 3q2 2 4 0"/>'
 };
 function peach(){const source=document.querySelector('.tab[data-view="diary"] svg');const icon=source.cloneNode(true);icon.removeAttribute('style');icon.classList.add('mealDrawing','peachDrawing');icon.setAttribute('aria-hidden','true');icon.setAttribute('focusable','false');return icon;}
 function meal(type){const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 32 32');icon.setAttribute('width','32');icon.setAttribute('height','32');icon.setAttribute('fill','none');icon.setAttribute('stroke','#876750');icon.setAttribute('stroke-width','1.25');icon.setAttribute('stroke-linecap','round');icon.setAttribute('stroke-linejoin','round');icon.setAttribute('aria-hidden','true');icon.setAttribute('focusable','false');icon.classList.add('mealDrawing');icon.innerHTML=drawings[type]||drawings['기타'];return icon;}
 function weight(){const icon=document.querySelector('.tab[data-view="weight"] svg').cloneNode(true);icon.removeAttribute('style');icon.classList.add('mealDrawing');icon.setAttribute('aria-hidden','true');icon.setAttribute('focusable','false');return icon;}
 window.MealLogIcons={peach,meal,weight};
})();
