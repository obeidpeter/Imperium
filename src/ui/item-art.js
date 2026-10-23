// Original vector kit silhouettes. Shared by pack and equipped lists; no
// external image, image request, or per-item SVG identifier is required.
export function itemArt(item={}){
  const paths={
    weapon:'M18 48 L43 6 L47 8 L25 51Z M14 44 L29 53 M13 54 L19 45',
    shield:'M13 9 Q32 3 51 9 L48 38 Q43 51 32 57 Q20 51 16 38Z M32 14 L32 48 M21 31 L43 31',
    head:'M14 35 L14 25 Q14 7 32 7 Q50 7 50 25 L50 35 L43 35 L43 47 L37 42 L37 30 L27 30 L27 42 L21 47 L21 35Z M18 23 L46 23',
    body:'M23 8 L12 13 L5 29 L15 34 L20 25 L17 54 L47 54 L44 25 L49 34 L59 29 L52 13 L41 8 Q32 19 23 8Z M23 37 L43 37',
    arms:'M20 11 L40 9 L48 48 L28 53Z M22 21 L41 19 M24 31 L44 29 M26 41 L46 39',
    legs:'M19 8 L45 8 L49 53 L36 53 L32 27 L28 53 L15 53Z',
    feet:'M18 11 L34 11 L35 36 L49 44 L48 53 L13 53 L13 43 L18 36Z M20 19 L32 19 M20 26 L32 26',
    belt:'M8 24 L56 24 L56 39 L8 39Z M26 21 L40 21 L40 42 L26 42Z M30 31 L44 31',
    charm:'M21 8 Q7 35 32 48 Q57 35 43 8 M32 40 L41 50 L32 59 L23 50Z',
    other:'M15 15 L49 15 L53 52 L11 52Z M21 15 Q21 4 32 4 Q43 4 43 15 M15 27 L49 27'
  };
  return `<svg class="kit-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="${paths[item.slot]??paths.other}" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
