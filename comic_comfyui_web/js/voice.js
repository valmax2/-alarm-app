import { qs, toast } from "./utils.js";

// Voice dictation for text fields using the browser's Web Speech API
// (SpeechRecognition). Supported on Chrome/Android; falls back to a
// disabled button with an explanatory tooltip where unavailable (e.g. most
// desktop Safari/Firefox).

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

export function initVoiceDictation(textareaId, buttonId, lang = "it-IT") {
  const button = qs(`#${buttonId}`);
  const textarea = qs(`#${textareaId}`);
  if (!button || !textarea) return;

  if (!SpeechRecognitionImpl) {
    button.disabled = true;
    button.title = "Dettatura vocale non supportata da questo browser";
    return;
  }

  const recognition = new SpeechRecognitionImpl();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;

  let listening = false;
  let baseText = "";

  function setListening(isListening) {
    listening = isListening;
    button.classList.toggle("listening", isListening);
    button.textContent = isListening ? "⏹️" : "🎤";
    button.title = isListening ? "Ferma dettatura" : "Detta a voce";
  }

  recognition.addEventListener("result", (evt) => {
    let finalTranscript = "";
    let interimTranscript = "";
    for (let i = evt.resultIndex; i < evt.results.length; i++) {
      const transcript = evt.results[i][0].transcript;
      if (evt.results[i].isFinal) finalTranscript += transcript;
      else interimTranscript += transcript;
    }
    if (finalTranscript) baseText = `${baseText} ${finalTranscript}`.trim();
    textarea.value = `${baseText} ${interimTranscript}`.trim();
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  recognition.addEventListener("end", () => setListening(false));
  recognition.addEventListener("error", (evt) => {
    setListening(false);
    if (evt.error === "no-speech" || evt.error === "aborted") return;
    toast(`Errore dettatura vocale: ${evt.error}`, "error");
  });

  button.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      return;
    }
    baseText = textarea.value;
    try {
      recognition.start();
      setListening(true);
    } catch (err) {
      toast(`Impossibile avviare la dettatura: ${err.message}`, "error");
    }
  });
}
