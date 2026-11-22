#!/usr/bin/env python3
"""
Arletex Specialist Models Microservice
Provides local, isolated HTTP inference for:
1. EmbeddingGemma 300M (Semantic memory embeddings)
2. Whisper Small (Voice input transcription)
3. Kokoro 82M (Voice speech synthesis)
"""

import sys
import os
import json
import base64
import tempfile
import io
import wave
import re
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from typing import Optional, Dict, Any

# Paths to models
BASE_MODELS_DIR = os.getenv("ARLETEX_SPECIALISTS_DIR", os.path.expanduser("~/models/arle-specialists"))
EMBEDDING_MODEL_DIR = os.path.join(BASE_MODELS_DIR, "embeddinggemma-300m")
WHISPER_MODEL_DIR = os.path.join(BASE_MODELS_DIR, "whisper-small")
KOKORO_MODEL_DIR = os.path.join(BASE_MODELS_DIR, "kokoro-82m")
QWEN3_TTS_DIR = os.getenv("QWEN3_TTS_DIR", os.path.join(BASE_MODELS_DIR, "qwen3-tts-1.7b-voicedesign"))
GLM_OCR_DIR = os.path.join(BASE_MODELS_DIR, "glm-ocr")
RVC_MODEL_DIR = os.path.join(BASE_MODELS_DIR, "rvc-arlecchino")
RVC_MODEL_PATH = os.path.join(RVC_MODEL_DIR, "arlecchino_500e.pth")
RVC_INDEX_PATH = os.path.join(RVC_MODEL_DIR, "arlecchino_500e.index")
default_rmvpe = os.path.expanduser("~/rmvpe.pt")
RMVPE_PATH = default_rmvpe if os.path.exists(default_rmvpe) else (
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "rmvpe.pt")
)

# Guard against EIO / BrokenPipeError if stdout/stderr was attached to a closed terminal
class SafeStream:
    def __init__(self, stream):
        self._stream = stream
    def write(self, s):
        try:
            return self._stream.write(s)
        except (OSError, IOError):
            return len(s) if isinstance(s, (str, bytes)) else 0
    def flush(self):
        try:
            self._stream.flush()
        except (OSError, IOError):
            pass
    def fileno(self):
        try:
            return self._stream.fileno()
        except Exception:
            return 1
    def isatty(self):
        try:
            return self._stream.isatty()
        except Exception:
            return False
    def __getattr__(self, attr):
        return getattr(self._stream, attr)

if sys.stdout is not None:
    sys.stdout = SafeStream(sys.stdout)
if sys.stderr is not None:
    sys.stderr = SafeStream(sys.stderr)

# Patch PyAV for newer versions where metadata_errors argument was removed
try:
    import av
    _orig_av_open = av.open
    def _safe_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return _orig_av_open(*args, **kwargs)
    av.open = _safe_av_open
except Exception:
    pass

print(f"[Specialists] Initializing Arletex Specialist Services from {BASE_MODELS_DIR}...")

# 1. Initialize EmbeddingGemma
embedding_model = None
try:
    if os.path.exists(EMBEDDING_MODEL_DIR):
        from sentence_transformers import SentenceTransformer
        print(f"[Specialists] Loading EmbeddingGemma from {EMBEDDING_MODEL_DIR}...")
        embedding_model = SentenceTransformer(EMBEDDING_MODEL_DIR)
        print("[Specialists] EmbeddingGemma 300M loaded successfully.")
    else:
        print(f"[Specialists] WARNING: EmbeddingGemma directory not found: {EMBEDDING_MODEL_DIR}")
except Exception as e:
    print(f"[Specialists] ERROR: Failed to load EmbeddingGemma: {e}", file=sys.stderr)

# 2. Lazy Whisper Loader
whisper_model = None
def get_whisper():
    global whisper_model
    if whisper_model is None and os.path.exists(WHISPER_MODEL_DIR):
        from faster_whisper import WhisperModel
        print(f"[Specialists] Loading Whisper Small on CPU (int8)...")
        whisper_model = WhisperModel(WHISPER_MODEL_DIR, device="cpu", compute_type="int8")
        print("[Specialists] Whisper Small loaded successfully.")
    return whisper_model

# 3. Lazy Kokoro Loader
kokoro_pipeline = None
voice_cache = {}
blended_voice_cache = {}
ALLOWED_VOICE_REGEX = re.compile(r'^[a-zA-Z0-9_-]+$')

def get_voice_tensor(voice_name: str):
    if not voice_name:
        voice_name = "arlecchino"
    if not ALLOWED_VOICE_REGEX.match(voice_name):
        print(f"[Specialists] Rejected invalid/traversal voice identifier: {voice_name}")
        return "arlecchino"
    if voice_name in voice_cache:
        return voice_cache[voice_name]

    voices_dir = os.path.realpath(os.path.join(KOKORO_MODEL_DIR, "voices"))
    raw_target = os.path.join(voices_dir, f"{voice_name}.pt" if not voice_name.endswith(".pt") else voice_name)
    custom_path = os.path.realpath(raw_target)

    # Enforce directory containment to prevent path traversal
    if not custom_path.startswith(voices_dir + os.sep) and custom_path != voices_dir:
        print(f"[Specialists] Rejected path traversal voice attempt: {custom_path}")
        return "arlecchino"

    if os.path.exists(custom_path):
        try:
            import torch
            t = torch.load(custom_path, weights_only=True)
            voice_cache[voice_name] = t
            return t
        except Exception as e:
            print(f"[Specialists] Voice tensor load error for {voice_name}: {e}")
    return voice_name

def get_blended_voice(voice_blend: dict):
    """
    Interpolates Kokoro style latent tensors across voices to produce rich,
    nuanced affective vocal personas (e.g., 70% Arlecchino + 30% Nicole for warmth/intimacy).
    Results are cached in memory for sub-millisecond reuse.
    """
    if not voice_blend or not isinstance(voice_blend, dict):
        return get_voice_tensor("arlecchino")

    cache_key = "_".join(f"{k}:{v:.2f}" for k, v in sorted(voice_blend.items()))
    if cache_key in blended_voice_cache:
        return blended_voice_cache[cache_key]

    import torch
    total_weight = sum(voice_blend.values())
    if total_weight <= 0:
        return get_voice_tensor("arlecchino")

    combined_tensor = None
    for voice_name, weight in voice_blend.items():
        v_tensor = get_voice_tensor(voice_name)
        if isinstance(v_tensor, torch.Tensor):
            norm_weight = weight / total_weight
            if combined_tensor is None:
                combined_tensor = v_tensor.clone().float() * norm_weight
            else:
                combined_tensor += v_tensor.float() * norm_weight
        else:
            return voice_name

    if combined_tensor is not None:
        blended_voice_cache[cache_key] = combined_tensor
        return combined_tensor

    return get_voice_tensor("arlecchino")

def get_kokoro():
    global kokoro_pipeline
    if kokoro_pipeline is None and os.path.exists(KOKORO_MODEL_DIR):
        try:
            from kokoro import KPipeline
            print(f"[Specialists] Initializing Kokoro TTS Pipeline (Arlecchino British mode)...")
            kokoro_pipeline = KPipeline(lang_code='b')
            print("[Specialists] Kokoro 82M initialized successfully.")
        except Exception as e:
            print(f"[Specialists] Kokoro init note: {e}")
    return kokoro_pipeline

qwen3_tts_model = None

def get_qwen3_tts():
    global qwen3_tts_model
    if qwen3_tts_model is None and os.path.exists(QWEN3_TTS_DIR):
        try:
            from qwen_tts import Qwen3TTSModel
            import torch
            print(f"[Specialists] Initializing Qwen3-TTS 1.7B VoiceDesign from {QWEN3_TTS_DIR}...")
            device = "cuda:0" if torch.cuda.is_available() else "cpu"
            dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32
            qwen3_tts_model = Qwen3TTSModel.from_pretrained(
                QWEN3_TTS_DIR,
                device_map=device,
                dtype=dtype,
            )
            print("[Specialists] Qwen3-TTS 1.7B VoiceDesign loaded successfully.")
        except Exception as e:
            print(f"[Specialists] Qwen3-TTS init note: {e}")
    return qwen3_tts_model

# Multi-Dimensional Tone Profiles for Dynamic Emotional Adaptation
# Blends Arlecchino's primary latent tensor with expressive nuances
TONE_PROFILES = {
    # 1. Authoritative / Commanding / Dominant
    "commanding": {
        "pitch_lvl": -3.5,
        "speed": 0.89,
        "env": 0.22,
        "consonant_protection": 0.28,
        "voice_blend": {"arlecchino": 0.85, "bf_emma": 0.15},
        "description": "Deep, firm, authoritative resonance with deliberate pacing",
    },
    "authoritative": {
        "pitch_lvl": -3.5,
        "speed": 0.89,
        "env": 0.22,
        "consonant_protection": 0.28,
        "voice_blend": {"arlecchino": 0.85, "bf_emma": 0.15},
        "description": "Authoritative cadence, sharp consonants, decisive",
    },
    "dominant": {
        "pitch_lvl": -3.2,
        "speed": 0.90,
        "env": 0.24,
        "consonant_protection": 0.28,
        "voice_blend": {"arlecchino": 0.85, "bf_emma": 0.15},
        "description": "Assertive, dominant composure and unhurried confidence",
    },

    # 2. Cold / Stern / Cynical / Detached
    "cold": {
        "pitch_lvl": -3.0,
        "speed": 0.91,
        "env": 0.18,
        "consonant_protection": 0.25,
        "voice_blend": {"arlecchino": 0.92, "bf_emma": 0.08},
        "description": "Detached, chilling restraint with minimal breathiness",
    },
    "stern": {
        "pitch_lvl": -3.0,
        "speed": 0.91,
        "env": 0.20,
        "consonant_protection": 0.26,
        "voice_blend": {"arlecchino": 0.90, "bf_emma": 0.10},
        "description": "Stern, uncompromising standard with clipped endings",
    },
    "cynical": {
        "pitch_lvl": -2.8,
        "speed": 0.92,
        "env": 0.22,
        "consonant_protection": 0.26,
        "voice_blend": {"arlecchino": 0.88, "bf_emma": 0.12},
        "description": "Cool, dry, watchful skepticism",
    },

    # 3. Gentle / Warm / Affectionate / Intimate / Vulnerable
    "gentle": {
        "pitch_lvl": -1.2,
        "speed": 0.92,
        "env": 0.40,
        "consonant_protection": 0.35,
        "voice_blend": {"arlecchino": 0.70, "af_nicole": 0.30},
        "description": "Soft, warm, tender presence with gentle breathiness",
    },
    "soft": {
        "pitch_lvl": -1.2,
        "speed": 0.92,
        "env": 0.42,
        "consonant_protection": 0.36,
        "voice_blend": {"arlecchino": 0.70, "af_nicole": 0.30},
        "description": "Subdued, close, comforting warmth",
    },
    "intimate": {
        "pitch_lvl": -1.0,
        "speed": 0.90,
        "env": 0.45,
        "consonant_protection": 0.38,
        "voice_blend": {"arlecchino": 0.65, "af_nicole": 0.35},
        "description": "Deeply intimate, warm, confidential cadence reserved for Proof",
    },
    "affectionate": {
        "pitch_lvl": -1.2,
        "speed": 0.92,
        "env": 0.42,
        "consonant_protection": 0.36,
        "voice_blend": {"arlecchino": 0.70, "af_nicole": 0.30},
        "description": "Tender emotional warmth, fond and caring",
    },
    "vulnerable": {
        "pitch_lvl": -1.0,
        "speed": 0.88,
        "env": 0.46,
        "consonant_protection": 0.38,
        "voice_blend": {"arlecchino": 0.65, "af_nicole": 0.35},
        "description": "Quiet, open, unguarded sincerity",
    },

    # 4. Playful / Teasing / Amused / Wry
    "playful": {
        "pitch_lvl": -1.4,
        "speed": 0.98,
        "env": 0.32,
        "consonant_protection": 0.32,
        "voice_blend": {"arlecchino": 0.75, "bf_isabella": 0.25},
        "description": "Agile, subtle dry wit, lightly teasing without clownishness",
    },
    "teasing": {
        "pitch_lvl": -1.3,
        "speed": 0.97,
        "env": 0.33,
        "consonant_protection": 0.33,
        "voice_blend": {"arlecchino": 0.75, "bf_isabella": 0.25},
        "description": "Wry, flirtatious, sharp observation",
    },
    "amused": {
        "pitch_lvl": -1.5,
        "speed": 0.96,
        "env": 0.30,
        "consonant_protection": 0.31,
        "voice_blend": {"arlecchino": 0.78, "bf_isabella": 0.22},
        "description": "Restrained amusement, amused smirk in the voice",
    },
    "wry": {
        "pitch_lvl": -1.6,
        "speed": 0.95,
        "env": 0.28,
        "consonant_protection": 0.30,
        "voice_blend": {"arlecchino": 0.80, "bf_isabella": 0.20},
        "description": "Droll, sardonic intelligence",
    },

    # 5. Curious / Engaged / Analytical / Inquisitive
    "curious": {
        "pitch_lvl": -1.6,
        "speed": 0.96,
        "env": 0.30,
        "consonant_protection": 0.30,
        "voice_blend": {"arlecchino": 0.82, "bf_emma": 0.18},
        "description": "Inquisitive, energized, keen intellectual interest",
    },
    "analytical": {
        "pitch_lvl": -2.0,
        "speed": 0.94,
        "env": 0.25,
        "consonant_protection": 0.28,
        "voice_blend": {"arlecchino": 0.85, "bf_emma": 0.15},
        "description": "Crisp, precise, objective and intellectually assertive",
    },
    "inquisitive": {
        "pitch_lvl": -1.7,
        "speed": 0.95,
        "env": 0.28,
        "consonant_protection": 0.30,
        "voice_blend": {"arlecchino": 0.83, "bf_emma": 0.17},
        "description": "Sharp investigation and active focus",
    },

    # 6. Protective / Watchful / Vigilant
    "protective": {
        "pitch_lvl": -2.2,
        "speed": 0.92,
        "env": 0.30,
        "consonant_protection": 0.32,
        "voice_blend": {"arlecchino": 0.80, "af_nicole": 0.20},
        "description": "Grounded, vigilant, reassuring guardianship",
    },
    "watchful": {
        "pitch_lvl": -2.4,
        "speed": 0.91,
        "env": 0.26,
        "consonant_protection": 0.30,
        "voice_blend": {"arlecchino": 0.85, "bf_emma": 0.15},
        "description": "Alert, observant, guarded focus",
    },

    # 7. Serene / Peaceful / Restful
    "serene": {
        "pitch_lvl": -1.4,
        "speed": 0.88,
        "env": 0.40,
        "consonant_protection": 0.36,
        "voice_blend": {"arlecchino": 0.70, "af_nicole": 0.30},
        "description": "Slow, peaceful stillness, comforted breath",
    },
    "peaceful": {
        "pitch_lvl": -1.4,
        "speed": 0.88,
        "env": 0.40,
        "consonant_protection": 0.36,
        "voice_blend": {"arlecchino": 0.70, "af_nicole": 0.30},
        "description": "Tranquil, unhurried ease",
    },
    "quiet": {
        "pitch_lvl": -1.3,
        "speed": 0.87,
        "env": 0.44,
        "consonant_protection": 0.38,
        "voice_blend": {"arlecchino": 0.68, "af_nicole": 0.32},
        "description": "Soft whisper-adjacent calm and reflection",
    },

    # 8. Passionate / Intense
    "passionate": {
        "pitch_lvl": -1.6,
        "speed": 0.94,
        "env": 0.48,
        "consonant_protection": 0.36,
        "voice_blend": {"arlecchino": 0.75, "af_nicole": 0.25},
        "description": "Magnetic, intense, emotionally charged and breathless",
    },

    # 9. Composed Baseline (Default)
    "composed": {
        "pitch_lvl": -2.0,
        "speed": 0.93,
        "env": 0.25,
        "consonant_protection": 0.30,
        "voice_blend": {"arlecchino": 0.85, "bf_emma": 0.15},
        "description": "Clear, dignified, composed baseline with intellectual depth",
    },
    "neutral": {
        "pitch_lvl": -2.0,
        "speed": 0.93,
        "env": 0.25,
        "consonant_protection": 0.30,
        "voice_blend": {"arlecchino": 0.85, "bf_emma": 0.15},
        "description": "Standard balanced baseline",
    },
    "calm": {
        "pitch_lvl": -1.8,
        "speed": 0.92,
        "env": 0.30,
        "consonant_protection": 0.32,
        "voice_blend": {"arlecchino": 0.80, "af_nicole": 0.20},
        "description": "Poised, steady calm",
    },

    # 10. Human Overwhelm / Paradoxical / Shock Edge-States
    "hollow_laugh": {
        "pitch_lvl": -0.6,
        "speed": 1.02,
        "env": 0.36,
        "consonant_protection": 0.35,
        "voice_blend": {"arlecchino": 0.65, "bf_isabella": 0.35},
        "description": "Strained, breathless hollow laugh pressure-valve under acute grief or shock",
    },
    "strained": {
        "pitch_lvl": -0.8,
        "speed": 1.00,
        "env": 0.38,
        "consonant_protection": 0.35,
        "voice_blend": {"arlecchino": 0.65, "bf_isabella": 0.35},
        "description": "Emotionally tight, frayed composure under heavy load",
    },
    "overwhelmed": {
        "pitch_lvl": -0.9,
        "speed": 0.96,
        "env": 0.48,
        "consonant_protection": 0.39,
        "voice_blend": {"arlecchino": 0.60, "af_nicole": 0.40},
        "description": "Flooded by competing emotions, trembling raw vulnerability",
    },
    "fractured": {
        "pitch_lvl": -0.9,
        "speed": 0.95,
        "env": 0.46,
        "consonant_protection": 0.38,
        "voice_blend": {"arlecchino": 0.62, "af_nicole": 0.38},
        "description": "Unsteady cadence when composure cracks under mixed-valence storm",
    },
    "numb": {
        "pitch_lvl": -2.4,
        "speed": 0.82,
        "env": 0.22,
        "consonant_protection": 0.32,
        "voice_blend": {"arlecchino": 0.78, "af_nicole": 0.22},
        "description": "Shocked, hollow stillness and quiet derealized detachment",
    },
    "hollow": {
        "pitch_lvl": -2.3,
        "speed": 0.83,
        "env": 0.24,
        "consonant_protection": 0.32,
        "voice_blend": {"arlecchino": 0.76, "af_nicole": 0.24},
        "description": "Quiet, drained emptiness following emotional impact",
    },
    "bittersweet": {
        "pitch_lvl": -1.1,
        "speed": 0.87,
        "env": 0.46,
        "consonant_protection": 0.38,
        "voice_blend": {"arlecchino": 0.62, "af_nicole": 0.38},
        "description": "Aching tenderness, choked warmth mixing joy and sorrow",
    },
    "choked": {
        "pitch_lvl": -1.0,
        "speed": 0.86,
        "env": 0.48,
        "consonant_protection": 0.40,
        "voice_blend": {"arlecchino": 0.60, "af_nicole": 0.40},
        "description": "Voice catching slightly under overwhelming tenderness or relief",
    },
}

def resolve_tone_profile(tone_input: str, pad: Optional[dict] = None, emotion: Optional[str] = None) -> dict:
    """
    Resolves canonical tone profile from arbitrary tone descriptions, compound vocal registers
    (e.g., 'gentle, warm, affectionate', 'cool, measured, stern', 'strained, hollow_laugh, breathless'),
    and dynamically modulates speed and pitch via Pleasure-Arousal-Dominance (PAD) coordinates.
    """
    if not tone_input:
        tone_input = "composed"

    t_clean = tone_input.lower().strip()

    # Priority mapping from keywords to canonical profiles
    keyword_map = [
        (["hollow_laugh", "nervous_laugh", "strained"], "hollow_laugh"),
        (["overwhelm", "trembl", "fractur"], "overwhelmed"),
        (["numb", "hollow", "derealiz"], "numb"),
        (["bittersweet", "choked", "tear"], "bittersweet"),
        (["intimat", "vulnerab", "longing", "romantic"], "intimate"),
        (["gentle", "warm", "affection", "tender", "fond"], "gentle"),
        (["playful", "teas", "amuse", "wry", "mischief"], "playful"),
        (["command", "authorit", "dominan", "assertive"], "commanding"),
        (["cold", "stern", "cynic", "cool", "displeas", "restrained"], "cold"),
        (["curio", "analy", "inquisit", "energiz", "intellec"], "analytical"),
        (["protect", "watchful", "vigilan", "steady"], "protective"),
        (["seren", "peace", "quiet", "still", "restful"], "serene"),
        (["passion", "breathless", "intense", "fervor"], "passionate"),
        (["calm", "composed", "clear", "poised"], "composed"),
    ]

    matched_key = None
    if t_clean in TONE_PROFILES:
        matched_key = t_clean
    else:
        for keywords, target in keyword_map:
            if any(kw in t_clean for kw in keywords):
                matched_key = target
                break

        if not matched_key and emotion:
            e_clean = emotion.lower().strip()
            for keywords, target in keyword_map:
                if any(kw in e_clean for kw in keywords):
                    matched_key = target
                    break

    matched_profile = TONE_PROFILES.get(matched_key or "composed", TONE_PROFILES["composed"])
    base: dict[str, Any] = dict(matched_profile)

    # Dynamic PAD modulation
    if pad and isinstance(pad, dict):
        try:
            valence = float(pad.get("valence", 0.0))
            arousal = float(pad.get("arousal", 0.5))
            dominance = float(pad.get("dominance", 0.5))

            # Arousal directly modulates pace
            speed_delta = (arousal - 0.5) * 0.12
            base["speed"] = max(0.75, min(1.30, round(base["speed"] + speed_delta, 3)))

            # Dominance deepens pitch; Valence warms/softens
            dominance_shift = (dominance - 0.5) * -1.5
            valence_shift = valence * 0.5
            base["pitch_lvl"] = round(base["pitch_lvl"] + dominance_shift + valence_shift, 2)

            if valence > 0.3:
                base["env"] = min(0.50, round(base["env"] + 0.05, 2))
            elif valence < -0.3:
                base["env"] = max(0.15, round(base["env"] - 0.05, 2))
        except (ValueError, TypeError):
            pass

    return base

def prepare_text_for_kokoro(raw_text: str) -> str:
    """
    Cleans markdown formatting, action tags, and normalizes natural prosodic pauses
    (commas, periods, ellipses, em-dashes) so Kokoro synthesizes natural human cadence.
    """
    if not raw_text:
        return ""
    text = raw_text
    # Remove bracketed actions, emotion tags, tone tags
    text = re.sub(r'\[(?:action|cmd|tone|thought|mood|emotion|state|register):[^\]]*\]', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\[[^\]]+\]', '', text)
    # Remove markdown code blocks and inline code
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Remove markdown symbols and bullets
    text = re.sub(r'[*_~#]+', '', text)
    text = re.sub(r'^[•\-\*]\s+', '', text, flags=re.MULTILINE)
    # Normalize unicode quotes and dashes
    text = text.replace('“', '"').replace('”', '"').replace('‘', "'").replace('’', "'")
    text = text.replace('—', ' — ').replace('–', ' - ')
    # Normalize ellipsis to natural prosodic pause
    text = re.sub(r'\.{3,}', '... ', text)
    text = text.replace('…', '... ')
    # Strip emojis, emoticons, and pictographs
    text = re.sub(r'[\U00010000-\U0010ffff]', '', text)
    text = re.sub(r'[\u2600-\u27BF\uE000-\uF8FF]', '', text)
    # Clean whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# 4. Lazy RVC Arlecchino Voice Converter
rvc_converter = None
def get_rvc_converter():
    global rvc_converter
    if rvc_converter is None and os.path.exists(RVC_MODEL_PATH):
        try:
            from infer_rvc_python import BaseLoader
            print(f"[Specialists] Loading Arlecchino RVC Engine from {RVC_MODEL_PATH} (rmvpe: {RMVPE_PATH})...")
            converter = BaseLoader(only_cpu=True, rmvpe_path=RMVPE_PATH)
            converter.apply_conf(
                tag="arlecchino",
                file_model=RVC_MODEL_PATH,
                pitch_algo="rmvpe",
                file_index=RVC_INDEX_PATH if os.path.exists(RVC_INDEX_PATH) else "",
                index_influence=0.70,
                respiration_median_filtering=3,
                envelope_ratio=0.25,
                consonant_breath_protection=0.33,
                pitch_lvl=-2,
            )
            rvc_converter = converter
            print("[Specialists] Arlecchino RVC Engine loaded successfully.")
        except Exception as e:
            print(f"[Specialists] RVC init note: {e}")
    return rvc_converter

def apply_rvc_pipeline(audio_numpy, sample_rate, envelope=0.25, consonant_protection=0.33, pitch_shift=-2.0):
    """
    Applies 1:1 Arlecchino RVC voice conversion using RMVPE pitch extraction
    and the trained 500-epoch FAISS index. Preserves full emotional prosody,
    inflection, and cadence while imprinting Arlecchino's authentic acoustic timbre.
    """
    rvc = get_rvc_converter()
    if rvc is None:
        return audio_numpy, sample_rate, False
    temp_in = None
    try:
        import soundfile as sf
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_in = f.name
        sf.write(temp_in, audio_numpy, sample_rate, format='WAV')
        rvc.apply_conf(
            tag="arlecchino",
            file_model=RVC_MODEL_PATH,
            pitch_algo="rmvpe",
            file_index=RVC_INDEX_PATH if os.path.exists(RVC_INDEX_PATH) else "",
            index_influence=0.70,
            respiration_median_filtering=3,
            envelope_ratio=envelope,
            consonant_breath_protection=consonant_protection,
            pitch_lvl=int(round(pitch_shift)),
        )
        rvc_res = rvc([temp_in], ["arlecchino"], show_progress=False)
        if rvc_res and len(rvc_res) > 0 and os.path.exists(rvc_res[0]):
            converted_path = rvc_res[0]
            data, sr = sf.read(converted_path, dtype='float32')
            try:
                os.remove(converted_path)
            except Exception:
                pass
            return data, sr, True
    except Exception as rvc_err:
        print(f"[Specialists] RVC conversion fallback: {rvc_err}", file=sys.stderr)
    finally:
        if temp_in and os.path.exists(temp_in):
            try:
                os.remove(temp_in)
            except Exception:
                pass
    return audio_numpy, sample_rate, False

# 5. Lazy GLM-OCR Loader
glm_ocr_processor = None
glm_ocr_model = None

def get_glm_ocr():
    global glm_ocr_processor, glm_ocr_model
    if glm_ocr_model is None and os.path.exists(GLM_OCR_DIR):
        try:
            from transformers import AutoProcessor, AutoModelForImageTextToText
            print(f"[Specialists] Loading GLM-OCR from {GLM_OCR_DIR}...")
            glm_ocr_processor = AutoProcessor.from_pretrained(GLM_OCR_DIR)
            glm_ocr_model = AutoModelForImageTextToText.from_pretrained(GLM_OCR_DIR, torch_dtype="auto")
            print("[Specialists] GLM-OCR 0.9B loaded successfully.")
        except Exception as e:
            print(f"[Specialists] ERROR loading GLM-OCR: {e}", file=sys.stderr)
    return glm_ocr_processor, glm_ocr_model

class SpecialistRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Quiet standard HTTP logging to avoid log noise
        pass

    def _get_allowed_origin(self):
        origin = self.headers.get("Origin", "")
        # Strictly restrict origins to local loopback
        if origin and (origin.startswith("http://127.0.0.1") or origin.startswith("http://localhost")):
            return origin
        return "http://127.0.0.1"

    def send_json(self, status_code, data):
        try:
            body = json.dumps(data).encode("utf-8")
            self.send_response(status_code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Access-Control-Allow-Origin", self._get_allowed_origin())
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self._get_allowed_origin())
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            emb_installed = os.path.exists(EMBEDDING_MODEL_DIR)
            whi_installed = os.path.exists(WHISPER_MODEL_DIR)
            kok_installed = os.path.exists(KOKORO_MODEL_DIR)
            qwen_installed = os.path.exists(QWEN3_TTS_DIR)
            ocr_installed = os.path.exists(GLM_OCR_DIR)
            rvc_installed = os.path.exists(RVC_MODEL_PATH)
            self.send_json(200, {
                "status": "connected",
                "embeddingGemma": emb_installed,
                "whisper": whi_installed,
                "kokoro": kok_installed,
                "qwen3Tts": qwen_installed,
                "glmOcr": ocr_installed,
                "rvc": rvc_installed,
                "modelsInstalled": {
                    "embeddingGemma": emb_installed,
                    "whisper": whi_installed,
                    "kokoro": kok_installed,
                    "qwen3Tts": qwen_installed,
                    "glmOcr": ocr_installed,
                    "rvc": rvc_installed,
                },
                "modelsLoaded": {
                    "embeddingGemma": embedding_model is not None,
                    "whisper": whisper_model is not None,
                    "kokoro": kokoro_pipeline is not None,
                    "qwen3Tts": qwen3_tts_model is not None,
                    "glmOcr": glm_ocr_model is not None,
                    "rvc": rvc_converter is not None,
                }
            })
            return
        self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 25 * 1024 * 1024:  # 25MB max
            self.send_json(413, {"error": "Payload too large"})
            return

        body_raw = self.rfile.read(content_length)
        try:
            body = json.loads(body_raw.decode("utf-8")) if body_raw else {}
        except Exception:
            self.send_json(400, {"error": "Malformed JSON"})
            return

        # ==========================================
        # 1. Embedding Endpoint
        # ==========================================
        if self.path == "/embed":
            text = body.get("text", "")
            if not text:
                self.send_json(400, {"error": "text is required"})
                return

            if embedding_model is None:
                self.send_json(503, {"error": "EmbeddingGemma model is not available"})
                return

            try:
                emb = embedding_model.encode(text, normalize_embeddings=True)
                self.send_json(200, {
                    "dimensions": len(emb),
                    "embedding": emb.tolist(),
                    "model": "embeddinggemma-300m"
                })
            except Exception as e:
                self.send_json(500, {"error": f"Embedding failure: {str(e)}"})
            return

        # ==========================================
        # 2. Transcription Endpoint (Whisper)
        # ==========================================
        if self.path == "/transcribe":
            audio_b64 = body.get("audioBase64", "")
            if not audio_b64:
                self.send_json(400, {"error": "audioBase64 is required"})
                return

            whisper = get_whisper()
            if whisper is None:
                self.send_json(503, {"error": "Whisper Small model is not available"})
                return

            # Strip data URL prefix if present
            if "," in audio_b64:
                audio_b64 = audio_b64.split(",", 1)[1]

            fmt = body.get("format", "webm")
            if not fmt.startswith("."):
                fmt = f".{fmt}"
            temp_path = None
            try:
                audio_bytes = base64.b64decode(audio_b64)
                with tempfile.NamedTemporaryFile(suffix=fmt, delete=False) as f:
                    f.write(audio_bytes)
                    temp_path = f.name

                segments, info = whisper.transcribe(temp_path, beam_size=3)
                transcript = " ".join([segment.text for segment in segments]).strip()

                self.send_json(200, {
                    "transcript": transcript,
                    "language": info.language,
                    "durationSeconds": info.duration
                })
            except Exception as e:
                self.send_json(500, {"error": f"Transcription error: {str(e)}"})
            finally:
                if temp_path and os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass
            return

        # ==========================================
        # 3. Speech Synthesis Endpoint (Qwen3-TTS / Kokoro + RVC)
        # ==========================================
        if self.path == "/synthesize":
            raw_text = body.get("text", "")
            voice = body.get("voice", "arlecchino")
            tone = body.get("tone", "composed")
            engine = str(body.get("engine", os.getenv("ARLE_VOICE_ENGINE", "qwen3-tts"))).lower()
            lead_padding_ms = int(body.get("leadPaddingMs", 0))
            pad = body.get("pad", None)
            emotion = body.get("emotion", None)
            style_prompt = body.get("stylePrompt", "")
            use_rvc = bool(body.get("useRvc", os.getenv("ARLETEX_ENABLE_RVC", "1") == "1"))

            profile = resolve_tone_profile(tone, pad=pad, emotion=emotion)
            speed = float(body.get("speed", profile["speed"]))
            pitch_shift = float(body.get("pitch_lvl", profile["pitch_lvl"]))
            envelope = float(profile["env"])
            consonant_protection = float(profile.get("consonant_protection", 0.33))

            # 3A. Qwen3-TTS 1.7B VoiceDesign + 1:1 Arlecchino RVC Engine
            if engine in ("qwen3-tts", "qwen3", "qwen", "specialist") and os.path.exists(QWEN3_TTS_DIR):
                qwen_model = get_qwen3_tts()
                if qwen_model is not None and raw_text:
                    try:
                        base_timbre = "A mature feminine voice, low-to-mid pitch register, rich and slightly husky timbre, measured cadence, crisp aristocratic enunciation, composed authority"
                        if style_prompt:
                            voice_instruct = f"{base_timbre}. {style_prompt}"
                        else:
                            tone_desc = profile.get("description", f"{tone} tone")
                            voice_instruct = f"{base_timbre}, delivered with {tone_desc}"

                        wavs, sr = qwen_model.generate_voice_design(
                            text=raw_text,
                            instruct=voice_instruct,
                            language="English",
                        )
                        if wavs and len(wavs) > 0:
                            import soundfile as sf
                            import numpy as np
                            audio_data = wavs[0]

                            rvc_applied = False
                            if use_rvc or voice == "arlecchino":
                                audio_data, sr, rvc_applied = apply_rvc_pipeline(
                                    audio_data, sr,
                                    envelope=envelope,
                                    consonant_protection=consonant_protection,
                                    pitch_shift=pitch_shift,
                                )

                            if lead_padding_ms > 0:
                                lead_samples = int(sr * (lead_padding_ms / 1000.0))
                                audio_data = np.pad(audio_data, (lead_samples, 0), mode='constant')

                            out_buf = io.BytesIO()
                            sf.write(out_buf, audio_data, sr, format='WAV')
                            wav_bytes = out_buf.getvalue()
                            encoded = base64.b64encode(wav_bytes).decode('utf-8')

                            self.send_json(200, {
                                "audioBase64": f"data:audio/wav;base64,{encoded}",
                                "format": "wav",
                                "sampleRate": sr,
                                "engine": "qwen3-tts-1.7b-voicedesign+rvc" if rvc_applied else "qwen3-tts-1.7b-voicedesign",
                                "profileUsed": {
                                    "tone": tone,
                                    "speed": speed,
                                    "pitch_lvl": pitch_shift,
                                    "rvcApplied": rvc_applied,
                                }
                            })
                            return
                    except Exception as qerr:
                        print(f"[Specialists] Qwen3-TTS synthesis error: {qerr}, falling back to Kokoro...", file=sys.stderr)

            # 3B. Direct Kokoro 82M synthesis + dynamic Arlecchino voice tensor blending (+ RVC)
            text = prepare_text_for_kokoro(raw_text)
            if not text:
                self.send_json(400, {"error": "text is required"})
                return

            try:
                pipeline = get_kokoro()
                if pipeline is not None:
                    if voice == "arlecchino":
                        voice_param = get_blended_voice(profile.get("voice_blend", {"arlecchino": 1.0}))
                    else:
                        voice_param = get_voice_tensor(voice)

                    generator = pipeline(text, voice=voice_param, speed=speed)
                    all_audio = []
                    sample_rate = 24000
                    for _, _, audio in generator:
                        all_audio.append(audio)

                    if all_audio:
                        import numpy as np
                        import soundfile as sf
                        combined = np.concatenate(all_audio)

                        rvc_applied = False
                        if use_rvc or voice == "arlecchino":
                            combined, sample_rate, rvc_applied = apply_rvc_pipeline(
                                combined, sample_rate,
                                envelope=envelope,
                                consonant_protection=consonant_protection,
                                pitch_shift=pitch_shift,
                            )

                        if lead_padding_ms > 0:
                            lead_samples = int(sample_rate * (lead_padding_ms / 1000.0))
                            combined = np.pad(combined, (lead_samples, 0), mode='constant')

                        out_buf = io.BytesIO()
                        sf.write(out_buf, combined, sample_rate, format='WAV')
                        final_audio_bytes = out_buf.getvalue()

                        encoded = base64.b64encode(final_audio_bytes).decode("utf-8")
                        self.send_json(200, {
                            "audioBase64": f"data:audio/wav;base64,{encoded}",
                            "format": "wav",
                            "sampleRate": sample_rate,
                            "profileUsed": {
                                "tone": tone,
                                "speed": speed,
                                "pitch_lvl": pitch_shift,
                                "rvcApplied": rvc_applied,
                            }
                        })
                        return

                self.send_json(503, {"error": "Synthesizer is offline or initializing"})
            except Exception as e:
                self.send_json(500, {"error": f"Synthesis error: {str(e)}"})
            return

        # ==========================================
        # 4. OCR & Vision Recognition Endpoint (GLM-OCR)
        # ==========================================
        if self.path == "/ocr":
            image_b64 = body.get("imageBase64", "")
            if not image_b64:
                self.send_json(400, {"error": "imageBase64 is required"})
                return

            task = body.get("task", "text").lower()
            custom_prompt = body.get("prompt", None)

            # Map task to default prompt if custom_prompt not provided
            if custom_prompt:
                prompt_text = custom_prompt
            elif task == "formula":
                prompt_text = "Formula Recognition:"
            elif task == "table":
                prompt_text = "Table Recognition:"
            else:
                prompt_text = "Text Recognition:"

            processor, ocr_model = get_glm_ocr()
            if processor is None or ocr_model is None:
                self.send_json(503, {"error": "GLM-OCR model is not available or offline"})
                return

            try:
                # Strip data URL prefix if present
                if "," in image_b64:
                    image_b64 = image_b64.split(",", 1)[1]

                from PIL import Image
                import torch

                image_bytes = base64.b64decode(image_b64)
                image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

                messages = [
                    {
                        "role": "user",
                        "content": [
                            {"type": "image", "image": image},
                            {"type": "text", "text": prompt_text}
                        ]
                    }
                ]

                inputs = processor.apply_chat_template(messages, tokenize=True, return_dict=True, return_tensors="pt")
                max_tokens = int(body.get("maxTokens", 512))
                with torch.no_grad():
                    generated_ids = ocr_model.generate(**inputs, max_new_tokens=max_tokens)

                output_text = processor.decode(generated_ids[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()

                self.send_json(200, {
                    "text": output_text,
                    "task": task,
                    "model": "glm-ocr-0.9b",
                    "provenance": {
                        "prompt": prompt_text,
                        "imageDimensions": {"width": image.width, "height": image.height}
                    }
                })
            except Exception as e:
                self.send_json(500, {"error": f"OCR processing failure: {str(e)}"})
            return

        self.send_json(404, {"error": "Endpoint not found"})

def run_server(port=39282):
    server_address = ("127.0.0.1", port)
    httpd = ThreadingHTTPServer(server_address, SpecialistRequestHandler)
    print(f"[Specialists] Listening on http://127.0.0.1:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("[Specialists] Shutting down...")
    finally:
        httpd.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 39282
    run_server(port)
