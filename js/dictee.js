// Dictée vocale (reconnaissance de la parole du navigateur, en français).
// Chrome sur Android et PC, Safari sur iPhone.

let reco = null;

export function disponible() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function ecouter(dotnet) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) return false;
  arreter();
  reco = new R();
  reco.lang = 'fr-FR';
  reco.interimResults = true;
  reco.continuous = false;
  reco.onresult = ev => {
    let texte = '';
    let fini = false;
    for (const r of ev.results) { texte += r[0].transcript; fini = r.isFinal; }
    dotnet.invokeMethodAsync('Dictee', texte, fini);
  };
  reco.onerror = ev => dotnet.invokeMethodAsync('DicteeErreur', ev.error);
  reco.onend = () => dotnet.invokeMethodAsync('DicteeFin');
  reco.start();
  return true;
}

export function arreter() {
  try { reco?.stop(); } catch { /* déjà arrêtée */ }
  reco = null;
}
