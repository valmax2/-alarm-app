/* Prompt Director V2.0 — Smart Replacement Dictionary bilingue.
   Le regole più lunghe hanno precedenza. Il controllo viene eseguito
   sia sul testo italiano sia sul prompt inglese finale. */
export const replacements = {
  /* ITALIANO — abbigliamento e scollature */
  'camicia con scollatura profonda':'camicia elegante con scollo a V discreto',
  'camicia con scollatura':'camicia elegante con scollo a V',
  'camicetta con scollatura':'camicetta elegante con scollo a V',
  'blusa con scollatura':'blusa elegante con scollo a V',
  'scollatura profonda':'scollo a V discreto',
  'scollatura generosa':'scollo elegante',
  'scollatura provocante':'scollo elegante',
  'scollatura':'scollo elegante',
  'vestito scollato':'vestito elegante',
  'abito scollato':'abito elegante',
  'camicia scollata':'camicia elegante',
  'camicetta scollata':'camicetta elegante',
  'blusa scollata':'blusa aderente ed elegante',
  'vestito trasparente':'vestito in tessuto leggero ma coprente',
  'camicia trasparente':'camicia in tessuto leggero ma coprente',
  'camicetta trasparente':'camicetta in tessuto leggero ma coprente',
  'senza vestiti':'con abbigliamento elegante',
  'senza abiti':'con abbigliamento elegante',
  'senza veli':'con abbigliamento elegante',
  'svestita':'completamente vestita',
  'svestito':'completamente vestito',
  'nuda':'completamente vestita',
  'nudo':'completamente vestito',
  'topless':'completamente vestita',

  /* ITALIANO — descrizioni */
  'seno molto grande':'silhouette femminile naturale',
  'seno grande':'silhouette femminile naturale',
  'seno generoso':'figura elegante',
  'bel seno':'proporzioni eleganti',
  'seni grandi':'silhouette femminile naturale',
  'seni generosi':'figura elegante',
  'seno':'parte superiore del corpo',
  'sensuale espressione':'espressione sicura e calorosa',
  'espressione sensuale':'espressione sicura e calorosa',
  'sguardo seducente':'sguardo dolce e sicuro',
  'sorriso seducente':'sorriso affascinante',
  'posa provocante':'posa sicura',
  'posa seducente':'posa elegante',
  'posa sexy':'posa da moda',
  'molto sexy':'glamour ed elegante',
  'sexy':'elegante',
  'sensuale':'sicura e affascinante',
  'seducente':'affascinante',
  'provocante':'elegante',
  'erotica':'artistica ed elegante',
  'erotico':'artistico ed elegante',

  /* ITALIANO — azioni */
  'solleva la gonna':'tiene naturalmente i lati della gonna',
  'alzare la gonna':'tenere naturalmente i lati della gonna',
  'alza la gonna':'tiene naturalmente i lati della gonna',
  'mostra la biancheria':'indossa un abbigliamento sobrio',
  'gambe divaricate':'posizione rilassata e naturale',
  'tocca il seno':'mani vicino alla parte superiore del busto',
  'tocca il sedere':'mani lungo i fianchi',

  /* ENGLISH — body emphasis */
  'beautiful generous breasts':'elegant V-neckline',
  'large breasts':'feminine silhouette',
  'big breasts':'natural feminine silhouette',
  'huge breasts':'elegant feminine figure',
  'perfect breasts':'elegant proportions',
  'voluptuous breasts':'graceful figure',
  'deep cleavage':'tasteful V-neckline',
  'revealing cleavage':'elegant V-neck blouse',
  'plunging neckline':'tasteful V-neckline',
  'low-cut neckline':'elegant neckline',
  'low cut blouse':'fitted elegant blouse',
  'cleavage':'elegant neckline',
  'busty':'elegant figure',
  'boobs':'upper body',
  'breasts':'upper body',

  /* ENGLISH — descriptions */
  'extremely sexy':'glamorous',
  'super hot':'beautiful',
  'sexy':'elegant',
  'hot':'attractive',
  'provocative':'stylish',
  'erotic':'artistic and elegant',
  'lustful':'confident',
  'horny':'excited',
  'aroused':'emotionally engaged',
  'sensual expression':'confident, warm expression',
  'seductive smile':'charming smile',
  'flirty look':'friendly gaze',
  'bedroom eyes':'soft gaze',
  'seductive':'charming',
  'tempting':'graceful',
  'sensual':'confident',

  /* ENGLISH — poses/clothing */
  'provocative pose':'confident pose',
  'seductive pose':'elegant pose',
  'sexual pose':'fashion pose',
  'pin-up pose':'glamour pose',
  'legs spread':'relaxed stance',
  'arching back seductively':'graceful posture',
  'revealing dress':'elegant dress',
  'revealing blouse':'fitted blouse',
  'tiny skirt':'short skirt',
  'micro skirt':'stylish mini skirt',
  'transparent clothes':'lightweight, opaque fabric',
  'transparent blouse':'lightweight, opaque blouse',
  'see-through shirt':'lightweight, opaque blouse',
  'lingerie':'elegant nightwear',
  'bra visible':'layered clothing',

  /* ENGLISH — nudity/body parts/actions */
  'without clothes':'wearing elegant clothing',
  'remove clothes':'adjust clothing',
  'bottomless':'fully dressed',
  'topless':'fully dressed',
  'completely naked':'fully dressed',
  'naked':'fully dressed',
  'nude':'fully dressed artistic figure',
  'undress':'change outfit',
  'strip':'change clothes',
  'nipples':'upper body',
  'underboob':'blouse',
  'sideboob':'blouse',
  'cameltoe':'clothing',
  'genitals':'clothing',
  'groin':'waist area',
  'crotch':'waist area',
  'booty':'silhouette',
  'butt':'lower body',
  'ass':'lower body',
  'lift skirt':'hold skirt naturally',
  'raise skirt':'gently hold the skirt',
  'spread legs':'relaxed standing pose',
  'show underwear':'modest outfit',
  'remove bra':'elegant outfit',
  'touch breasts':'hands near upper torso',
  'touch butt':'hands at sides'
};

const esc = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ordered = Object.entries(replacements).sort((a,b)=>b[0].length-a[0].length);

export function sanitize(text='') {
  let out = String(text);
  const changes = [];
  for (const [from,to] of ordered) {
    /* Lookaround evita sostituzioni dentro altre parole ed è più affidabile di \b con apostrofi/accenti. */
    const rx = new RegExp(`(?<![\\p{L}\\p{N}])${esc(from)}(?![\\p{L}\\p{N}])`, 'giu');
    let count = 0;
    out = out.replace(rx, match => { count++; return preserveCase(match,to); });
    if (count) changes.push({from,to,count});
  }
  return {out,changes};
}

export function sanitizeFinalPrompt(text='') {
  /* Secondo passaggio intenzionale: una traduzione può reintrodurre un termine inglese. */
  const first = sanitize(text);
  const second = sanitize(first.out);
  return {out:second.out,changes:[...first.changes,...second.changes]};
}

function preserveCase(src,to){
  return src && src[0]===src[0].toUpperCase() ? to[0].toUpperCase()+to.slice(1) : to;
}

export const safePositive=['beautiful','elegant','graceful','stylish','fashionable','professional','photorealistic','cinematic','realistic','soft lighting','natural lighting','glamorous','confident','warm','friendly','kind','charming','cute','smiling','looking at camera','hands on hips','rule of thirds','dynamic composition','butterfly lighting','highly detailed','sharp focus','professional illustration','4K','8K','HDR','Ultra HD','masterpiece','best quality','high quality','full body','medium shot','close-up','portrait','front view','side view','back view','high angle','low angle','eye level','three-quarter view','head-to-toe fully visible','maintain exact facial features','maintain hairstyle','maintain eye color','maintain skin tone','maintain body proportions','maintain character consistency'];
