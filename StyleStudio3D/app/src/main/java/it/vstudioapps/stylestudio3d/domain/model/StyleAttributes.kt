package it.vstudioapps.stylestudio3d.domain.model

import kotlinx.serialization.Serializable

@Serializable
enum class StyleLength(val etichetta: String) {
    RASATO("Rasato"),
    CORTISSIMO("Cortissimo"),
    CORTO("Corto"),
    MEDIO("Medio"),
    LUNGO("Lungo"),
    EXTRA_LUNGO("Extra lungo"),
}

@Serializable
enum class StyleVolume(val etichetta: String) {
    PIATTO("Piatto/aderente"),
    NATURALE("Naturale"),
    VOLUMINOSO("Voluminoso"),
    SCOLPITO("Scolpito/definito"),
}

@Serializable
enum class StyleTexture(val etichetta: String) {
    LISCIO("Liscio"),
    MOSSO("Mosso"),
    RICCIO("Riccio"),
    AFRO("Afro/crespo"),
    TRECCE("Trecce/intrecci"),
}

/**
 * A chi e' pensato principalmente lo stile: un tag orientativo per filtrare/consigliare,
 * mai un vincolo — ogni utente puo' sfogliare e provare qualunque stile di ogni categoria.
 */
@Serializable
enum class TargetAudience(val etichetta: String) {
    FEMMINILE("Tendenzialmente femminile"),
    MASCHILE("Tendenzialmente maschile"),
    UNISEX("Unisex"),
}

/**
 * Parametri generici che descrivono uno stile di capelli/barba/trucco. Non tutti i campi hanno
 * senso per ogni categoria (es. [texture] non si applica al trucco): i renderer e i form li
 * ignorano quando irrilevanti invece di richiederli obbligatoriamente.
 */
@Serializable
data class StyleAttributes(
    val length: StyleLength = StyleLength.MEDIO,
    val volume: StyleVolume = StyleVolume.NATURALE,
    val texture: StyleTexture = StyleTexture.LISCIO,
    val targetAudience: TargetAudience = TargetAudience.UNISEX,
    /** Colore principale in formato "#RRGGBB". */
    val colorHex: String = "#3B2A1F",
    /** Intensita' 0..1: per il trucco e' quanto e' marcato il look; per capelli/barba e' rifinita/spettinata. */
    val intensity: Float = 0.5f,
    /** Tag liberi in linguaggio naturale (es. "undercut", "pompadour", "cat eye smokey"). */
    val tags: List<String> = emptyList(),
)
