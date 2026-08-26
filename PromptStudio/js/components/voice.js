// ==========================================================================
// voice.js — dictation helper for text fields.
//
// Per spec: the microphone is ONLY for dictating into text fields, never a
// separate voice-assistant. attachDictation() wires a 🎙 button to the Web
// Speech API (when available) and appends recognized text into the target
// input/textarea.
// ==========================================================================

const SpeechRecognitionImpl =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

export function isDictationSupported() {
  return !!SpeechRecognitionImpl;
}

/**
 * Wires a mic button to dictate into `inputEl`.
 * @param {HTMLElement} micBtn
 * @param {HTMLInputElement|HTMLTextAreaElement} inputEl
 * @param {(value:string)=>void} [onChange] called after text is inserted
 */
export function attachDictation(micBtn, inputEl, onChange) {
  if (!SpeechRecognitionImpl) {
    micBtn.disabled = true;
    micBtn.title = "Dettatura non supportata su questo browser";
    return;
  }
  let recognition = null;
  let listening = false;

  micBtn.title = "Detta";
  micBtn.addEventListener("click", () => {
    if (listening) {
      recognition && recognition.stop();
      return;
    }
    recognition = new SpeechRecognitionImpl();
    recognition.lang = "it-IT";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      listening = true;
      micBtn.classList.add("listening");
    };
    recognition.onend = () => {
      listening = false;
      micBtn.classList.remove("listening");
    };
    recognition.onerror = () => {
      listening = false;
      micBtn.classList.remove("listening");
    };
    recognition.onresult = (evt) => {
      const text = Array.from(evt.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (!text) return;
      const sep = inputEl.value && !inputEl.value.endsWith(" ") ? " " : "";
      inputEl.value = (inputEl.value + sep + text).trim();
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      onChange && onChange(inputEl.value);
    };

    try {
      recognition.start();
    } catch (e) {
      console.warn("speech recognition failed to start", e);
    }
  });
}

/** Builds a standard "🎙 detta / 🗑 cancella" row next to a text input. */
export function buildDictationRow(inputEl, onChange) {
  const row = document.createElement("div");
  row.className = "text-field-row";

  const mic = document.createElement("button");
  mic.type = "button";
  mic.className = "mic-btn";
  mic.textContent = "🎙";
  mic.setAttribute("aria-label", "Detta");

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "clear-btn";
  clear.textContent = "🗑";
  clear.title = "Cancella campo";
  clear.setAttribute("aria-label", "Cancella campo");

  row.appendChild(inputEl);
  row.appendChild(mic);
  row.appendChild(clear);

  attachDictation(mic, inputEl, onChange);
  clear.addEventListener("click", () => {
    inputEl.value = "";
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    onChange && onChange("");
    inputEl.focus();
  });

  return row;
}
